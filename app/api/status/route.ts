import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { hasCredential } from "../../../db/store";

export async function GET() {
  const owner = (await headers()).get("oai-authenticated-user-email") ?? "local-owner";
  const [storedGoogle, storedResend] = await Promise.all([
    hasCredential(owner, "googlePlaces").catch(() => false),
    hasCredential(owner, "resend").catch(() => false),
  ]);
  const googlePlaces = Boolean(env.GOOGLE_PLACES_API_KEY) || storedGoogle;
  const email = Boolean(env.RESEND_API_KEY) || storedResend;
  return Response.json({
    googlePlaces,
    email,
    deliveryEmail: Boolean(env.LEAD_DELIVERY_EMAIL),
    mode: googlePlaces ? "live" : "demo",
    vaultReady: Boolean(env.CREDENTIAL_ENCRYPTION_KEY),
  });
}
