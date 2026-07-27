import { headers } from "next/headers";
import { setCredential } from "../../../db/store";

type Service = "googlePlaces" | "resend";

async function testGoogle(key: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: "coffee in Sacramento, CA", pageSize: 1 }),
  });
  return response.ok;
}

async function testResend(key: string) {
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  return response.ok;
}

export async function POST(request: Request) {
  const input = await request.json() as { service?: Service; key?: string };
  if (!input.service || !["googlePlaces", "resend"].includes(input.service) || !input.key?.trim()) {
    return Response.json({ error: "A service and API key are required" }, { status: 400 });
  }
  const key = input.key.trim();
  const valid = input.service === "googlePlaces" ? await testGoogle(key) : await testResend(key);
  if (!valid) return Response.json({ error: `The ${input.service === "googlePlaces" ? "Google Places" : "Resend"} key could not be verified` }, { status: 400 });
  const owner = (await headers()).get("oai-authenticated-user-email") ?? "local-owner";
  await setCredential(owner, input.service, key);
  return Response.json({ ok: true, service: input.service });
}
