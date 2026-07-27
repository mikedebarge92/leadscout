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
  if (!url) return { outdated: true, reason: "No owned website—customers must rely on the map listing" };
  if (!safeWebsite(url)) return { outdated: false, reason: "Website could not be safely inspected" };
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6500), headers: { "User-Agent": "LeadScout Website Quality Check/1.0" } });
    const html = (await response.text()).slice(0, 500_000).toLowerCase();
    const signals: string[] = [];
    if (!response.url.startsWith("https://")) signals.push("no HTTPS");
    if (!html.includes("name=\"viewport") && !html.includes("name='viewport")) signals.push("not mobile-ready");
    if (/<frameset|<frame[\s>]/.test(html)) signals.push("frame-based layout");
    if ((html.match(/<table/g) ?? []).length > 8) signals.push("table-heavy layout");
    if (/<font[\s>]|<center[\s>]|<marquee[\s>]/.test(html)) signals.push("obsolete HTML");
    const years = [...html.matchAll(/(?:©|copyright|&copy;)[^<]{0,30}(20\d{2})/g)].map((m) => Number(m[1]));
    const newest = years.length ? Math.max(...years) : 0;
    if (newest && newest < new Date().getFullYear() - 4) signals.push(`copyright ${newest}`);
    if (!/<form|tel:|book|appointment|contact/.test(html)) signals.push("weak conversion path");
    return { outdated: signals.length >= 2, reason: signals.length ? signals.slice(0, 3).join(", ") : "Modern website signals detected" };
  } catch {
    return { outdated: true, reason: "Website failed quality and availability check" };
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
  const input = await request.json() as { area?: string; category?: string; minReviews?: number; limit?: number };
  const area = String(input.area || "Sacramento, CA").slice(0, 120);
  const category = String(input.category || "local businesses").replace("All local businesses", "local businesses").slice(0, 80);
  const minReviews = Math.max(10, Math.min(10000, Number(input.minReviews || 10)));
  const placesResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName",
    },
    body: JSON.stringify({ textQuery: `${category} in ${area}`, pageSize: Math.min(20, Number(input.limit || 20)) }),
  });
  if (!placesResponse.ok) {
    const detail = await placesResponse.text();
    return Response.json({ error: "Google Places request failed", detail: detail.slice(0, 300) }, { status: 502 });
  }
  const payload = await placesResponse.json() as { places?: Place[] };
  const candidates = (payload.places ?? []).filter((place) => (place.userRatingCount ?? 0) >= minReviews);
  const inspected = await Promise.all(candidates.map(async (place) => ({ place, audit: await inspectWebsite(place.websiteUri) })));
  const leads: StoredLead[] = inspected.filter(({ place, audit }) => !place.websiteUri || audit.outdated).map(({ place, audit }) => {
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
      stage: "New", x: hashPosition(place.id, 11), y: hashPosition(place.id, 37),
    };
  }).sort((a, b) => b.score - a.score);
  await saveLeads(owner, leads);
  return Response.json({ leads, scanned: candidates.length, qualified: leads.length });
}
