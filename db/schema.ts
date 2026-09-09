import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: text("id").notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  area: text("area").notNull(),
  rating: real("rating").notNull(),
  reviews: integer("reviews").notNull(),
  issue: text("issue").notNull(),
  score: integer("score").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  website: text("website"),
  mapsUrl: text("maps_url"),
  reason: text("reason").notNull(),
  stage: text("stage").notNull().default("New"),
  isSaved: integer("is_saved").notNull().default(0),
  inDiscovery: integer("in_discovery").notNull().default(1),
  isDismissed: integer("is_dismissed").notNull().default(0),
  siteBuilt: integer("site_built").notNull().default(0),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.id, table.owner] }),
  index("leads_owner_score_idx").on(table.owner, table.score),
]);

export const settings = sqliteTable("settings", {
  owner: text("owner").primaryKey(),
  deliveryEmail: text("delivery_email").notNull().default(""),
  deliveryHour: integer("delivery_hour").notNull().default(8),
  dailyLimit: integer("daily_limit").notNull().default(10),
  area: text("area").notNull().default("Sacramento, CA"),
  radiusMiles: integer("radius_miles").notNull().default(5),
  category: text("category").notNull().default("All local businesses"),
  minReviews: integer("min_reviews").notNull().default(10),
  updatedAt: text("updated_at").notNull(),
});

export const apiCredentials = sqliteTable("api_credentials", {
  owner: text("owner").notNull(),
  service: text("service").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.service] }),
]);
