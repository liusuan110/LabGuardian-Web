export type JobStatus = "pending" | "running" | "completed" | "failed";

export type PipelineStageName =
  | "detect"
  | "pin_detect"
  | "mapping"
  | "topology"
  | "validate";

export type RiskLevel = "safe" | "warning" | "danger" | string;

export type RailAssignments = {
  top_plus: string;
  top_minus: string;
  bot_plus: string;
  bot_minus: string;
};

export type PipelineRequest = {
  station_id: string;
  images_b64: string[];
  conf: number;
  iou: number;
  imgsz: number;
  reference_circuit?: Record<string, unknown> | null;
  rail_assignments?: RailAssignments;
};

export type Detection = {
  component_id?: string;
  class_name?: string;
  component_type?: string;
  package_type?: string;
  confidence?: number;
  bbox?: number[];
  orientation?: number;
  view_id?: string;
  source?: string;
};

export type Pin = {
  pin_id?: number;
  pin_name?: string;
  keypoints_by_view?: Record<string, number[] | null>;
  confidence?: number;
  source?: string;
  source_by_view?: Record<string, string>;
  logic_loc?: string;
  hole_id?: string;
  electrical_node_id?: string;
  candidate_hole_ids?: string[];
  candidate_node_ids?: string[];
  is_ambiguous?: boolean;
  ambiguity_reasons?: string[];
};

export type PipelineComponent = {
  component_id?: string;
  component_type?: string;
  class_name?: string;
  package_type?: string;
  bbox?: number[];
  confidence?: number;
  orientation?: number;
  pins?: Pin[];
};

export type NetlistV2 = {
  nets?: Array<{
    net_id?: string;
    electrical_net_id?: string;
    nodes?: string[];
    pins?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  }>;
  components?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type StageData = {
  interface_version?: string;
  detector_backend?: string;
  pin_detector_backend?: string;
  pin_detector_mode?: string;
  detections?: Detection[];
  components?: PipelineComponent[];
  calibration?: Record<string, unknown>;
  netlist_v2?: NetlistV2;
  topology_graph?: Record<string, unknown>;
  circuit_description?: string;
  is_correct?: boolean;
  diagnosis?: string;
  risk_level?: RiskLevel;
  similarity?: number;
  progress?: number;
  diagnostics?: string[];
  comparison_report?: Record<string, unknown>;
  risk_reasons?: string[];
  details?: Record<string, unknown>;
  [key: string]: unknown;
};

export type StageResult = {
  stage: PipelineStageName;
  status: JobStatus;
  duration_ms: number;
  data: StageData;
  errors: string[];
};

export type PipelineResult = {
  job_id: string;
  station_id: string;
  status: JobStatus;
  stages: StageResult[];
  total_duration_ms: number;
  component_count: number;
  net_count: number;
  progress: number;
  similarity: number;
  diagnostics: string[];
  comparison_report: Record<string, unknown>;
  risk_level: RiskLevel;
  risk_reasons: string[];
  report: string;
  runtime_metadata: Record<string, unknown>;
};

export type VersionInfo = {
  code_version?: string;
  model_version?: string;
  kb_version?: string;
  rule_version?: string;
  [key: string]: unknown;
};
