import { requestJson } from "./client";
import type {
  CorrectedRecomputeRequest,
  PipelineRequest,
  PipelineResult,
  VersionInfo,
} from "../types/pipeline";

export async function getHealth() {
  return requestJson<{ status: string }>("/health", { method: "GET" }, 10_000);
}

export async function getVersion() {
  return requestJson<VersionInfo>("/version", { method: "GET" }, 10_000);
}

export async function runPipeline(request: PipelineRequest) {
  return requestJson<PipelineResult>("/api/v1/pipeline/run", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function recomputeCorrected(request: CorrectedRecomputeRequest) {
  return requestJson<PipelineResult>("/api/v1/pipeline/recompute-corrected", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
