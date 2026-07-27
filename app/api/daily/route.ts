import { env } from "cloudflare:workers";
import { getCredential, listDailyRecipients, listLeads } from "../../../db/store";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.DAILY_SCOUT_TOKEN || auth !== `Bearer ${env.DAILY_SCOUT_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configured = await listDailyRecipients();
  const recipients = configured.length ? configured : (env.LEAD_DELIVERY_EMAIL ? [{ owner: "local-owner", email: env.LEAD_DELIVERY_EMAIL, limit: 10 }] : []);
  if (!recipients.length) return Response.json({ error: "No delivery email is configured" }, { status: 503 });
  const results = await Promise.all(recipients.map(async (recipient) => {
    const resendKey = env.RESEND_API_KEY || await getCredential(recipient.owner, "resend").catch(() => null);
    if (!resendKey) return false;
    const leads = (await listLeads(recipient.owner)).slice(0, recipient.limit);
    const rows = leads.map((lead) => `<tr><td style="padding:10px;border-bottom:1px solid #ddd"><strong>${escapeHtml(lead.name)}</strong><br><small>${escapeHtml(lead.category)} · ${lead.reviews} reviews</small></td><td style="padding:10px;border-bottom:1px solid #ddd">${lead.score}</td><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(lead.issue)}</td></tr>`).join("");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.LEAD_FROM_EMAIL || "LeadScout <onboarding@resend.dev>",
        to: [recipient.email],
        subject: `${leads.length} LeadScout opportunities for today`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h1>Today’s LeadScout list</h1><p>Trusted local businesses ready for a stronger web presence.</p><table style="width:100%;border-collapse:collapse">${rows}</table></div>`,
      }),
    });
    return response.ok;
  }));
  return Response.json({ ok: results.every(Boolean), sent: results.filter(Boolean).length }, { status: results.every(Boolean) ? 200 : 502 });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}
