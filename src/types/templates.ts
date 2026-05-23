/**
 * CADx Phase 0 — TopologyTemplate match result types.
 *
 * These mirror app/domain/templates/result.py::TemplateMatchResult.to_dict().
 * Surfaced via the comparator result under `details.template_match.top_k[]`.
 */

export type TemplateForbiddenViolation = {
  component_role: string;
  student_component_id: string;
  reason: string;
};

export type TemplateMatchResult = {
  template_id: string;
  template_name: string;
  topology_label: string;
  reference_id: string | null;
  /** [0..1] — fraction of required edges satisfied (Phase 0: 0 or 1). */
  structural_score: number;
  /** [0..1] — fraction of required component roles assigned. */
  role_score: number;
  /** [0..1] — combined score used for ranking. */
  confidence: number;
  matched_variant: string | null;
  /** Map student_component_id -> ComponentSlot.role */
  role_assignments: Record<string, string>;
  /** Map student_net_id -> NetSlot.canonical_name */
  net_assignments: Record<string, string>;
  missing_required: string[];
  missing_optional: string[];
  forbidden_violations: TemplateForbiddenViolation[];
};

export type TemplateMatchSummary = {
  version: string;
  top_k: TemplateMatchResult[];
};

/**
 * Type-safe extractor: pull `details.template_match` out of the loosely
 * typed `details: Record<string, unknown>` on PipelineResult.
 */
export function extractTemplateMatch(
  details: Record<string, unknown> | undefined,
): TemplateMatchSummary | null {
  if (!details) return null;
  const tm = details.template_match;
  if (!tm || typeof tm !== "object") return null;
  const obj = tm as Record<string, unknown>;
  if (typeof obj.version !== "string") return null;
  if (!Array.isArray(obj.top_k)) return null;
  // Trust the backend shape — runtime validation here would explode the
  // bundle without much gain. JSON shape contract is enforced server-side.
  return {
    version: obj.version,
    top_k: obj.top_k as TemplateMatchResult[],
  };
}
