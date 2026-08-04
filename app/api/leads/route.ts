import { headers } from "next/headers";
import { clearUnsavedLeads, listLeads, setLeadStage } from "../../../db/store";

async function owner() {
  return (await headers()).get("oai-authenticated-user-email") ?? "local-owner";
}

export async function GET() {
  try {
    return Response.json({ leads: await listLeads(await owner()) });
  } catch {
    return Response.json({ leads: [] });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json() as { id?: string; stage?: "New" | "Saved" | "Prototype ready" | "Contacted" };
  if (!input.id || !input.stage) return Response.json({ error: "Missing lead or stage" }, { status: 400 });
  await setLeadStage(await owner(), input.id, input.stage);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const cleared = await clearUnsavedLeads(await owner());
  return Response.json({ ok: true, cleared });
}
