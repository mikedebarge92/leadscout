import { headers } from "next/headers";
import { clearUnsavedLeads, dismissLead, listLeads, setLeadStage, setSiteBuilt } from "../../../db/store";

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
  const input = await request.json() as { id?: string; stage?: "New" | "Saved" | "Prototype ready" | "Contacted"; siteBuilt?: boolean };
  if (!input.id) return Response.json({ error: "Missing lead" }, { status: 400 });
  const leadOwner = await owner();
  if (typeof input.siteBuilt === "boolean") await setSiteBuilt(leadOwner, input.id, input.siteBuilt);
  else if (input.stage) await setLeadStage(leadOwner, input.id, input.stage);
  else return Response.json({ error: "Missing update" }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const deleted = await dismissLead(await owner(), id);
    return Response.json({ ok: true, deleted });
  }
  const cleared = await clearUnsavedLeads(await owner());
  return Response.json({ ok: true, cleared });
}
