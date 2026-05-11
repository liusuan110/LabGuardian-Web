export type JobStatus = "pending" | "running" | "completed" | "failed";

export type PipelineStageName =
  | "detect"
  | "pin_detect"
  | "mapping"
  | "topology"
  | "validate"
  | "semantic_analysis";

export type RiskLevel = "safe" | "warning" | "danger" | string;

export type RailAssignments = {
  top_plus: string;
  top_minus: string;
  bot_plus: string;
  bot_minus: string;
};

export type ReferenceSummary = {
  reference_id: string;
  name: string;
  description?: string;
  format: "logical_reference_v1" | string;
  component_count: number;
  net_count: number;
};

export type PipelineRequest = {
  station_id: string;
  images_b64: string[];
  conf: number;
  iou: number;
  imgsz: number;
  reference_id?: string | null;
  reference_circuit?: Record<string, unknown> | null;
  rail_assignments?: RailAssignments;
};

export type ManualCorrectionPatch = {
  component_id: string;
  pin_name: string;
  from_hole_id: string;
  to_hole_id: string;
  source: "manual_drag";
};

export type ManualNetRole = "VIN" | "VOUT" | "VCC" | "GND";

export type ManualNetRoleAssignment = {
  role: ManualNetRole;
  source?: "manual_netlist_select";
  component_id?: string | null;
  pin_name?: string | null;
  hole_id?: string | null;
  electrical_node_id?: string | null;
  electrical_net_id?: string | null;
};

export type ManualPinPolarityAssignment = {
  component_id: string;
  pin_name: string;
  polarity: "E" | "B" | "C";
  source?: "manual_pin_polarity_select";
};

export type CorrectedRecomputeRequest = {
  station_id: string;
  job_id?: string | null;
  components: PipelineComponent[];
  corrections: ManualCorrectionPatch[];
  rail_assignments?: RailAssignments;
  reference_id?: string | null;
  reference_circuit?: Record<string, unknown> | null;
  net_role_assignments?: ManualNetRoleAssignment[];
  pin_polarity_assignments?: ManualPinPolarityAssignment[];
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
  pin_display_name?: string;
  polarity_role?: string;
  polarity_candidate_role?: string;
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

export type EvidenceRef =
  | { type: "component"; component_id: string }
  | { type: "pin"; component_id: string; pin_name: string; hole_id?: string }
  | { type: "net"; electrical_net_id: string }
  | { type: "reference_component"; component_id: string };

export type ComparisonReportItem = {
  error_code: string;
  error_family?: string;
  severity?: "fatal" | "error" | "warning" | "info" | string;
  title?: string;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  component_ref?: unknown;
  component_actual?: unknown;
  evidence_refs?: EvidenceRef[];
  suggested_action?: string;
};

export type ComparisonReport = {
  version?: string;
  summary?: {
    comparison_mode?: string;
    logic_correct?: boolean;
    similarity?: number;
    reference_id?: string;
    reference_name?: string;
    total_item_count?: number;
    ignore_component_id?: boolean;
    ignore_hole_id?: boolean;
    ignore_passive_pin_order?: boolean;
    ignore_polarity?: boolean;
  };
  items?: ComparisonReportItem[];
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
  circuit_type_guess?: Record<string, unknown>;
  recognized_roles?: Record<string, unknown>;
  matched_template?: Record<string, unknown>;
  wiring_errors?: Array<Record<string, unknown>>;
  suggested_pin_moves?: Array<Record<string, unknown>>;
  student_hint?: string;
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

export type PinLocation = {
  pin_id: number;
  pin_name: string;
  pin_display_name?: string;
  polarity_role?: string;
  polarity_candidate_role?: string;
  hole_id: string;
  logic_loc?: [string, string];
  x_warp?: number;
  y_warp?: number;
  x_image?: number;
  y_image?: number;
  electrical_node_id?: string;
  electrical_net_id?: string;
};

export type ComponentWithPins = {
  component_id: string;
  component_type: string;
  package_type: string;
  polarity: string;
  confidence: number;
  pins: PinLocation[];
  bbox?: number[];
};

export type ElectricalNet = {
  electrical_net_id: string;
  power_role: string;
  member_node_ids: string[];
  member_hole_ids: string[];
};

export type CircuitAnalysisResult = {
  job_id: string;
  station_id: string;
  status: JobStatus;
  total_duration_ms: number;
  components: ComponentWithPins[];
  component_count: number;
  nets: ElectricalNet[];
  net_count: number;
  topology_graph: Record<string, unknown>;
  circuit_description: string;
  rail_assignments: RailAssignments;
};

export type Port = {
  port_id: string;
  pin_id: number;
  pin_name: string;
  component_id: string;
  component_type: string;
  hole_id: string;
  row_number: number;
  col_name: string;
  is_power_rail: boolean;
  power_role?: string;
  net_id: string;
  net_name?: string;
  x_image?: number;
  y_image?: number;
};

export type VisualizationNet = {
  net_id: string;
  net_name?: string;
  power_role: string;
  member_hole_ids: string[];
  member_port_ids: string[];
};

export type VisualizationComponent = {
  component_id: string;
  component_type: string;
  package_type: string;
  confidence: number;
  bbox?: number[];
  ports: Port[];
};

export type PortVisualizationResult = {
  job_id: string;
  station_id: string;
  status: JobStatus;
  total_duration_ms: number;
  ports: Port[];
  nets: VisualizationNet[];
  components: VisualizationComponent[];
  component_count: number;
  net_count: number;
  port_count: number;
  bounding_box?: {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  };
  statistics?: {
    power_rail_port_count: number;
    signal_port_count: number;
    isolated_port_count: number;
  };
};
