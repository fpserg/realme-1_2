import { notFound } from "next/navigation";

import { HomeView } from "../page";

export const dynamic = "force-dynamic";

export default function Step106IntegratedFixturePage() {
  if (process.env.REALME_E2E_FIXTURE !== "1") notFound();

  return (
    <HomeView
      state={{
        accountId: "00000000-0000-4000-8000-000000000106",
        candidates: [],
        horizon: [],
        kind: "ready",
        livingWorld: {
          edges: [],
          height: 220,
          nodes: [],
          rendererVersion: "living-world-code-v1",
          structuralHash: "10600000",
          width: 320,
          worldId: "00000000-0000-4000-8000-000000000206",
        },
        observations: [],
        temporal: { currentPeriod: null, setting: null },
        today: [],
      }}
    />
  );
}
