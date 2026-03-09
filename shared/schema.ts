import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const planningAreas = pgTable("planning_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  areaName: varchar("area_name", { length: 80 }).notNull(),
  areaCode: varchar("area_code", { length: 16 }).notNull().unique(),
  regionName: varchar("region_name", { length: 40 }),
  geometryGeojson: text("geometry_geojson"),
  centroidLat: decimal("centroid_lat", { precision: 9, scale: 6 }),
  centroidLng: decimal("centroid_lng", { precision: 9, scale: 6 }),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
});

export const areaDemographics = pgTable("area_demographics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningAreaId: varchar("planning_area_id").references(() => planningAreas.id),
  effectiveYear: integer("effective_year").notNull(),
  populationTotal: integer("population_total"),
  ageDistributionJson: jsonb("age_distribution_json"),
  incomeDistributionJson: jsonb("income_distribution_json"),
  householdSizeJson: jsonb("household_size_json"),
  householdStructureJson: jsonb("household_structure_json"),
  economicStatusJson: jsonb("economic_status_json"),
  ingestedAt: timestamp("ingested_at").defaultNow(),
});

export const siteScores = pgTable("site_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  compositeScore: decimal("composite_score", { precision: 6, scale: 2 }),
  demographicScore: decimal("demographic_score", { precision: 6, scale: 2 }),
  accessibilityScore: decimal("accessibility_score", { precision: 6, scale: 2 }),
  rentalPressureScore: decimal("rental_pressure_score", { precision: 6, scale: 2 }),
  competitionScore: decimal("competition_score", { precision: 6, scale: 2 }),
  computedAt: timestamp("computed_at").defaultNow(),
  breakdownDetailsJson: jsonb("breakdown_details_json"),
});

export const candidateSites = pgTable("candidate_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Using existing users table
  profileId: varchar("profile_id"), // Referencing business profiles (mocked/future)
  siteName: varchar("site_name", { length: 80 }).notNull(),
  addressLabel: varchar("address_label", { length: 160 }),
  postalCode: varchar("postal_code", { length: 16 }),
  lat: decimal("lat", { precision: 9, scale: 6 }),
  lng: decimal("lng", { precision: 9, scale: 6 }),
  planningAreaId: varchar("planning_area_id").references(() => planningAreas.id),
  savedSiteScoreId: varchar("saved_site_score_id").references(() => siteScores.id), // Snapshotted score
  notes: text("notes"),
  savedAt: timestamp("saved_at").defaultNow(),
});

export const dbInsertCandidateSiteSchema = createInsertSchema(candidateSites).omit({
  id: true,
  savedAt: true,
});

export const dbInsertUserSchema = insertUserSchema;

export type InsertCandidateSiteRow = z.infer<typeof dbInsertCandidateSiteSchema>;
export type CandidateSiteRow = typeof candidateSites.$inferSelect;
export type SiteScoreRow = typeof siteScores.$inferSelect;
