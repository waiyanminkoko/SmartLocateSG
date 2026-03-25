import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ExplanationFeedbackButtonsProps = {
  page: "map" | "portfolio" | "compare";
  criterion: string;
  profileId?: string | null;
  siteId?: string | null;
};

export function ExplanationFeedbackButtons({
  page,
  criterion,
  profileId,
  siteId,
}: ExplanationFeedbackButtonsProps) {
  const { toast } = useToast();
  const [selectedVote, setSelectedVote] = useState<"helpful" | "not_helpful" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitVote = async (vote: "helpful" | "not_helpful") => {
    setSubmitting(true);

    try {
      const response = await fetch("/api/explanation-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page,
          profileId: profileId ?? null,
          siteId: siteId ?? null,
          criterion,
          vote,
        }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      setSelectedVote(vote);
      toast({
        title: "Feedback saved",
        description: vote === "helpful" ? "Marked as helpful." : "Marked as not helpful.",
      });
    } catch {
      toast({
        title: "Feedback unavailable",
        description: "Could not save explanation feedback right now.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">Was this useful?</span>
      <Button
        type="button"
        size="sm"
        variant={selectedVote === "helpful" ? "default" : "outline"}
        className="h-7 px-2 text-[11px]"
        disabled={submitting}
        onClick={() => {
          void submitVote("helpful");
        }}
      >
        Helpful
      </Button>
      <Button
        type="button"
        size="sm"
        variant={selectedVote === "not_helpful" ? "default" : "outline"}
        className="h-7 px-2 text-[11px]"
        disabled={submitting}
        onClick={() => {
          void submitVote("not_helpful");
        }}
      >
        Not helpful
      </Button>
    </div>
  );
}
