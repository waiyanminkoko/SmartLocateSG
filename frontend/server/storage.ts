import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Site Portfolio Management
  getCandidateSites(userId: string): Promise<any[]>;
  saveCandidateSite(siteData: any): Promise<any>;
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
  async getCandidateSites(userId: string): Promise<any[]> {
    return [];
  }

  async saveCandidateSite(siteData: any): Promise<any> {
    const id = randomUUID();
    return { ...siteData, id, savedAt: new Date() };
  }

  async deleteCandidateSite(siteId: string, userId: string): Promise<void> {
    // mock delete
  }

  async getAreaDemographics(planningAreaId: string): Promise<any> {
    return null;
  }
}

// TODO: Create a DatabaseStorage class once Drizzle Postgres is fully configured
// export class DatabaseStorage implements IStorage { ... }

export const storage = new MemStorage();
