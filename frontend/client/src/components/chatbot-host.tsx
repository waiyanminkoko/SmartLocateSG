import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Expand, Minimize2, Send, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CHATBOT_OPEN_EVENT,
  type ChatbotContext,
  type OpenChatbotPayload,
} from "@/lib/chatbot";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUPPORTED_PATHS = new Set(["/map", "/portfolio", "/compare"]);

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultPrompt(context: ChatbotContext) {
  if (context.page === "map") {
    return "Please explain this score breakdown and suggest 2 practical ways to improve the weakest dimensions.";
  }
  if (context.page === "portfolio") {
    return "Please explain this saved site's scores and suggest whether to keep, improve, or deprioritize it.";
  }
  return "Please compare the selected sites and recommend the strongest option with trade-offs.";
}

export function ChatbotHost() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [context, setContext] = useState<ChatbotContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const isSupportedRoute = SUPPORTED_PATHS.has(location);

  useEffect(() => {
    if (!isSupportedRoute) {
      setIsOpen(false);
      setIsExpanded(false);
    }
  }, [isSupportedRoute]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shiftLayout = isOpen && isExpanded && !isMobile && isSupportedRoute;
    document.body.classList.toggle("chatbot-expanded", shiftLayout);
    return () => {
      document.body.classList.remove("chatbot-expanded");
    };
  }, [isOpen, isExpanded, isMobile, isSupportedRoute]);

  useEffect(() => {
    if (!isSupportedRoute || typeof window === "undefined") {
      return;
    }

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenChatbotPayload>).detail;
      if (!detail?.context) {
        return;
      }

      setContext(detail.context);
      setIsOpen(true);
      setInput(detail.starterPrompt ?? buildDefaultPrompt(detail.context));
      if (detail.autoSend) {
        void handleSend(detail.starterPrompt ?? buildDefaultPrompt(detail.context), detail.context);
      }
    };

    window.addEventListener(CHATBOT_OPEN_EVENT, handleOpen);
    return () => {
      window.removeEventListener(CHATBOT_OPEN_EVENT, handleOpen);
    };
  }, [isSupportedRoute]);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const panelTitle = useMemo(() => {
    if (!context) {
      return "Score Assistant";
    }
    if (context.page === "map") {
      return "Map Score Assistant";
    }
    if (context.page === "portfolio") {
      return "Portfolio Assistant";
    }
    return "Compare Assistant";
  }, [context]);

  const send = async () => {
    if (!input.trim() || isSending) {
      return;
    }

    await handleSend(input, context);
  };

  async function handleSend(prompt: string, activeContext: ChatbotContext | null) {
    if (!prompt.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: prompt.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const recentHistory = [...messages, userMessage].slice(-8).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          pageContext: activeContext,
          history: recentHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Chatbot request failed.");
      }

      const data = (await response.json()) as { message?: string };
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content:
          data.message ??
          "I could not generate a response right now. Please try again in a moment.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content:
            "I am temporarily unavailable. Please try again, or continue with the score summary on this page.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  if (!isSupportedRoute) {
    return null;
  }

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          aria-label="Open score chatbot"
          className="chatbot-fab"
          onClick={() => {
            const fallbackContext: ChatbotContext = context ?? {
              page: location === "/map" ? "map" : location === "/portfolio" ? "portfolio" : "compare",
            };
            setContext(fallbackContext);
            setInput(buildDefaultPrompt(fallbackContext));
            setIsOpen(true);
          }}
          data-testid="button-chatbot-fab"
        >
          <span className="chatbot-fab-emoji" aria-hidden="true">✨</span>
        </button>
      ) : null}

      {isOpen ? (
        <aside
          className={`chatbot-panel ${isExpanded && !isMobile ? "chatbot-panel-expanded" : ""}`}
          aria-label="AI score assistant panel"
        >
          <Card className="chatbot-shell">
            <div className="chatbot-header">
              <div className="chatbot-title-wrap">
                <div className="chatbot-title-icon">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="chatbot-title">{panelTitle}</div>
                  <div className="chatbot-subtitle">
                    Ask about scores, trade-offs, and improvement ideas.
                  </div>
                </div>
              </div>
              <div className="chatbot-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
                  data-testid="button-chatbot-expand"
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  data-testid="button-chatbot-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="chatbot-messages">
              <div ref={viewportRef} className="chatbot-messages-inner">
                {messages.length === 0 ? (
                  <div className="chatbot-empty">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>
                      Start with: <strong>{input || "Explain this score and suggest improvements."}</strong>
                    </span>
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chatbot-bubble-row ${message.role === "user" ? "is-user" : "is-assistant"}`}
                  >
                    <div className="chatbot-bubble">
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}

                {isSending ? (
                  <div className="chatbot-bubble-row is-assistant">
                    <div className="chatbot-bubble">Thinking...</div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div className="chatbot-input-wrap">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask why this score is high/low, or what to improve next..."
                className="min-h-20 resize-none"
                data-testid="input-chatbot-message"
              />
              <Button
                type="button"
                className="gap-2"
                onClick={() => {
                  void send();
                }}
                disabled={isSending || !input.trim()}
                data-testid="button-chatbot-send"
              >
                <Send className="h-4 w-4" aria-hidden="true" /> Send
              </Button>
            </div>
          </Card>
        </aside>
      ) : null}
    </>
  );
}
