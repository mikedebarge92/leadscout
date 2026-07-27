import { headers } from "next/headers";
import { saveSettings } from "../../../db/store";

export async function POST(request: Request) {
  const owner = (await headers()).get("oai-authenticated-user-email") ?? "local-owner";
  const input = await request.json() as Record<string, unknown>;
  await saveSettings(owner, input);
  return Response.json({ ok: true });
}
