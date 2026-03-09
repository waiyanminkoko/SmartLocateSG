import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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
      // In a real implementation, calculate scores here based on planning area demographics
      const site = await storage.saveCandidateSite(req.body);
      res.json(site);
    } catch (e) {
      res.status(500).json({ error: "Failed to save candidate site." });
    }
  });

  app.delete("/api/sites/:id", async (req, res) => {
    try {
      // Assuming a mock userId for now until auth is fully setup
      await storage.deleteCandidateSite(req.params.id, "mock-user-id");
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: "Failed to delete candidate site." });
    }
  });

  return httpServer;
}
