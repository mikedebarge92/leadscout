import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the LeadScout application shell", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/LeadScout.tsx", import.meta.url), "utf8");
  assert.match(layout, /LeadScout/i);
  assert.match(component, /Good businesses\. Better websites\./i);
  assert.match(component, /New search/i);
});

test("keeps service credentials in server routes", async () => {
  const searchRoute = await readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8");
  const dailyRoute = await readFile(new URL("../app/api/daily/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/LeadScout.tsx", import.meta.url), "utf8");
  assert.match(searchRoute, /GOOGLE_PLACES_API_KEY/);
  assert.match(dailyRoute, /DAILY_SCOUT_TOKEN/);
  assert.doesNotMatch(page, /process\.env|cloudflare:workers/);
});
