import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";

const saveSiteSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  profileId: z.string().min(1).optional(),
  name: z.string().min(1, "name is required"),
  address: z.string().min(1, "address is required"),
  postalCode: z.string().min(1).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  planningAreaId: z.string().min(1).optional(),
  composite: z.number().finite(),
  demographic: z.number().finite(),
  accessibility: z.number().finite(),
  rental: z.number().finite(),
  competition: z.number().finite(),
  notes: z.string().optional(),
});

const deleteSiteQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  app.get("/api/sites/:userId", async (req, res) => {
    try {
      const sites = await storage.getCandidateSites(req.params.userId);
      res.json(sites);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch candidate sites." });
    }
  });

  app.post("/api/sites", async (req, res) => {
    try {
      const payload = saveSiteSchema.parse(req.body);
      const site = await storage.saveCandidateSite(payload);
      res.json(site);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }

      res.status(500).json({ error: "Failed to save candidate site." });
    }
  });

  app.delete("/api/sites/:id", async (req, res) => {
    try {
      const { userId } = deleteSiteQuerySchema.parse(req.query);
      await storage.deleteCandidateSite(req.params.id, userId);
      res.status(204).send();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }

      res.status(500).json({ error: "Failed to delete candidate site." });
    }
  });

  return httpServer;
}
