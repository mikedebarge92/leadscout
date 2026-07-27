import { env } from "cloudflare:workers";

export async function GET() {
  return Response.json({
    googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
    email: Boolean(env.RESEND_API_KEY),
    deliveryEmail: Boolean(env.LEAD_DELIVERY_EMAIL),
    mode: env.GOOGLE_PLACES_API_KEY ? "live" : "demo",
  });
}
