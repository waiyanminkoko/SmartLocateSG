import { and, desc, eq } from "drizzle-orm";
import {
  areaDemographics,
  candidateSites,
  dbInsertCandidateSiteSchema,
  dbInsertUserSchema,
  siteScores,
  users,
  type InsertUser,
  type User,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";

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
};

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Site Portfolio Management
  getCandidateSites(userId: string): Promise<CandidateSiteRecord[]>;
  saveCandidateSite(siteData: SaveCandidateSiteInput): Promise<CandidateSiteRecord>;
  deleteCandidateSite(siteId: string, userId: string): Promise<void>;
  
  // Demographics / Scoring
  getAreaDemographics(planningAreaId: string): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
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

export class DatabaseStorage implements IStorage {
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
