import type { LogicalReferenceNet, ManualNetRole } from "../types/pipeline";

const COARSE_ROLES = new Set(["input", "output", "power", "ground", "signal"]);

export function referenceNetLabel(refNet: LogicalReferenceNet): string {
  return refNet.role_label ?? refNet.label ?? refNet.net;
}

export function normalizeReferenceRole(role: LogicalReferenceNet["role"], roleLabel: string): ManualNetRole {
  const coarse = typeof role === "string" ? role.toLowerCase() : "";
  if (COARSE_ROLES.has(coarse)) return coarse as ManualNetRole;

  const label = roleLabel.toUpperCase();
  if (label === "UI1" || label === "UI2") return "input";
  if (label === "UO1" || label === "UO2") return "output";
  if (label === "VCC" || label === "VEE") return "power";
  if (label === "GND") return "ground";
  return "signal";
}

export function referenceNetOptionLabel(refNet: LogicalReferenceNet): string {
  const label = referenceNetLabel(refNet);
  const role = normalizeReferenceRole(refNet.role, label);
  return `${label} · ${role}`;
}

export function isCriticalReferenceNet(refNet: LogicalReferenceNet): boolean {
  const label = referenceNetLabel(refNet);
  const role = normalizeReferenceRole(refNet.role, label);
  if (role === "input" || role === "output" || role === "power" || role === "ground") return true;
  return ["UI1", "UI2", "UO1", "UO2", "VCC", "VEE", "GND"].includes(label.toUpperCase());
}
