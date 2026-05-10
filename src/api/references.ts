import { requestJson } from "./client";
import type { ReferenceSummary } from "../types/pipeline";

export async function listReferences() {
  return requestJson<ReferenceSummary[]>("/api/v1/references", { method: "GET" }, 10_000);
}

export async function getReference(referenceId: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/references/${encodeURIComponent(referenceId)}`,
    { method: "GET" },
    10_000,
  );
}
