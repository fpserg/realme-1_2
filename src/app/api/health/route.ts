import { getHealth } from "@/application/health/get-health";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ...getHealth(),
    observedAt: new Date().toISOString(),
  });
}
