import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ExplanationFeedbackInput = {
  page: "map" | "portfolio" | "compare";
  profileId?: string | null;
  siteId?: string | null;
  criterion: string;
  vote: "helpful" | "not_helpful";
};

type ExplanationFeedbackRecord = ExplanationFeedbackInput & {
  id: string;
  createdAt: string;
};

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const feedbackDir = path.resolve(serverDir, "..", "..", ".local");
const feedbackFile = path.join(feedbackDir, "explanation-feedback.json");

async function readFeedbackRecords() {
  try {
    const raw = await readFile(feedbackFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ExplanationFeedbackRecord[]) : [];
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function saveExplanationFeedback(input: ExplanationFeedbackInput) {
  const existing = await readFeedbackRecords();
  const record: ExplanationFeedbackRecord = {
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  await mkdir(feedbackDir, { recursive: true });
  await writeFile(feedbackFile, JSON.stringify([record, ...existing], null, 2), "utf8");

  return record;
}
