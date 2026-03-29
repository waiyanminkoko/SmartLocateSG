export type ChatbotPage = "map" | "portfolio" | "compare";

export type ChatbotContext = {
  page: ChatbotPage;
  title?: string;
  profile?: {
    id?: string;
    name?: string;
    sector?: string;
    priceBand?: string;
    ageGroups?: string[];
    incomeBands?: string[];
    operatingModel?: string;
  };
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
    planningArea?: string;
  };
  scores?: {
    composite?: number;
    demographic?: number;
    accessibility?: number;
    rental?: number;
    competition?: number;
  };
  sites?: Array<{
    id?: string;
    profileId?: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    composite?: number;
    demographic?: number;
    accessibility?: number;
    rental?: number;
    competition?: number;
    notes?: string;
  }>;
  hiddenContext?: Record<string, unknown>;
};

export type OpenChatbotPayload = {
  context: ChatbotContext;
  starterPrompt?: string;
  autoSend?: boolean;
};

export const CHATBOT_OPEN_EVENT = "smartlocate:chatbot-open";

const latestPayloadByPage: Partial<Record<ChatbotPage, OpenChatbotPayload>> = {};

export function setLatestChatbotPayload(payload: OpenChatbotPayload) {
  latestPayloadByPage[payload.context.page] = payload;
}

export function getLatestChatbotPayload(page: ChatbotPage): OpenChatbotPayload | null {
  return latestPayloadByPage[page] ?? null;
}

export function openChatbot(payload: OpenChatbotPayload) {
  if (typeof window === "undefined") {
    return;
  }

  setLatestChatbotPayload(payload);

  window.dispatchEvent(new CustomEvent(CHATBOT_OPEN_EVENT, { detail: payload }));
}
