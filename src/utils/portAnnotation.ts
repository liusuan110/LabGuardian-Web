import type { LogicalReferenceNet, PortAnnotation } from "../types/pipeline";
import { normalizeReferenceRole, referenceNetLabel } from "./referenceRoles";

/**
 * 端口标注 Map 的 key 约定：`net:<electrical_net_id>`
 */
export function portAnnotationKey(electricalNetId: string): string {
  return `net:${electricalNetId}`;
}

/**
 * 由参考端口网络 + 当前 electrical_net_id 构造一个 PortAnnotation。
 * label 取参考侧 role_label（如 UI1/UO1），role 仅可能是 input/output。
 */
export function buildPortAnnotation(
  refNet: LogicalReferenceNet,
  electricalNetId: string,
): PortAnnotation | null {
  const label = referenceNetLabel(refNet);
  const role = normalizeReferenceRole(refNet.role, label);
  if (role !== "input" && role !== "output") return null;
  return {
    role,
    label,
    target: { electrical_net_id: electricalNetId },
    source: "port_annotation",
  };
}

export function portAnnotationsToList(map: Map<string, PortAnnotation>): PortAnnotation[] {
  return Array.from(map.values());
}
