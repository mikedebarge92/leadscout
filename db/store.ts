import { env } from "cloudflare:workers";

export type StoredLead = {
  id: string;
  name: string;
  category: string;
  area: string;
  rating: number;
  reviews: number;
  issue: "No website" | "Outdated site";
  score: number;
  phone: string;
  address: string;
  website?: string;
  mapsUrl?: string;
  reason: string;
  stage: "New" | "Saved" | "Prototype ready" | "Contacted";
  x: number;
  y: number;
};

let initialized = false;

export async function getD1() {
  const db = env.DB;
  if (!db) throw new Error("Database is not configured");
  if (!initialized) {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT NOT NULL,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        area TEXT NOT NULL,
        rating REAL NOT NULL,
        reviews INTEGER NOT NULL,
        issue TEXT NOT NULL,
        score INTEGER NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        website TEXT,
        maps_url TEXT,
        reason TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'New',
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (id, owner)
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS leads_owner_score_idx ON leads(owner, score DESC)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS settings (
        owner TEXT PRIMARY KEY,
        delivery_email TEXT NOT NULL DEFAULT '',
        delivery_hour INTEGER NOT NULL DEFAULT 8,
        daily_limit INTEGER NOT NULL DEFAULT 10,
        area TEXT NOT NULL DEFAULT 'Sacramento, CA',
        radius_miles INTEGER NOT NULL DEFAULT 5,
        category TEXT NOT NULL DEFAULT 'All local businesses',
        min_reviews INTEGER NOT NULL DEFAULT 10,
        updated_at TEXT NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS api_credentials (
        owner TEXT NOT NULL,
        service TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner, service)
      )`),
    ]);
    initialized = true;
  }
  return db;
}

export async function saveLeads(owner: string, leads: StoredLead[]) {
  const db = await getD1();
  const now = new Date().toISOString();
  const statements = leads.map((lead) => db.prepare(`INSERT INTO leads
    (id, owner, name, category, area, rating, reviews, issue, score, phone, address, website, maps_url, reason, stage, x, y, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT stage FROM leads WHERE id = ? AND owner = ?), ?), ?, ?, ?, ?)
    ON CONFLICT(id, owner) DO UPDATE SET
      name=excluded.name, category=excluded.category, area=excluded.area, rating=excluded.rating,
      reviews=excluded.reviews, issue=excluded.issue, score=excluded.score, phone=excluded.phone,
      address=excluded.address, website=excluded.website, maps_url=excluded.maps_url,
      reason=excluded.reason, updated_at=excluded.updated_at`)
    .bind(lead.id, owner, lead.name, lead.category, lead.area, lead.rating, lead.reviews, lead.issue, lead.score, lead.phone, lead.address, lead.website ?? null, lead.mapsUrl ?? null, lead.reason, lead.id, owner, lead.stage, lead.x, lead.y, now, now));
  if (statements.length) await db.batch(statements);
}

export async function listLeads(owner: string): Promise<StoredLead[]> {
  const db = await getD1();
  const result = await db.prepare("SELECT * FROM leads WHERE owner = ? ORDER BY score DESC, updated_at DESC").bind(owner).all();
  return result.results.map((row) => ({
    id: String(row.id), name: String(row.name), category: String(row.category), area: String(row.area),
    rating: Number(row.rating), reviews: Number(row.reviews), issue: row.issue as StoredLead["issue"],
    score: Number(row.score), phone: String(row.phone), address: String(row.address),
    website: row.website ? String(row.website) : undefined, mapsUrl: row.maps_url ? String(row.maps_url) : undefined,
    reason: String(row.reason), stage: row.stage as StoredLead["stage"], x: Number(row.x), y: Number(row.y),
  }));
}

export async function setLeadStage(owner: string, id: string, stage: StoredLead["stage"]) {
  const db = await getD1();
  await db.prepare("UPDATE leads SET stage = ?, updated_at = ? WHERE id = ? AND owner = ?")
    .bind(stage, new Date().toISOString(), id, owner).run();
}

export async function saveSettings(owner: string, input: Record<string, unknown>) {
  const db = await getD1();
  await db.prepare(`INSERT INTO settings
    (owner, delivery_email, delivery_hour, daily_limit, area, radius_miles, category, min_reviews, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner) DO UPDATE SET delivery_email=excluded.delivery_email, delivery_hour=excluded.delivery_hour,
    daily_limit=excluded.daily_limit, area=excluded.area, radius_miles=excluded.radius_miles,
    category=excluded.category, min_reviews=excluded.min_reviews, updated_at=excluded.updated_at`)
    .bind(owner, String(input.deliveryEmail ?? ""), Number(input.deliveryHour ?? 8), Number(input.dailyLimit ?? 10),
      String(input.area ?? "Sacramento, CA"), Number(input.radiusMiles ?? 5),
      String(input.category ?? "All local businesses"), Number(input.minReviews ?? 10), new Date().toISOString()).run();
}

export async function listDailyRecipients() {
  const db = await getD1();
  const result = await db.prepare("SELECT owner, delivery_email, daily_limit FROM settings WHERE delivery_email <> ''").all();
  return result.results.map((row) => ({
    owner: String(row.owner),
    email: String(row.delivery_email),
    limit: Math.max(1, Math.min(50, Number(row.daily_limit))),
  }));
}

function toBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function vaultKey() {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) throw new Error("Credential vault is not initialized");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.CREDENTIAL_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function setCredential(owner: string, service: "googlePlaces" | "resend", secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultKey(), new TextEncoder().encode(secret));
  const db = await getD1();
  await db.prepare(`INSERT INTO api_credentials (owner, service, ciphertext, iv, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(owner, service) DO UPDATE SET ciphertext=excluded.ciphertext, iv=excluded.iv, updated_at=excluded.updated_at`)
    .bind(owner, service, toBase64(new Uint8Array(encrypted)), toBase64(iv), new Date().toISOString()).run();
}

export async function getCredential(owner: string, service: "googlePlaces" | "resend") {
  const db = await getD1();
  const row = await db.prepare("SELECT ciphertext, iv FROM api_credentials WHERE owner = ? AND service = ?").bind(owner, service).first();
  if (!row) return null;
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(String(row.iv)) },
    await vaultKey(),
    fromBase64(String(row.ciphertext)),
  );
  return new TextDecoder().decode(decrypted);
}

export async function hasCredential(owner: string, service: "googlePlaces" | "resend") {
  const db = await getD1();
  const row = await db.prepare("SELECT 1 AS present FROM api_credentials WHERE owner = ? AND service = ?").bind(owner, service).first();
  return Boolean(row);
}
