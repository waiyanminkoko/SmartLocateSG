export type ChatbotPage = "map" | "portfolio" | "compare";

export type ChatbotContext = {
  page: ChatbotPage;
  title?: string;
  profile?: {
    name?: string;
    sector?: string;
    priceBand?: string;
  };
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
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
    name: string;
    address?: string;
    composite?: number;
    demographic?: number;
    accessibility?: number;
    rental?: number;
    competition?: number;
  }>;
};

export type OpenChatbotPayload = {
  context: ChatbotContext;
  starterPrompt?: string;
  autoSend?: boolean;
};

export const CHATBOT_OPEN_EVENT = "smartlocate:chatbot-open";

export function openChatbot(payload: OpenChatbotPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHATBOT_OPEN_EVENT, { detail: payload }));
}
