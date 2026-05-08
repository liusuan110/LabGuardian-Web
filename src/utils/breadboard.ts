import type {
  CircuitAnalysisResult,
  PipelineResult,
  PortVisualizationResult,
} from "../types/pipeline";
import { getStageData } from "./pipeline";

/** 标准面包板：30 列，上半区 A-E，下半区 F-J，加 4 根电源轨 */
export const BREADBOARD_COLS = 30;
export const TOP_LETTERS = ["A", "B", "C", "D", "E"] as const;
export const BOT_LETTERS = ["F", "G", "H", "I", "J"] as const;
export type RailKind = "top_plus" | "top_minus" | "bot_plus" | "bot_minus";

export type HoleAddr =
  | { kind: "matrix"; row: number; letter: string }
  | { kind: "rail"; rail: RailKind; col: number };

export type BreadboardPinRef = {
  componentId: string;
  componentType: string;
  pinName: string;
  netId: string;
  holeId: string;
};

export type BreadboardModel = {
  /** 关键：holeKey -> 端口列表 */
  holes: Map<string, BreadboardPinRef[]>;
  /** netId -> hole keys (含真实占位的孔) */
  netHoles: Map<string, string[]>;
  /** netId -> 显示用名称 */
  netLabels: Map<string, string>;
  /** netId -> 电源角色 (VCC / GND / SIGNAL) */
  netRoles: Map<string, string>;
  /** netId -> 涉及的元件 id 集合 */
  netComponents: Map<string, Set<string>>;
};

export function holeKey(addr: HoleAddr): string {
  if (addr.kind === "matrix") return `M:${addr.letter}${addr.row}`;
  return `R:${addr.rail}:${addr.col}`;
}

/** 把 hole_id 字符串解析成可绘制的地址。支持：A12 / e5 / +12 / -3 / TOP+12 / BOT-5 / top_plus@12 等 */
export function parseHoleId(raw: string | undefined | null): HoleAddr | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;

  // 矩阵孔：字母 + 数字，例如 A12, E5, j30
  const m = s.match(/^([A-J])\s*(\d{1,2})$/);
  if (m) {
    const letter = m[1];
    const row = parseInt(m[2], 10);
    if (row >= 1 && row <= BREADBOARD_COLS && /[A-J]/.test(letter)) {
      return { kind: "matrix", row, letter };
    }
  }

  // 直接 +12 / -3 → 默认顶部电源轨
  const rail1 = s.match(/^([+\-])\s*(\d{1,2})$/);
  if (rail1) {
    const col = parseInt(rail1[2], 10);
    return {
      kind: "rail",
      rail: rail1[1] === "+" ? "top_plus" : "top_minus",
      col,
    };
  }

  // TOP+12 / TOP-12 / BOT+5 / BOT-5
  const rail2 = s.match(/^(TOP|BOT|BOTTOM)\s*([+\-])\s*(\d{1,2})$/);
  if (rail2) {
    const isTop = rail2[1] === "TOP";
    const isPlus = rail2[2] === "+";
    return {
      kind: "rail",
      rail: isTop ? (isPlus ? "top_plus" : "top_minus") : isPlus ? "bot_plus" : "bot_minus",
      col: parseInt(rail2[3], 10),
    };
  }

  // top_plus@12 / TOP_PLUS_12 等下划线格式
  const rail3 = s.match(/^(TOP_PLUS|TOP_MINUS|BOT_PLUS|BOT_MINUS)[_@\- ]?(\d{1,2})$/);
  if (rail3) {
    const map: Record<string, RailKind> = {
      TOP_PLUS: "top_plus",
      TOP_MINUS: "top_minus",
      BOT_PLUS: "bot_plus",
      BOT_MINUS: "bot_minus",
    };
    return { kind: "rail", rail: map[rail3[1]], col: parseInt(rail3[2], 10) };
  }

  return null;
}

function inferRole(netId: string): string {
  const u = netId.toUpperCase();
  if (u.includes("VCC") || u === "5V" || u === "3V3") return "VCC";
  if (u.includes("GND") || u === "0V") return "GND";
  return "SIGNAL";
}

function pushPin(model: BreadboardModel, addr: HoleAddr, ref: BreadboardPinRef) {
  const key = holeKey(addr);
  const list = model.holes.get(key) ?? [];
  list.push(ref);
  model.holes.set(key, list);

  const netList = model.netHoles.get(ref.netId) ?? [];
  if (!netList.includes(key)) netList.push(key);
  model.netHoles.set(ref.netId, netList);

  const comps = model.netComponents.get(ref.netId) ?? new Set<string>();
  comps.add(ref.componentId);
  model.netComponents.set(ref.netId, comps);

  if (!model.netLabels.has(ref.netId)) model.netLabels.set(ref.netId, ref.netId);
  if (!model.netRoles.has(ref.netId)) model.netRoles.set(ref.netId, inferRole(ref.netId));
}

export function buildBreadboardModel(
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null,
): BreadboardModel {
  const model: BreadboardModel = {
    holes: new Map(),
    netHoles: new Map(),
    netLabels: new Map(),
    netRoles: new Map(),
    netComponents: new Map(),
  };
  if (!result) return model;

  // PortVisualizationResult: 最干净的数据源
  if ("ports" in result && Array.isArray((result as PortVisualizationResult).ports)) {
    const r = result as PortVisualizationResult;
    r.ports.forEach((p) => {
      const addr = parseHoleId(p.hole_id) ?? parseHoleId(`${p.col_name}${p.row_number}`);
      if (!addr) return;
      const ref: BreadboardPinRef = {
        componentId: p.component_id,
        componentType: p.component_type,
        pinName: p.pin_name || `pin${p.pin_id}`,
        netId: p.net_id || "UNKNOWN",
        holeId: p.hole_id,
      };
      pushPin(model, addr, ref);
    });
    r.nets?.forEach((n) => {
      if (n.net_name) model.netLabels.set(n.net_id, n.net_name);
      if (n.power_role) model.netRoles.set(n.net_id, n.power_role.toUpperCase());
    });
    return model;
  }

  // CircuitAnalysisResult
  if ("components" in result && Array.isArray((result as CircuitAnalysisResult).nets)) {
    const r = result as CircuitAnalysisResult;
    r.components.forEach((comp) => {
      comp.pins.forEach((pin) => {
        const netId = pin.electrical_net_id || pin.electrical_node_id || "UNKNOWN";
        const addr = parseHoleId(pin.hole_id);
        if (!addr) return;
        pushPin(model, addr, {
          componentId: comp.component_id,
          componentType: comp.component_type,
          pinName: pin.pin_name || `pin${pin.pin_id}`,
          netId,
          holeId: pin.hole_id,
        });
      });
    });
    r.nets?.forEach((n) => {
      if (n.power_role) model.netRoles.set(n.electrical_net_id, n.power_role.toUpperCase());
    });
    return model;
  }

  // PipelineResult: 走 mapping 阶段
  const mapping = getStageData(result, "mapping");
  const components = (mapping.components as PipelineResult["stages"][number]["data"]["components"]) ?? [];
  components?.forEach((comp) => {
    comp.pins?.forEach((pin) => {
      const addr = parseHoleId(pin.hole_id);
      if (!addr) return;
      pushPin(model, addr, {
        componentId: comp.component_id ?? "?",
        componentType: comp.component_type ?? comp.class_name ?? "UNKNOWN",
        pinName: pin.pin_name ?? `pin${pin.pin_id}`,
        netId: pin.electrical_node_id ?? "UNKNOWN",
        holeId: pin.hole_id ?? "",
      });
    });
  });
  return model;
}

const NET_COLORS = [
  "#14796b", "#2563eb", "#b7791f", "#be3144", "#7b1fa2",
  "#4caf50", "#ff5722", "#00bcd4", "#ff9800", "#e91e63",
  "#607d8b", "#8bc34a", "#ffc107", "#03a9f4", "#9c27b0",
];

export function getNetColor(netId: string, role?: string): string {
  if (role === "VCC") return "#dc2626";
  if (role === "GND") return "#1f2937";
  let hash = 0;
  for (let i = 0; i < netId.length; i++) {
    hash = netId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NET_COLORS[Math.abs(hash) % NET_COLORS.length];
}
