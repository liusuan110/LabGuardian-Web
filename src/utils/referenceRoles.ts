import type { LogicalReferenceNet, ManualNetRole } from "../types/pipeline";

const COARSE_ROLES = new Set(["input", "output", "power", "ground", "signal"]);
const PORT_LABELS = new Set(["UI1", "UI2", "UO1", "UO2"]);
const RAIL_LABELS = new Set(["VCC", "VEE", "VDD", "VSS", "GND"]);

export function referenceNetLabel(refNet: LogicalReferenceNet): string {
  return refNet.role_label ?? refNet.label ?? refNet.net;
}

export function normalizeReferenceRole(role: LogicalReferenceNet["role"], roleLabel: string): ManualNetRole {
  const coarse = typeof role === "string" ? role.toLowerCase() : "";
  if (COARSE_ROLES.has(coarse)) return coarse as ManualNetRole;

  const label = roleLabel.toUpperCase();
  if (label === "UI1" || label === "UI2") return "input";
  if (label === "UO1" || label === "UO2") return "output";
  if (label === "VCC" || label === "VEE" || label === "VDD" || label === "VSS") return "power";
  if (label === "GND") return "ground";
  return "signal";
}

export function referenceNetOptionLabel(refNet: LogicalReferenceNet): string {
  const label = referenceNetLabel(refNet);
  const role = normalizeReferenceRole(refNet.role, label);
  return `${label} · ${role}`;
}

/**
 * 端口型参考网络：必须由用户在前端明确标注（输入/输出端口）。
 * 这是后端 PortAnnotation 主要消费的目标。
 */
export function isPortReferenceNet(refNet: LogicalReferenceNet): boolean {
  const label = referenceNetLabel(refNet).toUpperCase();
  const role = normalizeReferenceRole(refNet.role, label);
  return role === "input" || role === "output" || PORT_LABELS.has(label);
}

/**
 * 电源轨型参考网络：通过 rail_assignments 自动赋角色，
 * 用户无需在端口面板中标注。
 */
export function isRailReferenceNet(refNet: LogicalReferenceNet): boolean {
  const label = referenceNetLabel(refNet).toUpperCase();
  const role = normalizeReferenceRole(refNet.role, label);
  return role === "power" || role === "ground" || RAIL_LABELS.has(label);
}

/**
 * 关键参考网络（端口 + 电源轨）。
 * 旧 API：保留用于兼容尚未拆分的调用点（如告警提示）。
 */
export function isCriticalReferenceNet(refNet: LogicalReferenceNet): boolean {
  return isPortReferenceNet(refNet) || isRailReferenceNet(refNet);
}
