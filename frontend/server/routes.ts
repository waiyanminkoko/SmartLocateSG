import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import {
  getPlanningAreaOverlayCollection,
  getPointLayerCollection,
  scoreSiteLocation,
} from "./map-data";

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

const updateSiteSchema = z.object({
  name: z.string().min(1, "name is required"),
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

const overlayMetricSchema = z.enum(["composite", "demographics", "accessibility", "vacancy"]);

const overlayQuerySchema = z.object({
  metric: overlayMetricSchema.optional().default("composite"),
});

const siteScoreSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  profileId: z.string().min(1).optional(),
  radiusMeters: z.number().int().min(500).max(2000).optional().default(1000),
});

const mapLayerQuerySchema = z
  .object({
    lat: z.coerce.number().finite().optional(),
    lng: z.coerce.number().finite().optional(),
    radiusMeters: z.coerce.number().int().min(500).max(2000).optional().default(1000),
  })
  .refine(
    (value) =>
      (typeof value.lat === "number" && typeof value.lng === "number") ||
      (value.lat === undefined && value.lng === undefined),
    {
      message: "lat and lng must be provided together",
      path: ["lat"],
    },
  );

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
          id: z.string().optional(),
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
            profileId: z.string().optional(),
            id: z.string().optional(),
            name: z.string(),
            lat: z.number().optional(),
            lng: z.number().optional(),
            address: z.string().optional(),
            composite: z.number().optional(),
            demographic: z.number().optional(),
            accessibility: z.number().optional(),
            rental: z.number().optional(),
            notes: z.string().optional(),
            competition: z.number().optional(),
          }),
        )
        .max(10)
        .optional(),
      hiddenContext: z.record(z.unknown()).optional(),
    })
    .passthrough()
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

type ChatbotPayload = z.infer<typeof chatbotSchema>;
type ChatPageScores = {
  composite?: number;
  demographic?: number;
  accessibility?: number;
  rental?: number;
  competition?: number;
};
type ChatPageLocation = {
  address?: string;
  planningArea?: string;
  lat?: number;
  lng?: number;
};

const CHATBOT_CONTEXT_MAX_STRING_LENGTH = 1200;
const CHATBOT_CONTEXT_MAX_ARRAY_LENGTH = 25;
const CHATBOT_CONTEXT_MAX_DEPTH = 5;

function clampContextValue(value: unknown, depth = 0): unknown {
  if (depth > CHATBOT_CONTEXT_MAX_DEPTH) {
    return "[truncated-depth]";
  }

  if (typeof value === "string") {
    if (value.length <= CHATBOT_CONTEXT_MAX_STRING_LENGTH) {
      return value;
    }
    return `${value.slice(0, CHATBOT_CONTEXT_MAX_STRING_LENGTH)}...[truncated]`;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, CHATBOT_CONTEXT_MAX_ARRAY_LENGTH)
      .map((entry) => clampContextValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const clampedEntries = entries.slice(0, CHATBOT_CONTEXT_MAX_ARRAY_LENGTH).map(([key, entry]) => [
      key,
      clampContextValue(entry, depth + 1),
    ]);
    return Object.fromEntries(clampedEntries);
  }

  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hasObjectEntries(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0);
}

function hasAnyScore(scores: ChatPageScores | undefined): boolean {
  if (!scores) {
    return false;
  }

  return (
    toOptionalNumber(scores.composite) !== undefined ||
    toOptionalNumber(scores.demographic) !== undefined ||
    toOptionalNumber(scores.accessibility) !== undefined ||
    toOptionalNumber(scores.rental) !== undefined ||
    toOptionalNumber(scores.competition) !== undefined
  );
}

function hasLocationEvidence(location: ChatPageLocation | undefined): boolean {
  if (!location) {
    return false;
  }

  return Boolean(
    toOptionalString(location.address) ||
      toOptionalString(location.planningArea) ||
      toOptionalNumber(location.lat) !== undefined ||
      toOptionalNumber(location.lng) !== undefined,
  );
}

function buildVisiblePageContext(payload: ChatbotPayload) {
  if (!payload.pageContext) {
    return null;
  }

  if (payload.pageContext.page === "portfolio") {
    const hidden = asRecord(payload.pageContext.hiddenContext);
    const focusSite = asRecord(hidden?.focusSite);
    const filteredSites = Array.isArray(hidden?.filteredSites)
      ? (hidden?.filteredSites as unknown[]).slice(0, 10)
      : undefined;

    return {
      portfolioSnapshot: {
        activeProfileId: toOptionalString(hidden?.activeProfileId) ?? payload.pageContext.profile?.id,
        selectedIdsCount: Array.isArray(hidden?.selectedIds) ? hidden.selectedIds.length : undefined,
        totalSites: toOptionalNumber(hidden?.totalSites) ?? payload.pageContext.sites?.length,
        filteredSitesCount: toOptionalNumber(hidden?.filteredSitesCount),
        profileFilter: toOptionalString(hidden?.profileFilter),
        query: toOptionalString(hidden?.query),
      },
      focusedSite: {
        id: toOptionalString(focusSite?.id),
        name: toOptionalString(focusSite?.name),
        address: toOptionalString(focusSite?.address),
        planningArea: toOptionalString(focusSite?.planningArea),
        composite: toOptionalNumber(focusSite?.composite),
        demographic: toOptionalNumber(focusSite?.demographic),
        accessibility: toOptionalNumber(focusSite?.accessibility),
        rental: toOptionalNumber(focusSite?.rental),
        competition: toOptionalNumber(focusSite?.competition),
      },
      filteredSiteScores: filteredSites?.map((site) => {
        const s = asRecord(site);
        return {
          id: toOptionalString(s?.id),
          name: toOptionalString(s?.name),
          address: toOptionalString(s?.address),
          composite: toOptionalNumber(s?.composite),
          demographic: toOptionalNumber(s?.demographic),
          accessibility: toOptionalNumber(s?.accessibility),
          rental: toOptionalNumber(s?.rental),
          competition: toOptionalNumber(s?.competition),
        };
      }),
      portfolioInsights: hidden?.portfolioInsights,
    };
  }

  if (payload.pageContext.page === "compare") {
    const hidden = asRecord(payload.pageContext.hiddenContext);
    const profileSites = Array.isArray(hidden?.profileSites)
      ? (hidden?.profileSites as unknown[]).slice(0, 10)
      : undefined;

    return {
      comparisonSnapshot: {
        activeProfileId: toOptionalString(hidden?.activeProfileId) ?? payload.pageContext.profile?.id,
        selectedSitesCount: toOptionalNumber(hidden?.selectedSitesCount),
        totalProfileSites: toOptionalNumber(hidden?.totalProfileSites),
        selectedSiteIds: Array.isArray(hidden?.selectedSiteIds)
          ? (hidden.selectedSiteIds as unknown[])
              .map((id) => toOptionalString(id))
              .filter((id): id is string => Boolean(id))
          : undefined,
      },
      comparedSites: profileSites?.map((site) => {
        const s = asRecord(site);
        return {
          id: toOptionalString(s?.id),
          name: toOptionalString(s?.name),
          address: toOptionalString(s?.address),
          composite: toOptionalNumber(s?.composite),
          demographic: toOptionalNumber(s?.demographic),
          accessibility: toOptionalNumber(s?.accessibility),
          rental: toOptionalNumber(s?.rental),
          competition: toOptionalNumber(s?.competition),
        };
      }),
      chartData: hidden?.chartData,
      comparisonInsights: hidden?.comparisonInsights,
    };
  }

  const hidden = asRecord(payload.pageContext.hiddenContext);
  const selectedArea = asRecord(hidden?.selectedArea);
  const siteScore = asRecord(hidden?.siteScore);
  const planningArea = asRecord(siteScore?.planningArea);
  const breakdown = asRecord(siteScore?.breakdownDetails);

  return {
    selectedSite: {
      address: payload.pageContext.location?.address,
      planningArea:
        payload.pageContext.location?.planningArea ??
        toOptionalString(selectedArea?.planningAreaName) ??
        toOptionalString(planningArea?.planningAreaName),
      radiusMeters:
        toOptionalNumber(hidden?.focusRadiusMeters) ??
        toOptionalNumber(breakdown?.analysisRadiusMeters),
      radiusLabel: toOptionalString((hidden?.selectedSiteChipMeta as string[] | undefined)?.[1]),
    },
    planningAreaDetails: {
      populationTotal:
        toOptionalNumber(selectedArea?.populationTotal) ?? toOptionalNumber(planningArea?.populationTotal),
      effectiveYear:
        toOptionalNumber(selectedArea?.effectiveYear) ?? toOptionalNumber(planningArea?.effectiveYear),
      busStopCount:
        toOptionalNumber(selectedArea?.busStopCount) ?? toOptionalNumber(planningArea?.busStopCount),
      mrtExitCount:
        toOptionalNumber(selectedArea?.mrtExitCount) ?? toOptionalNumber(planningArea?.mrtExitCount),
      avgUnitPricePsf:
        toOptionalNumber(selectedArea?.avgUnitPricePsf) ?? toOptionalNumber(planningArea?.avgUnitPricePsf),
      retailTransactionCount:
        toOptionalNumber(selectedArea?.retailTransactionCount) ??
        toOptionalNumber(planningArea?.retailTransactionCount),
      areaComposite: toOptionalNumber(planningArea?.compositeScore),
      areaDemographics: toOptionalNumber(planningArea?.demographicScore),
      areaAccessibility: toOptionalNumber(planningArea?.accessibilityScore),
      areaVacancy: toOptionalNumber(planningArea?.vacancyScore),
    },
    scoreBreakdown: {
      composite: payload.pageContext.scores?.composite,
      demographic: payload.pageContext.scores?.demographic,
      accessibility: payload.pageContext.scores?.accessibility,
      rental: payload.pageContext.scores?.rental,
      competition: payload.pageContext.scores?.competition,
    },
    liveSiteInputs: {
      busStopsWithinRadius: toOptionalNumber(breakdown?.busStopsWithinRadius),
      mrtExitsWithinRadius: toOptionalNumber(breakdown?.mrtExitsWithinRadius),
      competitionCountWithinRadius: toOptionalNumber(breakdown?.competitionCountWithinRadius),
      competitionCategory: toOptionalString(breakdown?.competitionCategory),
      populationTotal: toOptionalNumber(breakdown?.populationTotal),
      avgUnitPricePsf: toOptionalNumber(breakdown?.avgUnitPricePsf),
      retailTransactionCount: toOptionalNumber(breakdown?.retailTransactionCount),
    },
    dataAvailability: {
      hasScores: hasAnyScore(payload.pageContext.scores),
      hasLocation: hasLocationEvidence(payload.pageContext.location),
      hasPlanningAreaSignals: Boolean(selectedArea || planningArea),
      hasSiteInputs: Boolean(breakdown),
    },
  };
}

function buildPageDataAvailability(payload: ChatbotPayload, visiblePageContext: unknown) {
  const hidden = asRecord(payload.pageContext?.hiddenContext);

  return {
    page: payload.pageContext?.page,
    hasScores: hasAnyScore(payload.pageContext?.scores),
    hasLocation: hasLocationEvidence(payload.pageContext?.location),
    hasSites: Boolean((payload.pageContext?.sites?.length ?? 0) > 0),
    hasHiddenContext: hasObjectEntries(hidden),
    hasVisiblePageContext: hasObjectEntries(visiblePageContext),
  };
}

async function buildChatRetrievalContext(payload: ChatbotPayload) {
  const normalizedMessage = payload.message.trim();
  if (!normalizedMessage) {
    return null;
  }

  const lowerMessage = normalizedMessage.toLowerCase();
  const asksOffPageContext =
    lowerMessage.includes("other") ||
    lowerMessage.includes("another") ||
    lowerMessage.includes("outside") ||
    lowerMessage.includes("not shown") ||
    lowerMessage.includes("not selected") ||
    lowerMessage.includes("not chosen") ||
    lowerMessage.includes("different site") ||
    lowerMessage.includes("different region") ||
    lowerMessage.includes("other region") ||
    lowerMessage.includes("planning area") ||
    lowerMessage.includes("all") ||
    lowerMessage.includes("across") ||
    lowerMessage.includes("nationwide") ||
    lowerMessage.includes("singapore") ||
    lowerMessage.includes("sg");

  if (!asksOffPageContext) {
    return null;
  }

  const asksBroadly =
    lowerMessage.includes("all") ||
    lowerMessage.includes("across") ||
    lowerMessage.includes("nationwide") ||
    lowerMessage.includes("singapore") ||
    lowerMessage.includes("sg");

  try {
    return await storage.getChatbotPublicKnowledge({
      message: payload.message,
      pageContext: payload.pageContext,
      maxAreas: asksBroadly ? 6 : 4,
    });
  } catch {
    return {
      retrievalNotes: [
        "Supabase retrieval attempt failed for this query. Falling back to available page context.",
      ],
    };
  }
}

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
    "Ground answers in Singapore context (MRT, bus, planning areas, local demographics/rental proxies).",
    "Respond in concise, business-friendly language for SME users.",
    "First answer the user's exact question directly in 1-2 sentences.",
    "Then explain the reasoning with concrete evidence from provided context and retrieved data.",
    "Use page context and retrieved database context only.",
    "Never mention hiddenContext or internal payload fields.",
    "Avoid hallucinations and unsupported claims.",
    "If score/location/site values are present in visiblePageContext, treat them as loaded evidence and do not claim data is unavailable.",
    "Explain trade-offs across score dimensions and suggest practical improvements.",
    "If data is missing or retrieval returned no records, acknowledge it briefly and continue with what is available.",
    "Keep response under 220 words unless the user explicitly asks for more detail.",
    "Format the response in clean Markdown with short headings and bullet points when useful.",
  ];

  if (page === "map") {
    base.push("Focus on single-site interpretation and improvement actions.");
    base.push("When map context is present, prioritize visiblePageContext values over nationwide aggregates.");
  } else if (page === "portfolio") {
    base.push("Focus on saved-site evaluation and prioritization guidance.");
  } else if (page === "compare") {
    base.push("Focus on side-by-side comparison and recommendation with trade-offs.");
  }

  return base.join(" ");
}

function buildChatContextText(payload: ChatbotPayload, retrievalContext: unknown) {
  const visiblePageContext = buildVisiblePageContext(payload);

  return JSON.stringify({
    pageContext: clampContextValue(payload.pageContext),
    visiblePageContext: clampContextValue(visiblePageContext),
    pageDataAvailability: buildPageDataAvailability(payload, visiblePageContext),
    message: payload.message,
    history: clampContextValue(payload.history ?? []),
    retrievedDatabaseContext: clampContextValue(retrievalContext),
  });
}

async function generateGeminiChatResponse(payload: ChatbotPayload) {
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
    const retrievalContext = await buildChatRetrievalContext(payload);
    const body = {
      system_instruction: {
        parts: [{ text: buildChatSystemPrompt(payload.pageContext?.page) }],
      },
      contents: [
        {
          parts: [{ text: buildChatContextText(payload, retrievalContext) }],
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

  app.get("/api/map/overlays", async (req, res) => {
    try {
      const { metric } = overlayQuerySchema.parse(req.query);
      const collection = await getPlanningAreaOverlayCollection(metric);
      res.json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      console.error("[api/map/overlays][GET]", error);
      res.status(500).json({ error: "Failed to fetch planning area overlays." });
    }
  });

  app.get("/api/map/layers/bus-stops", async (req, res) => {
    try {
      const query = mapLayerQuerySchema.parse(req.query);
      const collection = await getPointLayerCollection(
        "bus-stops",
        typeof query.lat === "number" && typeof query.lng === "number"
          ? { lat: query.lat, lng: query.lng, radiusMeters: query.radiusMeters }
          : undefined,
      );
      res.json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      console.error("[api/map/layers/bus-stops][GET]", error);
      res.status(500).json({ error: "Failed to fetch bus stop layer." });
    }
  });

  app.get("/api/map/layers/mrt-exits", async (req, res) => {
    try {
      const query = mapLayerQuerySchema.parse(req.query);
      const collection = await getPointLayerCollection(
        "mrt-exits",
        typeof query.lat === "number" && typeof query.lng === "number"
          ? { lat: query.lat, lng: query.lng, radiusMeters: query.radiusMeters }
          : undefined,
      );
      res.json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      console.error("[api/map/layers/mrt-exits][GET]", error);
      res.status(500).json({ error: "Failed to fetch MRT exit layer." });
    }
  });

  app.get("/api/map/layers/mrt-stations", async (req, res) => {
    try {
      const query = mapLayerQuerySchema.parse(req.query);
      const collection = await getPointLayerCollection(
        "mrt-stations",
        typeof query.lat === "number" && typeof query.lng === "number"
          ? { lat: query.lat, lng: query.lng, radiusMeters: query.radiusMeters }
          : undefined,
      );
      res.json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      console.error("[api/map/layers/mrt-stations][GET]", error);
      res.status(500).json({ error: "Failed to fetch MRT station layer." });
    }
  });

  app.post("/api/map/site-score", async (req, res) => {
    try {
      const payload = siteScoreSchema.parse(req.body);
      const result = await scoreSiteLocation(payload);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      console.error("[api/map/site-score][POST]", error);
      res.status(500).json({ error: "Failed to score site." });
    }
  });

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

  app.put("/api/sites/:id", async (req, res) => {
    try {
      const { userId } = deleteSiteQuerySchema.parse(req.query);
      const payload = updateSiteSchema.parse(req.body);
      const updated = await storage.updateCandidateSite(req.params.id, userId, payload);
      if (!updated) {
        return res.status(404).json({ error: "Candidate site not found." });
      }
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.flatten() });
      }

      res.status(500).json({ error: "Failed to update candidate site." });
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
