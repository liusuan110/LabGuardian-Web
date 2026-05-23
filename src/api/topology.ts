import { requestJson } from "./client";
import type {
  TopologyModelInfo,
  TopologySuggestRequest,
  TopologySuggestResponse,
} from "../types/topology";

/**
 * POST /api/v1/topology/suggest
 *
 * Run GNN-A topology classification + symbolic template cross-check.
 *
 * Pass `netlist_v2` (pipeline S3 output) for production calls, or
 * `logical_reference` for testing/debug. The response always includes
 * `enabled` + `disabled_reason` so callers can render a "sat out" widget
 * without try/except.
 *
 * Timeout: 15s. The model is tiny (< 5ms inference) but cold-start can
 * take ~1s for the first request after backend boot when the ckpt is
 * loaded into memory.
 */
export async function suggestTopology(
  payload: TopologySuggestRequest,
): Promise<TopologySuggestResponse> {
  return requestJson<TopologySuggestResponse>(
    "/api/v1/topology/suggest",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    15_000,
  );
}

/**
 * GET /api/v1/topology/model-info
 *
 * Cheap call — does NOT trigger model loading. Frontend uses this on
 * boot to decide whether to show the AI-recommendation panel.
 */
export async function getTopologyModelInfo(): Promise<TopologyModelInfo> {
  return requestJson<TopologyModelInfo>(
    "/api/v1/topology/model-info",
    { method: "GET" },
    5_000,
  );
}
