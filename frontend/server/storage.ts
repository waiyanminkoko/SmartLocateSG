import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  planningAreas,
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
  breakdownDetailsJson?: Record<string, unknown> | null;
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

type UpdateCandidateSiteInput = {
  name: string;
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

type ChatbotPageContextInput = {
  page?: string;
  profile?: {
    sector?: string;
  };
  location?: {
    address?: string;
    planningArea?: string;
  };
  hiddenContext?: Record<string, unknown>;
};

type ChatbotPublicKnowledgeInput = {
  message: string;
  pageContext?: ChatbotPageContextInput;
  maxAreas?: number;
};

type ChatbotPublicKnowledge = {
  matchedPlanningAreas: Array<{
    id: string;
    areaName: string;
    regionName: string | null;
  }>;
  latestAreaDemographics: Array<{
    areaName: string;
    effectiveYear: number;
    populationTotal: number | null;
    ageDistribution: unknown;
    incomeDistribution: unknown;
    householdSize: unknown;
    householdStructure: unknown;
    economicStatus: unknown;
  }>;
  latestEconomicStatus: Array<{
    areaName: string;
    year: number;
    employed: number;
    inactive: number;
    unemployed: number;
  }>;
  latestHouseholdIncome: Array<{
    areaName: string;
    year: number;
    total: number;
    sgd8000Over: number;
    sgd10000Over: number;
    noWorkingPerson: number;
  }>;
  competitionCategoryCounts: Array<{
    category: string;
    count: number;
  }>;
  transitNetwork: {
    busStops: number | null;
    mrtExits: number | null;
  };
  retrievalNotes: string[];
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
  updateCandidateSite(siteId: string, userId: string, input: UpdateCandidateSiteInput): Promise<CandidateSiteRecord | null>;
  deleteCandidateSite(siteId: string, userId: string): Promise<void>;
  
  // Demographics / Scoring
  getAreaDemographics(planningAreaId: string): Promise<any>;

  // Chatbot retrieval augmentation
  getChatbotPublicKnowledge(input: ChatbotPublicKnowledgeInput): Promise<ChatbotPublicKnowledge>;
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
      breakdownDetailsJson: siteData.breakdownDetailsJson ?? null,
      savedAt: new Date().toISOString(),
    };
  }

  async updateCandidateSite(siteId: string, userId: string, input: UpdateCandidateSiteInput): Promise<CandidateSiteRecord | null> {
    void siteId;
    void userId;
    void input;
    return null;
  }

  async deleteCandidateSite(siteId: string, userId: string): Promise<void> {
    // mock delete
  }

  async getAreaDemographics(planningAreaId: string): Promise<any> {
    return null;
  }

  async getChatbotPublicKnowledge(_input: ChatbotPublicKnowledgeInput): Promise<ChatbotPublicKnowledge> {
    return {
      matchedPlanningAreas: [],
      latestAreaDemographics: [],
      latestEconomicStatus: [],
      latestHouseholdIncome: [],
      competitionCategoryCounts: [],
      transitNetwork: {
        busStops: null,
        mrtExits: null,
      },
      retrievalNotes: [
        "Running in in-memory storage mode. Public Supabase retrieval is unavailable.",
      ],
    };
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
    breakdownDetailsJson: (row.score?.breakdownDetailsJson as Record<string, unknown> | null | undefined) ?? null,
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedString(
  source: Record<string, unknown> | undefined,
  ...path: string[]
): string | undefined {
  if (!source) {
    return undefined;
  }

  let cursor: unknown = source;
  for (const segment of path) {
    if (!isObjectRecord(cursor) || !(segment in cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }

  return typeof cursor === "string" && cursor.trim().length > 0 ? cursor.trim() : undefined;
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

type SupabaseCandidateSiteRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  site_name: string;
  address_label: string | null;
  postal_code: string | null;
  lat: string | number | null;
  lng: string | number | null;
  planning_area_id: string | null;
  saved_site_score_id: string | null;
  notes: string | null;
  saved_at: string | null;
};

type SupabaseSiteScoreRow = {
  id: string;
  composite_score: string | number | null;
  demographic_score: string | number | null;
  accessibility_score: string | number | null;
  rental_pressure_score: string | number | null;
  competition_score: string | number | null;
  breakdown_details_json: Record<string, unknown> | null;
  notes: string | null;
};

function toCandidateSiteRecordFromSupabase(
  site: SupabaseCandidateSiteRow,
  score?: SupabaseSiteScoreRow | null,
): CandidateSiteRecord {
  return {
    id: site.id,
    userId: site.user_id,
    profileId: site.profile_id,
    name: site.site_name,
    address: site.address_label ?? "",
    postalCode: site.postal_code,
    lat: parseNumeric(site.lat),
    lng: parseNumeric(site.lng),
    planningAreaId: site.planning_area_id,
    composite: parseNumeric(score?.composite_score ?? null),
    demographic: parseNumeric(score?.demographic_score ?? null),
    accessibility: parseNumeric(score?.accessibility_score ?? null),
    rental: parseNumeric(score?.rental_pressure_score ?? null),
    competition: parseNumeric(score?.competition_score ?? null),
    savedAt: formatSavedAt(site.saved_at),
    notes: site.notes ?? score?.notes ?? undefined,
    breakdownDetailsJson: score?.breakdown_details_json ?? null,
  };
}

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

    // Delete linked candidate sites first, then score snapshots, before deleting profile.
    const { data: linkedSites, error: linkedSitesError } = await supabase
      .from("candidate_sites")
      .select("id, saved_site_score_id")
      .eq("user_id", userId)
      .eq("profile_id", profileId);

    if (linkedSitesError) {
      throw linkedSitesError;
    }

    const siteIds = (linkedSites ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (siteIds.length > 0) {
      const { error: deleteSitesError } = await supabase
        .from("candidate_sites")
        .delete()
        .in("id", siteIds);

      if (deleteSitesError) {
        throw deleteSitesError;
      }
    }

    const scoreIds = (linkedSites ?? [])
      .map((row) => row.saved_site_score_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (scoreIds.length > 0) {
      const { error: deleteScoresError } = await supabase
        .from("site_scores")
        .delete()
        .in("id", scoreIds);

      if (deleteScoresError) {
        throw deleteScoresError;
      }
    }

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

  private async getCandidateSitesViaSupabase(userId: string): Promise<CandidateSiteRecord[]> {
    const supabase = this.requireSupabaseClient();
    const { data: sitesData, error: sitesError } = await supabase
      .from("candidate_sites")
      .select("*")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });

    if (sitesError) {
      throw sitesError;
    }

    const sites = (sitesData ?? []) as SupabaseCandidateSiteRow[];
    const scoreIds = sites
      .map((site) => site.saved_site_score_id)
      .filter((scoreId): scoreId is string => typeof scoreId === "string" && scoreId.length > 0);

    const scoreMap = new Map<string, SupabaseSiteScoreRow>();
    if (scoreIds.length > 0) {
      const { data: scoresData, error: scoresError } = await supabase
        .from("site_scores")
        .select("id, composite_score, demographic_score, accessibility_score, rental_pressure_score, competition_score, breakdown_details_json, notes")
        .in("id", scoreIds);

      if (scoresError) {
        throw scoresError;
      }

      for (const score of (scoresData ?? []) as SupabaseSiteScoreRow[]) {
        scoreMap.set(score.id, score);
      }
    }

    return sites.map((site) =>
      toCandidateSiteRecordFromSupabase(
        site,
        site.saved_site_score_id ? scoreMap.get(site.saved_site_score_id) : undefined,
      ),
    );
  }

  private normalizePlanningAreaToken(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  }

  private async resolvePlanningAreaIdViaSupabase(planningAreaValue?: string): Promise<string | null> {
    if (!planningAreaValue) {
      return null;
    }

    const raw = planningAreaValue.trim();
    if (!raw) {
      return null;
    }

    const supabase = this.requireSupabaseClient();
    const normalized = this.normalizePlanningAreaToken(raw);

    const { data: byId, error: byIdError } = await supabase
      .from("planning_areas")
      .select("id")
      .eq("id", raw)
      .maybeSingle();

    if (byIdError) {
      throw byIdError;
    }

    if (byId?.id) {
      return byId.id as string;
    }

    const codeCandidates = Array.from(new Set([raw, normalized].filter((value) => value.length > 0)));
    if (codeCandidates.length > 0) {
      const { data: byCode, error: byCodeError } = await supabase
        .from("planning_areas")
        .select("id")
        .in("area_code", codeCandidates)
        .limit(1)
        .maybeSingle();

      if (byCodeError) {
        throw byCodeError;
      }

      if (byCode?.id) {
        return byCode.id as string;
      }
    }

    const { data: byName, error: byNameError } = await supabase
      .from("planning_areas")
      .select("id")
      .ilike("area_name", raw)
      .limit(1)
      .maybeSingle();

    if (byNameError) {
      throw byNameError;
    }

    return byName?.id ? (byName.id as string) : null;
  }

  private async resolvePlanningAreaIdViaDb(planningAreaValue?: string): Promise<string | null> {
    if (!planningAreaValue) {
      return null;
    }

    const raw = planningAreaValue.trim();
    if (!raw) {
      return null;
    }

    const normalized = this.normalizePlanningAreaToken(raw);

    const [byId] = await db
      .select({ id: planningAreas.id })
      .from(planningAreas)
      .where(eq(planningAreas.id, raw))
      .limit(1);

    if (byId?.id) {
      return byId.id;
    }

    const codeCandidates = Array.from(new Set([raw, normalized].filter((value) => value.length > 0)));
    if (codeCandidates.length > 0) {
      const [byCode] = await db
        .select({ id: planningAreas.id })
        .from(planningAreas)
        .where(inArray(planningAreas.areaCode, codeCandidates))
        .limit(1);

      if (byCode?.id) {
        return byCode.id;
      }
    }

    const [byName] = await db
      .select({ id: planningAreas.id })
      .from(planningAreas)
      .where(sql`lower(${planningAreas.areaName}) = lower(${raw})`)
      .limit(1);

    return byName?.id ?? null;
  }

  private async saveCandidateSiteViaSupabase(siteData: SaveCandidateSiteInput): Promise<CandidateSiteRecord> {
    const supabase = this.requireSupabaseClient();
    await this.ensureUserExistsViaSupabase(siteData.userId);
    const resolvedPlanningAreaId = await this.resolvePlanningAreaIdViaSupabase(siteData.planningAreaId);

    const { data: insertedScore, error: scoreError } = await supabase
      .from("site_scores")
      .insert({
        composite_score: siteData.composite,
        demographic_score: siteData.demographic,
        accessibility_score: siteData.accessibility,
        rental_pressure_score: siteData.rental,
        competition_score: siteData.competition,
        breakdown_details_json: siteData.breakdownDetailsJson,
        notes: siteData.scoreNotes,
      })
      .select("id, composite_score, demographic_score, accessibility_score, rental_pressure_score, competition_score, breakdown_details_json, notes")
      .single();

    if (scoreError) {
      throw scoreError;
    }

    const score = insertedScore as SupabaseSiteScoreRow;

    const { data: insertedSite, error: siteError } = await supabase
      .from("candidate_sites")
      .insert({
        user_id: siteData.userId,
        profile_id: siteData.profileId ?? null,
        site_name: siteData.name,
        address_label: siteData.address,
        postal_code: siteData.postalCode ?? null,
        lat: siteData.lat ?? null,
        lng: siteData.lng ?? null,
        planning_area_id: resolvedPlanningAreaId,
        saved_site_score_id: score.id,
        notes: siteData.notes,
      })
      .select("*")
      .single();

    if (siteError) {
      throw siteError;
    }

    const site = insertedSite as SupabaseCandidateSiteRow;
    return toCandidateSiteRecordFromSupabase(site, score);
  }

  private async updateCandidateSiteViaSupabase(
    siteId: string,
    userId: string,
    input: UpdateCandidateSiteInput,
  ): Promise<CandidateSiteRecord | null> {
    const supabase = this.requireSupabaseClient();
    const { data: updatedSite, error: siteError } = await supabase
      .from("candidate_sites")
      .update({
        site_name: input.name,
      })
      .eq("id", siteId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (siteError) {
      throw siteError;
    }

    if (!updatedSite) {
      return null;
    }

    const site = updatedSite as SupabaseCandidateSiteRow;
    let score: SupabaseSiteScoreRow | null = null;
    if (site.saved_site_score_id) {
      const { data: scoreData, error: scoreError } = await supabase
        .from("site_scores")
        .select("id, composite_score, demographic_score, accessibility_score, rental_pressure_score, competition_score, breakdown_details_json, notes")
        .eq("id", site.saved_site_score_id)
        .maybeSingle();

      if (scoreError) {
        throw scoreError;
      }

      score = (scoreData as SupabaseSiteScoreRow | null) ?? null;
    }

    return toCandidateSiteRecordFromSupabase(site, score);
  }

  private async deleteCandidateSiteViaSupabase(siteId: string, userId: string): Promise<void> {
    const supabase = this.requireSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from("candidate_sites")
      .select("id, saved_site_score_id")
      .eq("id", siteId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return;
    }

    const scoreId = existing.saved_site_score_id as string | null;

    const { error: deleteSiteError } = await supabase
      .from("candidate_sites")
      .delete()
      .eq("id", siteId)
      .eq("user_id", userId);

    if (deleteSiteError) {
      throw deleteSiteError;
    }

    if (!scoreId) {
      return;
    }

    const { data: stillReferenced, error: referenceError } = await supabase
      .from("candidate_sites")
      .select("id")
      .eq("saved_site_score_id", scoreId)
      .limit(1)
      .maybeSingle();

    if (referenceError) {
      throw referenceError;
    }

    if (!stillReferenced) {
      const { error: deleteScoreError } = await supabase
        .from("site_scores")
        .delete()
        .eq("id", scoreId);

      if (deleteScoreError) {
        throw deleteScoreError;
      }
    }
  }

  async getChatbotPublicKnowledge(input: ChatbotPublicKnowledgeInput): Promise<ChatbotPublicKnowledge> {
    const emptyResult: ChatbotPublicKnowledge = {
      matchedPlanningAreas: [],
      latestAreaDemographics: [],
      latestEconomicStatus: [],
      latestHouseholdIncome: [],
      competitionCategoryCounts: [],
      transitNetwork: {
        busStops: null,
        mrtExits: null,
      },
      retrievalNotes: [],
    };

    if (!this.supabase) {
      return {
        ...emptyResult,
        retrievalNotes: [
          "Supabase client is not configured. Public database retrieval was skipped.",
        ],
      };
    }

    const supabase = this.supabase;
    const maxAreas = Math.max(1, Math.min(input.maxAreas ?? 3, 8));
    const question = input.message.toLowerCase();

    const { data: planningAreaRows, error: planningAreaError } = await supabase
      .from("planning_areas")
      .select("id, area_name, region_name")
      .limit(200);

    if (planningAreaError) {
      return {
        ...emptyResult,
        retrievalNotes: [
          "Failed to retrieve planning areas from Supabase.",
        ],
      };
    }

    const planningAreas = (planningAreaRows ?? [])
      .map((row) => ({
        id: String((row as { id?: unknown }).id ?? ""),
        areaName: String((row as { area_name?: unknown }).area_name ?? ""),
        regionName:
          (row as { region_name?: unknown }).region_name === null
            ? null
            : String((row as { region_name?: unknown }).region_name ?? ""),
      }))
      .filter((row) => row.id.length > 0 && row.areaName.length > 0);

    const hiddenContext = isObjectRecord(input.pageContext?.hiddenContext)
      ? input.pageContext?.hiddenContext
      : undefined;

    const explicitAreaHints = [
      input.pageContext?.location?.planningArea,
      getNestedString(hiddenContext, "selectedArea", "planningAreaName"),
      getNestedString(hiddenContext, "siteScore", "planningArea", "planningAreaName"),
      input.pageContext?.location?.address,
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .map((value) => value.toLowerCase());

    const matchedPlanningAreas = planningAreas
      .filter((area) => {
        const areaName = area.areaName.toLowerCase();
        const regionName = (area.regionName ?? "").toLowerCase();
        if (question.includes(areaName) || question.includes(regionName)) {
          return true;
        }

        return explicitAreaHints.some(
          (hint) => hint.includes(areaName) || (regionName && hint.includes(regionName)),
        );
      })
      .slice(0, maxAreas);

    const areaFallback = matchedPlanningAreas.length > 0 ? matchedPlanningAreas : planningAreas.slice(0, maxAreas);
    const areaIds = areaFallback.map((area) => area.id);
    const areaNames = areaFallback.map((area) => area.areaName);
    const areaNameById = new Map(areaFallback.map((area) => [area.id, area.areaName]));

    if (areaIds.length > 0) {
      const { data: demographicRows, error: demographicError } = await supabase
        .from("area_demographics")
        .select(
          "planning_area_id, effective_year, population_total, age_distribution_json, income_distribution_json, household_size_json, household_structure_json, economic_status_json",
        )
        .in("planning_area_id", areaIds)
        .order("effective_year", { ascending: false })
        .limit(200);

      if (!demographicError) {
        const latestByArea = new Map<string, Record<string, unknown>>();
        for (const row of (demographicRows ?? []) as Record<string, unknown>[]) {
          const planningAreaId = String(row.planning_area_id ?? "");
          if (!planningAreaId || latestByArea.has(planningAreaId)) {
            continue;
          }
          latestByArea.set(planningAreaId, row);
        }

        emptyResult.latestAreaDemographics = Array.from(latestByArea.entries()).map(([planningAreaId, row]) => ({
          areaName: areaNameById.get(planningAreaId) ?? planningAreaId,
          effectiveYear: Number(row.effective_year ?? 0),
          populationTotal:
            row.population_total === null || row.population_total === undefined
              ? null
              : Number(row.population_total),
          ageDistribution: row.age_distribution_json ?? null,
          incomeDistribution: row.income_distribution_json ?? null,
          householdSize: row.household_size_json ?? null,
          householdStructure: row.household_structure_json ?? null,
          economicStatus: row.economic_status_json ?? null,
        }));
      } else {
        emptyResult.retrievalNotes.push("Failed to retrieve area_demographics rows.");
      }
    }

    if (areaNames.length > 0) {
      const { data: economicRows, error: economicError } = await supabase
        .from("onemap_economic_status")
        .select("planning_area, year, employed, inactive, unemployed")
        .in("planning_area", areaNames)
        .order("year", { ascending: false })
        .limit(200);

      if (!economicError) {
        const latestByArea = new Map<string, Record<string, unknown>>();
        for (const row of (economicRows ?? []) as Record<string, unknown>[]) {
          const areaName = String(row.planning_area ?? "");
          if (!areaName || latestByArea.has(areaName)) {
            continue;
          }
          latestByArea.set(areaName, row);
        }

        emptyResult.latestEconomicStatus = Array.from(latestByArea.values()).map((row) => ({
          areaName: String(row.planning_area ?? ""),
          year: Number(row.year ?? 0),
          employed: Number(row.employed ?? 0),
          inactive: Number(row.inactive ?? 0),
          unemployed: Number(row.unemployed ?? 0),
        }));
      } else {
        emptyResult.retrievalNotes.push("Failed to retrieve onemap_economic_status rows.");
      }

      const { data: incomeRows, error: incomeError } = await supabase
        .from("onemap_household_income")
        .select("planning_area, year, total, sgd_8000_over, sgd_10000_over, no_working_person")
        .in("planning_area", areaNames)
        .order("year", { ascending: false })
        .limit(200);

      if (!incomeError) {
        const latestByArea = new Map<string, Record<string, unknown>>();
        for (const row of (incomeRows ?? []) as Record<string, unknown>[]) {
          const areaName = String(row.planning_area ?? "");
          if (!areaName || latestByArea.has(areaName)) {
            continue;
          }
          latestByArea.set(areaName, row);
        }

        emptyResult.latestHouseholdIncome = Array.from(latestByArea.values()).map((row) => ({
          areaName: String(row.planning_area ?? ""),
          year: Number(row.year ?? 0),
          total: Number(row.total ?? 0),
          sgd8000Over: Number(row.sgd_8000_over ?? 0),
          sgd10000Over: Number(row.sgd_10000_over ?? 0),
          noWorkingPerson: Number(row.no_working_person ?? 0),
        }));
      } else {
        emptyResult.retrievalNotes.push("Failed to retrieve onemap_household_income rows.");
      }
    }

    const sectorHint = input.pageContext?.profile?.sector?.toLowerCase() ?? "";
    const shouldFetchCompetition =
      question.includes("compet") ||
      question.includes("shop") ||
      question.includes("store") ||
      sectorHint.length > 0;

    if (shouldFetchCompetition) {
      const { data: categoryRows, error: categoryError } = await supabase
        .from("google_places")
        .select("shop_category")
        .limit(5000);

      if (!categoryError) {
        const counts = new Map<string, number>();
        for (const row of (categoryRows ?? []) as Array<{ shop_category?: string | null }>) {
          const category = (row.shop_category ?? "unknown").trim();
          if (!category) {
            continue;
          }
          counts.set(category, (counts.get(category) ?? 0) + 1);
        }

        const sorted = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => ({ category, count }));

        if (sectorHint.length > 0) {
          const sectorMatches = sorted.filter((entry) =>
            entry.category.toLowerCase().includes(sectorHint),
          );
          emptyResult.competitionCategoryCounts =
            sectorMatches.length > 0 ? sectorMatches.slice(0, 8) : sorted.slice(0, 8);
        } else {
          emptyResult.competitionCategoryCounts = sorted.slice(0, 8);
        }
      } else {
        emptyResult.retrievalNotes.push("Failed to retrieve google_places competition rows.");
      }
    }

    const [{ count: busStopCount }, { count: mrtExitCount }] = await Promise.all([
      supabase.from("datagov_bus_stops").select("id", { head: true, count: "exact" }),
      supabase.from("datagov_mrt_exits").select("id", { head: true, count: "exact" }),
    ]);

    emptyResult.transitNetwork = {
      busStops: busStopCount ?? null,
      mrtExits: mrtExitCount ?? null,
    };
    emptyResult.matchedPlanningAreas = areaFallback;

    if (matchedPlanningAreas.length === 0) {
      emptyResult.retrievalNotes.push(
        "No explicit planning area match found in the question. Returned baseline planning area context.",
      );
    }

    return emptyResult;
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
        const stillReferenced = await db
          .select({ scoreId: candidateSites.savedSiteScoreId })
          .from(candidateSites)
          .where(inArray(candidateSites.savedSiteScoreId, scoreIds));

        const referencedSet = new Set(
          stillReferenced
            .map((row) => row.scoreId)
            .filter((scoreId): scoreId is string => Boolean(scoreId)),
        );

        const orphanScoreIds = scoreIds.filter((id) => !referencedSet.has(id));
        if (orphanScoreIds.length > 0) {
          await db.delete(siteScores).where(inArray(siteScores.id, orphanScoreIds));
        }
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
    if (this.useHttpProfileFallback) {
      return this.getCandidateSitesViaSupabase(userId);
    }

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
    if (this.useHttpProfileFallback) {
      return this.saveCandidateSiteViaSupabase(siteData);
    }

    const resolvedPlanningAreaId = await this.resolvePlanningAreaIdViaDb(siteData.planningAreaId);

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
      planningAreaId: resolvedPlanningAreaId ?? undefined,
      savedSiteScoreId: score.id,
      notes: siteData.notes,
    });

    const [site] = await db.insert(candidateSites).values(candidatePayload).returning();

    return toCandidateSiteRecord({ site, score });
  }

  async updateCandidateSite(siteId: string, userId: string, input: UpdateCandidateSiteInput): Promise<CandidateSiteRecord | null> {
    if (this.useHttpProfileFallback) {
      return this.updateCandidateSiteViaSupabase(siteId, userId, input);
    }

    const [updatedSite] = await db
      .update(candidateSites)
      .set({
        siteName: input.name,
      })
      .where(and(eq(candidateSites.id, siteId), eq(candidateSites.userId, userId)))
      .returning();

    if (!updatedSite) {
      return null;
    }

    const [score] = updatedSite.savedSiteScoreId
      ? await db
          .select()
          .from(siteScores)
          .where(eq(siteScores.id, updatedSite.savedSiteScoreId))
          .limit(1)
      : [null];

    return toCandidateSiteRecord({ site: updatedSite, score: score ?? null });
  }

  async deleteCandidateSite(siteId: string, userId: string): Promise<void> {
    if (this.useHttpProfileFallback) {
      await this.deleteCandidateSiteViaSupabase(siteId, userId);
      return;
    }

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
      const [stillReferenced] = await db
        .select({ id: candidateSites.id })
        .from(candidateSites)
        .where(eq(candidateSites.savedSiteScoreId, existing.scoreId))
        .limit(1);

      if (!stillReferenced) {
        await db.delete(siteScores).where(eq(siteScores.id, existing.scoreId));
      }
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
