import { requestJson } from "./client";
import type { PipelineRequest, PipelineResult, VersionInfo } from "../types/pipeline";

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
