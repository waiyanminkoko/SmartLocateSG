"use client";

import { useEffect, useState } from "react";
import {
  countMrtExits,
  countBusStops,
  getMrtExitsNearby,
  getBusStopsNearby,
    getAccessibilityScore,
} from "@/lib/api/transport"; // make sure these exist
import { getDemographicScore } from "@/lib/api/demographic";

export default function Test() {
  const [mrtCount, setMrtCount] = useState<number | null>(null);
  const [busCount, setBusCount] = useState<number | null>(null);
  const [mrtList, setMrtList] = useState<any[]>([]);
  const [busList, setBusList] = useState<any[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [accessibility, setAccessibility] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCountsAndList() {
      try {
        console.log("Fetching transport counts and lists...");

        // Counts
        const mrt = await countMrtExits(1.346391, 103.682186, 2000);
        const bus = await countBusStops(1.346391, 103.682186, 2000);
        setMrtCount(mrt);
        setBusCount(bus);

        // Nearby rows
        const mrtRows = await getMrtExitsNearby(1.346391, 103.682186, 2000);
        const busRows = await getBusStopsNearby(1.346391, 103.682186, 2000);
        setMrtList(mrtRows);
        setBusList(busRows);

        console.log("Nearby MRT:", mrtRows);
        console.log("Nearby Bus Stops:", busRows);

        const result = await getDemographicScore(
          "Changi", // planning area
          ["18-24", "25-34"], // selected age groups
          ["Middle", "Upper-Middle"] // selected income bands
        );
        setScore(result);

        const acc = await getAccessibilityScore(1.346391, 103.682186, 1000);
        setAccessibility(acc);
      } catch (err) {
        console.error("Error fetching transport data:", err);
        setError((err as Error).message);
      }
    }

    fetchCountsAndList();
  }, []);

  return (
    <div>
        <h1>Demographic Score</h1>
      {error && <p>Error: {error}</p>}
      <p>Score: {score !== null ? score.toFixed(2) : "Loading..."}</p>
      <p>Accessibility Score: {accessibility !== null ? accessibility.toFixed(2) : "Loading..."}</p>
      <h1>Nearby Transport</h1>
      {error && <p>Error: {error}</p>}

      <p>MRT Exits: {mrtCount ?? "Loading..."}</p>
      <ul>
        {mrtList.map((exit) => (
          <li key={`${exit.station_name}-${exit.exit_number}`}>
            {exit.station_name} (Exit {exit.exit_number}) - {exit.latitude}, {exit.longitude}
          </li>
        ))}
      </ul>

      <p>Bus Stops: {busCount ?? "Loading..."}</p>
      <ul>
        {busList.map((stop) => (
          <li key={stop.bus_stop_number}>
            {stop.bus_stop_number} - {stop.latitude}, {stop.longitude}
          </li>
        ))}
      </ul>
    </div>
  );
}