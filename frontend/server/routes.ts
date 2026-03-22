import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";

type ExplanationItem = {
  label: string;
  score: number;
  detail: string;
};

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
  scoreNotes: z.string().optional(),
  breakdownDetailsJson: z.record(z.any()).optional(),
});

const deleteSiteQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

const createProfileSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  name: z.string().min(1, "name is required"),
  sector: z.string().min(1, "sector is required"),
  priceBand: z.string().min(1, "priceBand is required"),
  ageGroups: z.array(z.string()).min(1, "at least one age group is required"),
  incomeBands: z.array(z.string()).min(1, "at least one income band is required"),
  operatingModel: z.string().min(1, "operatingModel is required"),
});

const updateProfileSchema = createProfileSchema.omit({ userId: true });

const listProfilesQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

const explainScoreSchema = z.object({
  profile: z
    .object({
      name: z.string().optional(),
      sector: z.string().optional(),
      priceBand: z.string().optional(),
      ageGroups: z.array(z.string()).optional(),
      incomeBands: z.array(z.string()).optional(),
      operatingModel: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      planningArea: z.string().optional(),
    })
    .optional(),
  scores: z.object({
    composite: z.number().finite(),
    demographic: z.number().finite(),
    accessibility: z.number().finite(),
    rental: z.number().finite(),
    competition: z.number().finite(),
  }),
});

const chatbotSchema = z.object({
  message: z.string().min(1, "message is required").max(3000, "message is too long"),
  pageContext: z
    .object({
      page: z.enum(["map", "portfolio", "compare"]),
      title: z.string().optional(),
      profile: z
        .object({
          name: z.string().optional(),
          sector: z.string().optional(),
          priceBand: z.string().optional(),
        })
        .optional(),
      location: z
        .object({
          address: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
        })
        .optional(),
      scores: z
        .object({
          composite: z.number().optional(),
          demographic: z.number().optional(),
          accessibility: z.number().optional(),
          rental: z.number().optional(),
          competition: z.number().optional(),
        })
        .optional(),
      sites: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            address: z.string().optional(),
            composite: z.number().optional(),
            demographic: z.number().optional(),
            accessibility: z.number().optional(),
            rental: z.number().optional(),
            competition: z.number().optional(),
          }),
        )
        .max(3)
        .optional(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      }),
    )
    .max(12)
    .optional(),
});

function fallbackExplanation(scores: {
  demographic: number;
  accessibility: number;
  rental: number;
  competition: number;
}): ExplanationItem[] {
  const demographicDetail =
    scores.demographic >= 75
      ? "Strong overlap with target age and income segments."
      : scores.demographic >= 60
        ? "Moderate overlap with your target demographics."
        : "Low overlap with target demographics for this profile.";

  const accessibilityDetail =
    scores.accessibility >= 80
      ? "Location has strong transit access potential."
      : scores.accessibility >= 65
        ? "Transit access is acceptable but can be improved by micro-location choice."
        : "Transit accessibility is limited compared with higher-scoring areas.";

  const rentalDetail =
    scores.rental >= 75
      ? "Rental pressure is favorable for cost control."
      : scores.rental >= 60
        ? "Rental pressure is moderate; benchmark nearby alternatives before committing."
        : "Rental pressure is high and may constrain margins.";

  const competitionDetail =
    scores.competition >= 75
      ? "Competition density appears manageable."
      : scores.competition >= 60
        ? "Competition is moderate; positioning and differentiation matter."
        : "Competition density is high; differentiation strategy is critical.";

  return [
    { label: "Demographic match", score: scores.demographic, detail: demographicDetail },
    { label: "Accessibility", score: scores.accessibility, detail: accessibilityDetail },
    { label: "Rental pressure", score: scores.rental, detail: rentalDetail },
    { label: "Competition density", score: scores.competition, detail: competitionDetail },
  ];
}

function mapProfileApiError(error: unknown, fallbackMessage: string) {
  const dbError = error as {
    code?: string;
    message?: string;
  };
  const lowerMessage = dbError?.message?.toLowerCase() ?? "";

  if (
    dbError?.code === "ETIMEDOUT" ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("connection terminated")
  ) {
    return {
      status: 503,
      body: {
        error:
          "Database connection timed out. Verify Supabase pooler host/port and local network firewall settings.",
        detail:
          process.env.NODE_ENV !== "production" ? dbError?.message ?? "timeout" : undefined,
      },
    };
  }

  if (dbError?.code === "ENOTFOUND" || dbError?.code === "ECONNREFUSED") {
    return {
      status: 503,
      body: {
        error:
          "Database endpoint is unreachable. Check Supabase host, port, and DNS/network configuration.",
        detail:
          process.env.NODE_ENV !== "production" ? dbError?.message ?? dbError?.code ?? "unreachable" : undefined,
      },
    };
  }

  if (dbError?.code === "SELF_SIGNED_CERT_IN_CHAIN") {
    return {
      status: 503,
      body: {
        error:
          "TLS certificate chain is blocked by local network policy. Enable SUPABASE_DB_ALLOW_SELF_SIGNED=true for this environment.",
        detail:
          process.env.NODE_ENV !== "production" ? dbError?.message ?? "ssl" : undefined,
      },
    };
  }

  if (
    dbError?.message?.toLowerCase().includes("tenant or user not found") ||
    dbError?.code === "XX000"
  ) {
    return {
      status: 503,
      body: {
        error:
          "Supabase pooler credentials are invalid for this project. Use the exact Transaction pooler connection details from Supabase Dashboard.",
        detail:
          process.env.NODE_ENV !== "production" ? dbError?.message ?? dbError?.code ?? "pooler credentials" : undefined,
      },
    };
  }

  return { status: 500, body: { error: fallbackMessage } };
}

async function generateGeminiExplanation(input: z.infer<typeof explainScoreSchema>) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    const items = fallbackExplanation(input.scores);
    return {
      source: "fallback",
      summary: `Composite score is ${Math.round(input.scores.composite)}. Use the breakdown to prioritize actions before committing to this site.`,
      items,
    };
  }

  const systemInstruction = [
    "You are SmartLocateSG score assistant.",
    "Explain each score in concise business language for SME owners.",
    "Give practical improvement ideas for weak dimensions.",
    "Do not mention unavailable data or hallucinate statistics.",
    "Return strict JSON only with keys summary and items.",
    "items must be an array of objects: label, score, detail.",
  ].join(" ");

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        parts: [
          {
            text: JSON.stringify({
              profile: input.profile,
              location: input.location,
              scores: input.scores,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini request failed");
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) {
    throw new Error("Gemini response missing content");
  }

  const parsed = JSON.parse(raw) as {
    summary?: string;
    items?: Array<{ label?: string; score?: number; detail?: string }>;
  };

  const fallbackItems = fallbackExplanation(input.scores);
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((item, index) => ({
          label: item.label ?? fallbackItems[index]?.label ?? "Score",
          score: typeof item.score === "number" ? item.score : fallbackItems[index]?.score ?? 0,
          detail: item.detail ?? fallbackItems[index]?.detail ?? "No detail available.",
        }))
        .slice(0, 4)
    : fallbackItems;

  return {
    source: "gemini",
    summary:
      parsed.summary ??
      `Composite score is ${Math.round(input.scores.composite)}. Review each dimension before deciding.`,
    items,
  };
}

function buildChatSystemPrompt(page?: "map" | "portfolio" | "compare") {
  const base = [
    "You are SmartLocateSG AI score assistant.",
    "Respond in concise, business-friendly language for SME users.",
    "Use only the given context data and avoid hallucinations.",
    "Explain trade-offs across score dimensions and suggest practical improvements.",
    "If data is missing, acknowledge it briefly and continue with what is available.",
    "Keep response under 180 words unless the user explicitly asks for more detail.",
    "Format the response in clean Markdown with short headings and bullet points when useful.",
  ];

  if (page === "map") {
    base.push("Focus on single-site interpretation and improvement actions.");
  } else if (page === "portfolio") {
    base.push("Focus on saved-site evaluation and prioritization guidance.");
  } else if (page === "compare") {
    base.push("Focus on side-by-side comparison and recommendation with trade-offs.");
  }

  return base.join(" ");
}

function buildChatContextText(payload: z.infer<typeof chatbotSchema>) {
  return JSON.stringify({
    pageContext: payload.pageContext,
    message: payload.message,
    history: payload.history ?? [],
  });
}

async function generateGeminiChatResponse(payload: z.infer<typeof chatbotSchema>) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      source: "fallback",
      message:
        "AI chat is in demo fallback mode right now. I can still help: focus on low-scoring dimensions first, then improve accessibility and demographic fit before committing a site.",
    };
  }

  const model = process.env.GEMINI_CHATBOT_MODEL?.trim() || "gemini-2.0-flash";
  const controller = new AbortController();
  const timeoutMs = Number(process.env.GEMINI_CHATBOT_TIMEOUT_MS ?? "30000");
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      system_instruction: {
        parts: [{ text: buildChatSystemPrompt(payload.pageContext?.page) }],
      },
      contents: [
        {
          parts: [{ text: buildChatContextText(payload) }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error("Gemini chatbot request failed");
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini chatbot response missing content");
    }

    return {
      source: "gemini",
      message: text.trim(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

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

  app.get("/api/profiles", async (req, res) => {
    try {
      const { userId } = listProfilesQuerySchema.parse(req.query);
      const profiles = await storage.getBusinessProfiles(userId);
      res.json(profiles);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }
      console.error("[api/profiles][GET]", e);
      const mapped = mapProfileApiError(e, "Failed to fetch profiles.");
      res.status(mapped.status).json(mapped.body);
    }
  });

  app.post("/api/profiles", async (req, res) => {
    try {
      const payload = createProfileSchema.parse(req.body);
      const profile = await storage.createBusinessProfile(payload);
      res.json(profile);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }
      console.error("[api/profiles][POST]", e);
      const mapped = mapProfileApiError(e, "Failed to create profile.");
      res.status(mapped.status).json(mapped.body);
    }
  });

  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const { userId } = listProfilesQuerySchema.parse(req.query);
      const payload = updateProfileSchema.parse(req.body);
      const updated = await storage.updateBusinessProfile(req.params.id, userId, payload);
      if (!updated) {
        return res.status(404).json({ error: "Profile not found." });
      }
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }
      res.status(500).json({ error: "Failed to update profile." });
    }
  });

  app.put("/api/profiles/:id/activate", async (req, res) => {
    try {
      const { userId } = listProfilesQuerySchema.parse(req.body);
      await storage.setActiveBusinessProfile(req.params.id, userId);
      res.status(204).send();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }
      res.status(500).json({ error: "Failed to activate profile." });
    }
  });

  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      const { userId } = listProfilesQuerySchema.parse(req.query);
      await storage.deleteBusinessProfile(req.params.id, userId);
      res.status(204).send();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }
      res.status(500).json({ error: "Failed to delete profile." });
    }
  });

  app.post("/api/explain-score", async (req, res) => {
    try {
      const payload = explainScoreSchema.parse(req.body);
      const explanation = await generateGeminiExplanation(payload);
      res.json(explanation);
    } catch {
      const fallbackItems = fallbackExplanation(req.body?.scores ?? {
        demographic: 0,
        accessibility: 0,
        rental: 0,
        competition: 0,
      });
      res.json({
        source: "fallback",
        summary: "Explanation service is currently using fallback logic.",
        items: fallbackItems,
      });
    }
  });

  app.post("/api/chatbot", async (req, res) => {
    try {
      const payload = chatbotSchema.parse(req.body);
      const response = await generateGeminiChatResponse(payload);
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      res.json({
        source: "fallback",
        message:
          "I could not reach the AI service. For now, compare the weakest score dimensions first, then prioritize actions that improve those values.",
      });
    }
  });

  return httpServer;
}
