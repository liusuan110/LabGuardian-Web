/**
 * CADx Phase 1 — TopologyClassifier (GNN-A) types.
 *
 * Mirrors `app/schemas/topology.py` Pydantic DTOs on the backend.
 *
 * Surfaced via:
 *   - `POST /api/v1/topology/suggest` → main inference endpoint
 *   - `GET  /api/v1/topology/model-info` → ckpt availability check
 */

/** One label's GNN softmax probability. */
export type TopologyPrediction = {
  label: string;
  display_name_zh: string;
  display_name_en: string;
  /** [0, 1] — softmax probability. */
  confidence: number;
  /** 1-based rank in confidence-descending order. */
  rank: number;
  /** Matching symbolic template id (null for `unknown` class). */
  template_id: string | null;
  /** Matching reference DSL id. */
  reference_id: string | null;
};

/** Disabled reason vocabulary — mirrors GnnAdvice's same field for UI reuse. */
export type TopologyDisabledReason =
  | "checkpoint_missing"
  | "runtime_unavailable"
  | "model_failed"
  | "tiny_graph"
  | string; // string fallback for `invalid_netlist: ...` etc.

/** GNN-vs-template cross-check result. */
export type TopologyConsensus = {
  agreed: boolean;
  recommended_label: string;
  recommended_template_id: string | null;
  recommended_reference_id: string | null;
  confidence_band: "high" | "medium" | "low" | "disagreement";
};

export type TopologyGraphStats = {
  num_nodes: number;
  num_edges: number;
  num_comp_nodes: number;
  num_net_nodes: number;
};

/** Full response shape for `POST /api/v1/topology/suggest`. */
export type TopologySuggestResponse = {
  enabled: boolean;
  disabled_reason: TopologyDisabledReason | null;
  gnn_predictions: TopologyPrediction[];
  /** Each element is a `TemplateMatchResult.to_dict()` (kept untyped here). */
  template_matches: Array<Record<string, unknown>>;
  consensus: TopologyConsensus | null;
  model_version: string;
  inference_ms: number;
  graph_stats: TopologyGraphStats;
};

/** Request body for `POST /api/v1/topology/suggest`. */
export type TopologySuggestRequest = {
  /** Pipeline S3 netlist_v2 (preferred). */
  netlist_v2?: Record<string, unknown>;
  /** Alternative: logical_reference_v1 payload. */
  logical_reference?: Record<string, unknown>;
  /** How many predictions to return (1..7). */
  top_k?: number;
};

/** `GET /api/v1/topology/model-info` response. */
export type TopologyModelInfo = {
  available: boolean;
  ckpt_path: string;
  ckpt_exists: boolean;
  model_version: string;
  num_classes: number;
  labels: string[];
  load_error: string | null;
};
