import type { CandidateSite } from "@/lib/mock-data";

export type ExplanationInsight = {
  criterion: string;
  detail: string;
};

function pickWeakestMetric(site: CandidateSite) {
  const metrics = [
    { label: "Demographic match", value: site.demographic },
    { label: "Accessibility", value: site.accessibility },
    { label: "Rental pressure", value: site.rental },
    { label: "Competition density", value: site.competition },
  ];

  return metrics.sort((left, right) => left.value - right.value)[0];
}

export function buildPortfolioInsights(site: CandidateSite): ExplanationInsight[] {
  const weakestMetric = pickWeakestMetric(site);

  return [
    {
      criterion: "Overall fit",
      detail:
        site.composite >= 75
          ? `${site.name} is currently one of the stronger saved options with a composite score of ${site.composite}.`
          : `${site.name} is still a candidate, but the current composite score of ${site.composite} suggests more validation is needed.`,
    },
    {
      criterion: "Main constraint",
      detail: `${weakestMetric.label} is the weakest dimension for this site at ${weakestMetric.value}/100.`,
    },
    {
      criterion: "Decision signal",
      detail:
        site.accessibility >= site.rental
          ? "Transit access is holding up better than the cost side, so validate footfall before discarding this site."
          : "Cost pressure is currently the bigger risk, so compare nearby alternatives before committing.",
    },
  ];
}

export function buildCompareInsights(sites: CandidateSite[]): ExplanationInsight[] {
  if (sites.length < 2) {
    return [];
  }

  const strongestComposite = [...sites].sort((left, right) => right.composite - left.composite)[0];
  const strongestAccessibility = [...sites].sort(
    (left, right) => right.accessibility - left.accessibility,
  )[0];
  const lowestRentalPressure = [...sites].sort((left, right) => right.rental - left.rental)[0];

  return [
    {
      criterion: "Top composite score",
      detail: `${strongestComposite.name} currently leads the comparison at ${strongestComposite.composite}/100.`,
    },
    {
      criterion: "Best accessibility",
      detail: `${strongestAccessibility.name} has the strongest transit accessibility score at ${strongestAccessibility.accessibility}/100.`,
    },
    {
      criterion: "Best cost position",
      detail: `${lowestRentalPressure.name} has the most favorable rental-pressure score at ${lowestRentalPressure.rental}/100.`,
    },
  ];
}
