import { and, desc, eq, inArray } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import * as sharedSchemaNs from "../../shared/schema";
//import type { InsertUser, User } from "../../shared/schema";


const sharedSchema = (
  (sharedSchemaNs as unknown as { default?: typeof import("../../shared/schema") }).default ??
  sharedSchemaNs
) as typeof import("../../shared/schema");

import * as sharedSchemaModule from "@shared/schema";
import type { InsertUser, User } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";

//const sharedSchema = ((sharedSchemaModule as { default?: typeof sharedSchemaModule }).default ?? sharedSchemaModule) as typeof sharedSchemaModule;
const {
  areaDemographics,
  businessProfiles,
  candidateSites,
  dbInsertBusinessProfileSchema,
  dbInsertCandidateSiteSchema,
  dbInsertUserSchema,
  siteScores,
  users,
} = sharedSchema;

// Legacy alias import (kept for rollback/debugging):
// import {
//   areaDemographics,
//   businessProfiles,
//   candidateSites,
//   dbInsertBusinessProfileSchema,
//   dbInsertCandidateSiteSchema,
//   dbInsertUserSchema,
//   siteScores,
//   users,
//   type InsertUser,
//   type User,
// } from "@shared/schema";

// Legacy direct relative named import (kept for rollback/debugging):
// import {
//   areaDemographics,
//   businessProfiles,
//   candidateSites,
//   dbInsertBusinessProfileSchema,
//   dbInsertCandidateSiteSchema,
//   dbInsertUserSchema,
//   siteScores,
//   users,
//   type InsertUser,
//   type User,
// } from "../../shared/schema";

type CandidateSiteRecord = {
  id: string;
  userId: string | null;
  profileId: string | null;
  name: string;
  address: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  planningAreaId: string | null;
  composite: number | null;
  demographic: number | null;
  accessibility: number | null;
  rental: number | null;
  competition: number | null;
  savedAt: string;
  notes?: string;
};

type SaveCandidateSiteInput = {
  userId: string;
  profileId?: string;
  name: string;
  address: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  planningAreaId?: string;
  composite: number;
  demographic: number;
  accessibility: number;
  rental: number;
  competition: number;
  notes?: string;
  scoreNotes?: string;
  breakdownDetailsJson?: Record<string, unknown>;
};

type BusinessProfileRecord = {
  id: string;
  userId: string;
  name: string;
  sector: string;
  priceBand: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type CreateBusinessProfileInput = {
  userId: string;
  name: string;
  sector: string;
  priceBand: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
};

type UpdateBusinessProfileInput = {
  name: string;
  sector: string;
  priceBand: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
};

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Business profile management
  getBusinessProfiles(userId: string): Promise<BusinessProfileRecord[]>;
  createBusinessProfile(input: CreateBusinessProfileInput): Promise<BusinessProfileRecord>;
  updateBusinessProfile(profileId: string, userId: string, input: UpdateBusinessProfileInput): Promise<BusinessProfileRecord | null>;
  deleteBusinessProfile(profileId: string, userId: string): Promise<void>;
  setActiveBusinessProfile(profileId: string, userId: string): Promise<void>;

  // Site Portfolio Management
  getCandidateSites(userId: string): Promise<CandidateSiteRecord[]>;
  saveCandidateSite(siteData: SaveCandidateSiteInput): Promise<CandidateSiteRecord>;
  deleteCandidateSite(siteId: string, userId: string): Promise<void>;
  
  // Demographics / Scoring
  getAreaDemographics(planningAreaId: string): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private profiles: Map<string, BusinessProfileRecord>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getBusinessProfiles(userId: string): Promise<BusinessProfileRecord[]> {
    return Array.from(this.profiles.values())
      .filter((profile) => profile.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createBusinessProfile(input: CreateBusinessProfileInput): Promise<BusinessProfileRecord> {
    const id = randomUUID();
    // TS-safe iteration for current compiler target settings.
    for (const profile of Array.from(this.profiles.values())) {
      if (profile.userId === input.userId) {
        profile.active = false;
      }
    }

    /*
    Legacy iteration (may require downlevelIteration or higher target):
    for (const profile of this.profiles.values()) {
      if (profile.userId === input.userId) {
        profile.active = false;
      }
    }
    */

    const now = new Date().toISOString();
    const profile: BusinessProfileRecord = {
      id,
      userId: input.userId,
      name: input.name,
      sector: input.sector,
      priceBand: input.priceBand,
      ageGroups: input.ageGroups,
      incomeBands: input.incomeBands,
      operatingModel: input.operatingModel,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(id, profile);
    return profile;
  }

  async updateBusinessProfile(profileId: string, userId: string, input: UpdateBusinessProfileInput): Promise<BusinessProfileRecord | null> {
    const existing = this.profiles.get(profileId);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: BusinessProfileRecord = {
      ...existing,
      name: input.name,
      sector: input.sector,
      priceBand: input.priceBand,
      ageGroups: input.ageGroups,
      incomeBands: input.incomeBands,
      operatingModel: input.operatingModel,
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(profileId, updated);
    return updated;
  }

  async deleteBusinessProfile(profileId: string, userId: string): Promise<void> {
    const existing = this.profiles.get(profileId);
    if (!existing || existing.userId !== userId) {
      return;
    }

    this.profiles.delete(profileId);
  }

  async setActiveBusinessProfile(profileId: string, userId: string): Promise<void> {
    // TS-safe iteration for current compiler target settings.
    for (const [id, profile] of Array.from(this.profiles.entries())) {
      if (profile.userId === userId) {
        this.profiles.set(id, { ...profile, active: id === profileId, updatedAt: new Date().toISOString() });
      }
    }

    /*
    Legacy iteration (may require downlevelIteration or higher target):
    for (const [id, profile] of this.profiles.entries()) {
      if (profile.userId === userId) {
        this.profiles.set(id, { ...profile, active: id === profileId, updatedAt: new Date().toISOString() });
      }
    }
    */
  }

  // Mock implementation for Sites
  async getCandidateSites(userId: string): Promise<CandidateSiteRecord[]> {
    return [];
  }

  async saveCandidateSite(siteData: SaveCandidateSiteInput): Promise<CandidateSiteRecord> {
    const id = randomUUID();
    return {
      ...siteData,
      id,
      profileId: siteData.profileId ?? null,
      postalCode: siteData.postalCode ?? null,
      lat: siteData.lat ?? null,
      lng: siteData.lng ?? null,
      planningAreaId: siteData.planningAreaId ?? null,
      notes: siteData.notes,
      savedAt: new Date().toISOString(),
    };
  }

  async deleteCandidateSite(siteId: string, userId: string): Promise<void> {
    // mock delete
  }

  async getAreaDemographics(planningAreaId: string): Promise<any> {
    return null;
  }
}

function parseNumeric(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatSavedAt(value: Date | string | null): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toCandidateSiteRecord(row: {
  site: typeof candidateSites.$inferSelect;
  score: typeof siteScores.$inferSelect | null;
}): CandidateSiteRecord {
  return {
    id: row.site.id,
    userId: row.site.userId,
    profileId: row.site.profileId,
    name: row.site.siteName,
    address: row.site.addressLabel ?? "",
    postalCode: row.site.postalCode,
    lat: parseNumeric(row.site.lat),
    lng: parseNumeric(row.site.lng),
    planningAreaId: row.site.planningAreaId,
    composite: parseNumeric(row.score?.compositeScore ?? null),
    demographic: parseNumeric(row.score?.demographicScore ?? null),
    accessibility: parseNumeric(row.score?.accessibilityScore ?? null),
    rental: parseNumeric(row.score?.rentalPressureScore ?? null),
    competition: parseNumeric(row.score?.competitionScore ?? null),
    savedAt: formatSavedAt(row.site.savedAt),
    notes: row.site.notes ?? undefined,
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toBusinessProfileRecord(row: typeof businessProfiles.$inferSelect): BusinessProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.businessName,
    sector: row.sector,
    priceBand: row.priceBand,
    ageGroups: toStringArray(row.targetAgeGroupsJson),
    incomeBands: toStringArray(row.targetIncomeBandsJson),
    operatingModel: row.operatingModel,
    active: row.isActive === 1,
    createdAt: formatSavedAt(row.createdAt),
    updatedAt: formatSavedAt(row.updatedAt),
  };
}

type SupabaseBusinessProfileRow = {
  id: string;
  user_id: string;
  business_name: string;
  sector: string;
  price_band: string;
  target_age_groups_json: string[] | null;
  target_income_bands_json: string[] | null;
  operating_model: string;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
};

function toBusinessProfileRecordFromSupabase(row: SupabaseBusinessProfileRow): BusinessProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.business_name,
    sector: row.sector,
    priceBand: row.price_band,
    ageGroups: toStringArray(row.target_age_groups_json),
    incomeBands: toStringArray(row.target_income_bands_json),
    operatingModel: row.operating_model,
    active: row.is_active === 1,
    createdAt: formatSavedAt(row.created_at),
    updatedAt: formatSavedAt(row.updated_at),
  };
}

export class DatabaseStorage implements IStorage {
  private readonly useHttpProfileFallback =
    (process.env.SUPABASE_USE_HTTP_FALLBACK?.trim() ?? "true") === "true";

  private readonly supabase = this.createSupabaseClient();

  private createSupabaseClient() {
    const url = process.env.VITE_SUPABASE_URL?.trim();
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.VITE_SUPABASE_ANON_KEY?.trim();

    if (!url || !key) {
      return null;
    }

    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  private requireSupabaseClient() {
    if (!this.supabase) {
      throw new Error(
        "SUPABASE_USE_HTTP_FALLBACK is enabled, but VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are missing.",
      );
    }

    return this.supabase;
  }

  private async ensureUserExistsViaSupabase(userId: string): Promise<void> {
    const supabase = this.requireSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return;
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: userId,
      username: `user_${userId}`,
      password: "managed-by-supabase-auth",
    });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }
  }

  private async getBusinessProfilesViaSupabase(userId: string): Promise<BusinessProfileRecord[]> {
    const supabase = this.requireSupabaseClient();
    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => toBusinessProfileRecordFromSupabase(row as SupabaseBusinessProfileRow));
  }

  private async createBusinessProfileViaSupabase(input: CreateBusinessProfileInput): Promise<BusinessProfileRecord> {
    const supabase = this.requireSupabaseClient();
    await this.ensureUserExistsViaSupabase(input.userId);

    const { error: deactivateError } = await supabase
      .from("business_profiles")
      .update({ is_active: 0 })
      .eq("user_id", input.userId);

    if (deactivateError) {
      throw deactivateError;
    }

    const { data, error } = await supabase
      .from("business_profiles")
      .insert({
        user_id: input.userId,
        business_name: input.name,
        sector: input.sector,
        price_band: input.priceBand,
        target_age_groups_json: input.ageGroups,
        target_income_bands_json: input.incomeBands,
        operating_model: input.operatingModel,
        is_active: 1,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toBusinessProfileRecordFromSupabase(data as SupabaseBusinessProfileRow);
  }

  private async updateBusinessProfileViaSupabase(
    profileId: string,
    userId: string,
    input: UpdateBusinessProfileInput,
  ): Promise<BusinessProfileRecord | null> {
    const supabase = this.requireSupabaseClient();
    const { data, error } = await supabase
      .from("business_profiles")
      .update({
        business_name: input.name,
        sector: input.sector,
        price_band: input.priceBand,
        target_age_groups_json: input.ageGroups,
        target_income_bands_json: input.incomeBands,
        operating_model: input.operatingModel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toBusinessProfileRecordFromSupabase(data as SupabaseBusinessProfileRow) : null;
  }

  private async deleteBusinessProfileViaSupabase(profileId: string, userId: string): Promise<void> {
    const supabase = this.requireSupabaseClient();
    const { error } = await supabase
      .from("business_profiles")
      .delete()
      .eq("id", profileId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  private async setActiveBusinessProfileViaSupabase(profileId: string, userId: string): Promise<void> {
    const supabase = this.requireSupabaseClient();

    const { error: deactivateError } = await supabase
      .from("business_profiles")
      .update({ is_active: 0 })
      .eq("user_id", userId);

    if (deactivateError) {
      throw deactivateError;
    }

    const { error: activateError } = await supabase
      .from("business_profiles")
      .update({
        is_active: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("user_id", userId);

    if (activateError) {
      throw activateError;
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (existing) {
      return;
    }

    await db.insert(users).values({
      id: userId,
      username: `user_${userId}`,
      password: "managed-by-supabase-auth",
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const payload = dbInsertUserSchema.parse(insertUser);
    const [user] = await db.insert(users).values(payload).returning();
    return user;
  }

  async getBusinessProfiles(userId: string): Promise<BusinessProfileRecord[]> {
    if (this.useHttpProfileFallback) {
      return this.getBusinessProfilesViaSupabase(userId);
    }

    // Legacy direct-postgres path (kept for rollback/debugging):
    // return await db
    //   .select()
    //   .from(businessProfiles)
    //   .where(eq(businessProfiles.userId, userId))
    //   .orderBy(desc(businessProfiles.updatedAt))
    //   .then((rows) => rows.map(toBusinessProfileRecord));

    const rows = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .orderBy(desc(businessProfiles.updatedAt));

    return rows.map(toBusinessProfileRecord);
  }

  async createBusinessProfile(input: CreateBusinessProfileInput): Promise<BusinessProfileRecord> {
    if (this.useHttpProfileFallback) {
      return this.createBusinessProfileViaSupabase(input);
    }

    await this.ensureUserExists(input.userId);
    await db
      .update(businessProfiles)
      .set({ isActive: 0 })
      .where(eq(businessProfiles.userId, input.userId));

    const payload = dbInsertBusinessProfileSchema.parse({
      userId: input.userId,
      businessName: input.name,
      sector: input.sector,
      priceBand: input.priceBand,
      targetAgeGroupsJson: input.ageGroups,
      targetIncomeBandsJson: input.incomeBands,
      operatingModel: input.operatingModel,
      isActive: 1,
    });

    const [created] = await db.insert(businessProfiles).values(payload).returning();
    return toBusinessProfileRecord(created);
  }

  async updateBusinessProfile(profileId: string, userId: string, input: UpdateBusinessProfileInput): Promise<BusinessProfileRecord | null> {
    if (this.useHttpProfileFallback) {
      return this.updateBusinessProfileViaSupabase(profileId, userId, input);
    }

    const [updated] = await db
      .update(businessProfiles)
      .set({
        businessName: input.name,
        sector: input.sector,
        priceBand: input.priceBand,
        targetAgeGroupsJson: input.ageGroups,
        targetIncomeBandsJson: input.incomeBands,
        operatingModel: input.operatingModel,
        updatedAt: new Date(),
      })
      .where(and(eq(businessProfiles.id, profileId), eq(businessProfiles.userId, userId)))
      .returning();

    if (!updated) {
      return null;
    }

    return toBusinessProfileRecord(updated);
  }

  async deleteBusinessProfile(profileId: string, userId: string): Promise<void> {
    if (this.useHttpProfileFallback) {
      await this.deleteBusinessProfileViaSupabase(profileId, userId);
      return;
    }

    const sitesToDelete = await db
      .select({
        siteId: candidateSites.id,
        scoreId: candidateSites.savedSiteScoreId,
      })
      .from(candidateSites)
      .where(and(eq(candidateSites.userId, userId), eq(candidateSites.profileId, profileId)));

    if (sitesToDelete.length > 0) {
      const siteIds = sitesToDelete.map((row) => row.siteId);
      await db.delete(candidateSites).where(inArray(candidateSites.id, siteIds));

      const scoreIds = sitesToDelete
        .map((row) => row.scoreId)
        .filter((scoreId): scoreId is string => Boolean(scoreId));

      if (scoreIds.length > 0) {
        await db.delete(siteScores).where(inArray(siteScores.id, scoreIds));
      }
    }

    await db
      .delete(businessProfiles)
      .where(and(eq(businessProfiles.id, profileId), eq(businessProfiles.userId, userId)));
  }

  async setActiveBusinessProfile(profileId: string, userId: string): Promise<void> {
    if (this.useHttpProfileFallback) {
      await this.setActiveBusinessProfileViaSupabase(profileId, userId);
      return;
    }

    await db
      .update(businessProfiles)
      .set({ isActive: 0 })
      .where(eq(businessProfiles.userId, userId));

    await db
      .update(businessProfiles)
      .set({ isActive: 1, updatedAt: new Date() })
      .where(and(eq(businessProfiles.id, profileId), eq(businessProfiles.userId, userId)));
  }

  async getCandidateSites(userId: string): Promise<CandidateSiteRecord[]> {
    const rows = await db
      .select({
        site: candidateSites,
        score: siteScores,
      })
      .from(candidateSites)
      .leftJoin(siteScores, eq(candidateSites.savedSiteScoreId, siteScores.id))
      .where(eq(candidateSites.userId, userId))
      .orderBy(desc(candidateSites.savedAt));

    return rows.map(toCandidateSiteRecord);
  }

  async saveCandidateSite(siteData: SaveCandidateSiteInput): Promise<CandidateSiteRecord> {
    const [score] = await db
      .insert(siteScores)
      .values({
        compositeScore: siteData.composite.toString(),
        demographicScore: siteData.demographic.toString(),
        accessibilityScore: siteData.accessibility.toString(),
        rentalPressureScore: siteData.rental.toString(),
        competitionScore: siteData.competition.toString(),
        breakdownDetailsJson: siteData.breakdownDetailsJson,
        notes: siteData.scoreNotes,
      })
      .returning();

    const candidatePayload = dbInsertCandidateSiteSchema.parse({
      userId: siteData.userId,
      profileId: siteData.profileId,
      siteName: siteData.name,
      addressLabel: siteData.address,
      postalCode: siteData.postalCode,
      lat: siteData.lat !== undefined ? siteData.lat.toString() : undefined,
      lng: siteData.lng !== undefined ? siteData.lng.toString() : undefined,
      planningAreaId: siteData.planningAreaId,
      savedSiteScoreId: score.id,
      notes: siteData.notes,
    });

    const [site] = await db.insert(candidateSites).values(candidatePayload).returning();

    return toCandidateSiteRecord({ site, score });
  }

  async deleteCandidateSite(siteId: string, userId: string): Promise<void> {
    const [existing] = await db
      .select({
        siteId: candidateSites.id,
        scoreId: candidateSites.savedSiteScoreId,
      })
      .from(candidateSites)
      .where(and(eq(candidateSites.id, siteId), eq(candidateSites.userId, userId)))
      .limit(1);

    if (!existing) {
      return;
    }

    await db.delete(candidateSites).where(eq(candidateSites.id, existing.siteId));

    if (existing.scoreId) {
      await db.delete(siteScores).where(eq(siteScores.id, existing.scoreId));
    }
  }

  async getAreaDemographics(planningAreaId: string): Promise<any> {
    const [demographics] = await db
      .select()
      .from(areaDemographics)
      .where(eq(areaDemographics.planningAreaId, planningAreaId))
      .orderBy(desc(areaDemographics.effectiveYear))
      .limit(1);

    return demographics ?? null;
  }
}

export const storage = new DatabaseStorage();
