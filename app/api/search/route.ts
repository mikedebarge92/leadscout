import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getCredential, saveLeads, type StoredLead } from "../../../db/store";

type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
};

function safeWebsite(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return host !== "localhost" && host !== "0.0.0.0" && host !== "::1" &&
      !/^127\./.test(host) && !/^10\./.test(host) && !/^192\.168\./.test(host) &&
      !/^169\.254\./.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch { return false; }
}

async function inspectWebsite(url?: string) {
  if (!url) return { outdated: true, verified: true, reason: "No owned website—customers must rely on the map listing" };
  if (!safeWebsite(url)) return { outdated: false, verified: false, reason: "Website could not be safely inspected" };
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6500), headers: { "User-Agent": "LeadScout Website Quality Check/1.0" } });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) {
      return { outdated: false, verified: false, reason: "Website audit was inconclusive" };
    }
    const html = (await response.text()).slice(0, 500_000).toLowerCase();
    const signals: Array<{ label: string; weight: number }> = [];
    if (!response.url.startsWith("https://")) signals.push({ label: "no HTTPS", weight: 2 });
    if (!html.includes("name=\"viewport") && !html.includes("name='viewport")) signals.push({ label: "not mobile-ready", weight: 3 });
    if (/<frameset|<frame[\s>]/.test(html)) signals.push({ label: "frame-based layout", weight: 5 });
    if ((html.match(/<table/g) ?? []).length > 10) signals.push({ label: "table-heavy layout", weight: 2 });
    if (/<font[\s>]|<center[\s>]|<marquee[\s>]/.test(html)) signals.push({ label: "obsolete HTML", weight: 4 });
    const years = [...html.matchAll(/(?:©|copyright|&copy;)[^<]{0,30}(20\d{2})/g)].map((m) => Number(m[1]));
    const newest = years.length ? Math.max(...years) : 0;
    if (newest && newest < new Date().getFullYear() - 5) signals.push({ label: `copyright ${newest}`, weight: 2 });
    if (!/<form|tel:|book|appointment|contact/.test(html)) signals.push({ label: "weak conversion path", weight: 1 });
    const confidence = signals.reduce((total, signal) => total + signal.weight, 0);
    return { outdated: confidence >= 4, verified: true, reason: signals.length ? signals.slice(0, 3).map((signal) => signal.label).join(", ") : "Modern website signals detected" };
  } catch {
    return { outdated: false, verified: false, reason: "Website audit was inconclusive" };
  }
}

function hashPosition(value: string, offset: number) {
  let hash = offset;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return 16 + Math.abs(hash % 68);
}

export async function POST(request: Request) {
  const owner = (await headers()).get("oai-authenticated-user-email") ?? "local-owner";
  const googleKey = env.GOOGLE_PLACES_API_KEY || await getCredential(owner, "googlePlaces").catch(() => null);
  if (!googleKey) return Response.json({ error: "Google Places is not connected", code: "NOT_CONNECTED" }, { status: 503 });
  const input = await request.json() as { area?: string; category?: string; minReviews?: number; limit?: number; radius?: string; includeNoWebsite?: boolean; includeOutdated?: boolean };
  const area = String(input.area || "Sacramento, CA").slice(0, 120);
  const category = String(input.category || "All local businesses").slice(0, 80);
  const minReviews = Math.max(10, Math.min(10000, Number(input.minReviews || 10)));
  const verticals: Record<string, string[]> = {
    "All local businesses": ["plumber", "landscaper", "auto repair shop", "dentist", "pet groomer", "barber shop", "bakery", "roofing contractor"],
    "Home services": ["plumber", "electrician", "landscaper", "roofing contractor", "HVAC contractor", "house cleaner"],
    "Health & wellness": ["dentist", "chiropractor", "physical therapist", "massage therapist", "optometrist"],
    "Food & hospitality": ["bakery", "restaurant", "cafe", "caterer", "event venue"],
    "Professional services": ["accountant", "law firm", "insurance agency", "real estate agency", "financial advisor"],
  };
  const queries = verticals[category] ?? [category];
  const coordinateMatch = area.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const radiusMeters = Math.min(50000, Math.max(1600, Number.parseFloat(input.radius || "5") * 1609.344));
  const locationBias = coordinateMatch ? { circle: { center: { latitude: Number(coordinateMatch[1]), longitude: Number(coordinateMatch[2]) }, radius: radiusMeters } } : undefined;
  const responses = await Promise.all(queries.map((term) => fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName",
    },
    body: JSON.stringify({ textQuery: coordinateMatch ? term : `${term} in ${area}`, pageSize: Math.min(20, Number(input.limit || 20)), ...(locationBias ? { locationBias } : {}) }),
  })));
  const failed = responses.find((response) => !response.ok);
  if (failed) {
    const detail = await failed.text();
    return Response.json({ error: "Google Places request failed", detail: detail.slice(0, 300) }, { status: 502 });
  }
  const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ places?: Place[] }>));
  const unique = new Map<string, Place>();
  for (const place of payloads.flatMap((payload) => payload.places ?? [])) unique.set(place.id, place);
  const candidates = [...unique.values()]
    .filter((place) => (place.userRatingCount ?? 0) >= minReviews)
    .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
  const noSiteCandidates = candidates.filter((place) => !place.websiteUri);
  const siteCandidates = candidates.filter((place) => place.websiteUri).slice(0, 30);
  const inspected = [
    ...noSiteCandidates.map((place) => ({ place, audit: { outdated: true, verified: true, reason: "No owned website—customers must rely on the map listing" } })),
    ...await Promise.all(siteCandidates.map(async (place) => ({ place, audit: await inspectWebsite(place.websiteUri) }))),
  ];
  const includeNoWebsite = input.includeNoWebsite !== false;
  const includeOutdated = input.includeOutdated !== false;
  const leads: StoredLead[] = inspected.filter(({ place, audit }) =>
    (!place.websiteUri && includeNoWebsite) || (Boolean(place.websiteUri) && includeOutdated && audit.verified && audit.outdated)
  ).map(({ place, audit }) => {
    const reviews = place.userRatingCount ?? 0;
    const rating = place.rating ?? 0;
    const noWebsite = !place.websiteUri;
    const score = Math.min(99, Math.round(54 + Math.min(reviews, 250) / 8 + Math.max(0, rating - 3.5) * 10 + (noWebsite ? 10 : 4)));
    return {
      id: place.id, name: place.displayName?.text || "Unnamed business",
      category: place.primaryTypeDisplayName?.text || category, area,
      rating, reviews, issue: noWebsite ? "No website" : "Outdated site",
      score, phone: place.nationalPhoneNumber || "Phone not listed",
      address: place.formattedAddress || area, website: place.websiteUri, mapsUrl: place.googleMapsUri,
      reason: noWebsite ? "Strong local demand with no owned web presence" : audit.reason,
      stage: "New", isSaved: false, inDiscovery: true, x: hashPosition(place.id, 11), y: hashPosition(place.id, 37),
    };
  }).sort((a, b) => b.score - a.score);
  await saveLeads(owner, leads);
  return Response.json({ leads, scanned: candidates.length, qualified: leads.length, queries: queries.length });
}
