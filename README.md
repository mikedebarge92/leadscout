# LeadScout

LeadScout is a portfolio-stage local-business prospecting application. It helps a small web-services team find well-reviewed businesses with no website or a technically outdated one, save promising accounts, and prepare a daily research queue.

## Business Problem

Finding credible local businesses that may need a website is labor-intensive. A researcher must search multiple categories and markets, inspect each listing, review its web presence, avoid previously dismissed accounts, and keep saved opportunities organized.

## Solution

LeadScout searches Google Places, evaluates website signals, ranks qualified businesses, and stores each user's discovery and saved-lead state. It supports configurable categories, locations, review thresholds, live API connections, daily-email settings, and permanent dismissal of unsuitable leads.

## Technical Implementation

- Next.js 16, React 19, TypeScript, and CSS
- vinext/Vite targeting a Cloudflare-compatible worker runtime
- Google Places Text Search API for business discovery
- Server-side website checks for HTTPS, responsive markup, obsolete HTML, recency, and conversion-path signals
- Cloudflare D1 with Drizzle ORM for leads, settings, and encrypted service credentials
- Web Crypto AES-GCM encryption for API credentials stored through the application
- Resend API integration for daily lead-email delivery
- Workspace identity headers to scope data by signed-in user
- Node smoke tests and ESLint

```text
Browser -> Next.js API routes -> Google Places / website checks / Resend
   |               |
   |               +-> encrypted credentials
   |               +-> D1 + Drizzle lead state
   +-> discovery, saved leads, settings, qualification actions
```

## Business Value

The application demonstrates how a repeatable research workflow could reduce manual prospecting, surface businesses with strong social proof, and maintain a cleaner handoff from discovery to prototype creation or outreach. No revenue or conversion lift has been measured.

## My Role

The project owner defined the prospecting problem, qualification rules, market and category workflow, saved-lead stages, and operational requirements. The application was built and refined with AI-assisted development tools, with the owner directing requirements, testing functionality, and choosing integrations. This repository does not claim unaided authorship of every line of code.

## Verified Results

- The application implements live Google Places discovery and server-side site checks.
- Per-user lead, setting, and encrypted credential persistence is implemented for D1.
- Daily-email delivery logic is implemented with authentication and HTML escaping.
- Demo leads use fictional names and `555` phone numbers.
- Fit scores and website-quality classifications are heuristics; they are not verified sales outcomes.

## Setup

Prerequisites: Node.js 22.13 or later. Live features require API credentials and a configured D1 binding.

```bash
npm install
cp .env.example .env.local
# Fill only the services you intend to test.
npm run dev
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_PLACES_API_KEY` | Live discovery | Google Places Text Search |
| `RESEND_API_KEY` | Daily email | Server-side Resend access |
| `LEAD_DELIVERY_EMAIL` | Optional fallback | Default recipient when no saved recipient exists |
| `LEAD_FROM_EMAIL` | Daily email | Verified sender identity |
| `DAILY_SCOUT_TOKEN` | Scheduled delivery | Bearer token protecting the daily endpoint |
| `CREDENTIAL_ENCRYPTION_KEY` | In-app connections | Key material used to encrypt stored API credentials |

Never commit populated environment files. Use a strong independent value for each secret in a real environment.

## Commands

```bash
npm run dev
npm run build
npm test
npm run lint
npm run db:generate
```

## Demo and Screenshots

Run `npm run dev` to explore the fictional seeded leads. A strong portfolio walkthrough shows a live search with the user's own key, website-audit reasoning, saving and dismissing a lead, marking a site as built, and configuring daily delivery.

## Known Limitations

- Website checks use lightweight HTML signals and can produce false positives or inconclusive results.
- Search volume, API costs, rate limits, and website robots policies require production planning.
- The statewide construction search currently uses a fixed list of California markets and category terms.
- There is no automated contact enrichment or outreach sending.
- The daily endpoint requires an external scheduler; none is provisioned by this repository.
- The credential UI and D1 persistence should receive a dedicated security review before multi-tenant production use.

## Project Status

Functional portfolio prototype. Appropriate for demonstrating API integration, research workflow design, server-side security controls, and operational automation; not represented as a production lead-generation service.
