export type BusinessProfile = {
  id: string;
  name: string;
  sector: string;
  priceBand: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
  updatedAt: string;
  active?: boolean;
};

export type CandidateSite = {
  id: string;
  name: string;
  address: string;
  composite: number;
  demographic: number;
  accessibility: number;
  rental: number;
  competition: number;
  savedAt: string;
  notes?: string;
  profileId: string;
  lat?: number;
  lng?: number;
  planningAreaId?: string;
  breakdownDetailsJson?: Record<string, unknown>;
};

export function getCandidateSiteDisplayName(
  site: Pick<CandidateSite, "name" | "address" | "lat" | "lng">,
) {
  const trimmedName = site.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const trimmedAddress = site.address?.trim();
  if (trimmedAddress) {
    return trimmedAddress.split(",")[0]?.trim() || trimmedAddress;
  }

  if (typeof site.lat === "number" && typeof site.lng === "number") {
    return `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`;
  }

  return "Saved site";
}

export const mockProfiles: BusinessProfile[] = [
  {
    id: "p1",
    name: "Cafe",
    sector: "Supermarket/Retail",
    priceBand: "$21–$50",
    ageGroups: ["25–34", "35–44", "55–64"],
    incomeBands: ["Lower-Middle", "Middle"],
    operatingModel: "Mixed",
    updatedAt: "Feb 4, 2026",
    active: true,
  },
  {
    id: "p2",
    name: "Fitness Studio",
    sector: "Health & wellness",
    priceBand: "$51–$100",
    ageGroups: ["18–24", "25–34", "35–44"],
    incomeBands: ["Middle", "Upper-Middle"],
    operatingModel: "Walk-in",
    updatedAt: "Feb 1, 2026",
  },
];

export const mockSites: CandidateSite[] = [
  {
    id: "s1",
    name: "Tiong Bahru MRT (Exit A)",
    address: "Tiong Bahru Rd, Singapore",
    composite: 82,
    demographic: 76,
    accessibility: 92,
    rental: 68,
    competition: 71,
    savedAt: "Feb 4, 2026",
    notes: "Strong weekday footfall; check nearby competitors on weekends.",
    profileId: "p1",
    lat: 1.2868,
    lng: 103.8274,
  },
  {
    id: "s2",
    name: "Paya Lebar Quarter",
    address: "10 Paya Lebar Rd, Singapore",
    composite: 78,
    demographic: 72,
    accessibility: 90,
    rental: 61,
    competition: 69,
    savedAt: "Feb 3, 2026",
    notes: "High accessibility; watch rental pressure.",
    profileId: "p1",
    lat: 1.3172,
    lng: 103.8927,
  },
  {
    id: "s3",
    name: "Jurong East (JEM)",
    address: "50 Jurong Gateway Rd, Singapore",
    composite: 74,
    demographic: 70,
    accessibility: 86,
    rental: 58,
    competition: 64,
    savedAt: "Feb 2, 2026",
    notes: "Good family demographic; dense competition cluster.",
    profileId: "p2",
    lat: 1.3333,
    lng: 103.7436,
  },
];
