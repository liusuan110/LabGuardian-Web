import { useMemo, useState } from "react";
import type { CircuitAnalysisResult, PipelineResult, PortVisualizationResult } from "../types/pipeline";
import {
  BREADBOARD_COLS,
  BOT_LETTERS,
  TOP_LETTERS,
  buildBreadboardModel,
  getNetColor,
  holeKey,
  type BreadboardPinRef,
  type RailKind,
} from "../utils/breadboard";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
};

// SVG 几何参数
const PAD_X = 28;
const PAD_Y = 18;
const COL_STEP = 22;       // 每列横向间距
const ROW_STEP = 20;       // 每行纵向间距
const RAIL_GAP = 14;       // 轨与矩阵之间的空隙
const CENTER_GAP = 18;     // 中央 E↔F 之间的凹槽
const HOLE_R = 5;          // 孔半径
const USED_GLOW = 11;      // 已用孔的外圈半径

const RAIL_LABELS: Record<RailKind, string> = {
  top_plus: "+",
  top_minus: "−",
  bot_plus: "+",
  bot_minus: "−",
};

const RAIL_TINT: Record<RailKind, string> = {
  top_plus: "#dc2626",
  top_minus: "#1d4ed8",
  bot_plus: "#dc2626",
  bot_minus: "#1d4ed8",
};

function colX(col: number) {
  return PAD_X + (col - 1) * COL_STEP;
}

function railY(rail: RailKind): number {
  // 顺序：top_plus(0), top_minus(1), [matrix top A-E], gap, [matrix bot F-J], bot_plus, bot_minus
  if (rail === "top_plus") return PAD_Y;
  if (rail === "top_minus") return PAD_Y + ROW_STEP;
  // 计算矩阵下方位置
  const topRailsBottom = PAD_Y + ROW_STEP;
  const matrixTopStart = topRailsBottom + RAIL_GAP;
  const matrixTopEnd = matrixTopStart + (TOP_LETTERS.length - 1) * ROW_STEP;
  const matrixBotStart = matrixTopEnd + CENTER_GAP;
  const matrixBotEnd = matrixBotStart + (BOT_LETTERS.length - 1) * ROW_STEP;
  if (rail === "bot_plus") return matrixBotEnd + RAIL_GAP;
  return matrixBotEnd + RAIL_GAP + ROW_STEP; // bot_minus
}

function matrixY(letter: string): number {
  const topIdx = TOP_LETTERS.indexOf(letter as (typeof TOP_LETTERS)[number]);
  const topRailsBottom = PAD_Y + ROW_STEP;
  const matrixTopStart = topRailsBottom + RAIL_GAP;
  if (topIdx >= 0) return matrixTopStart + topIdx * ROW_STEP;
  const botIdx = BOT_LETTERS.indexOf(letter as (typeof BOT_LETTERS)[number]);
  const matrixTopEnd = matrixTopStart + (TOP_LETTERS.length - 1) * ROW_STEP;
  const matrixBotStart = matrixTopEnd + CENTER_GAP;
  return matrixBotStart + botIdx * ROW_STEP;
}

const BOARD_WIDTH = PAD_X * 2 + (BREADBOARD_COLS - 1) * COL_STEP;
const BOARD_HEIGHT = railY("bot_minus") + PAD_Y;

type Hover = {
  x: number;
  y: number;
  netId: string;
  netRole: string;
  pins: BreadboardPinRef[];
} | null;

export function BreadboardView({ result }: Props) {
  const model = useMemo(() => buildBreadboardModel(result), [result]);
  const [hover, setHover] = useState<Hover>(null);
  const [activeNet, setActiveNet] = useState<string | null>(null);

  const usedNetIds = Array.from(model.netHoles.entries())
    .sort(([a], [b]) => {
      const aP = /VCC|GND/.test(a.toUpperCase());
      const bP = /VCC|GND/.test(b.toUpperCase());
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      return a.localeCompare(b);
    })
    .map(([id]) => id);

  if (!result || model.holes.size === 0) {
    return (
      <section className="netlist-panel">
        <div className="panel-heading">
          <h2>面包板可视化</h2>
        </div>
        <p className="muted">网表将在 S3 拓扑阶段完成后显示。</p>
      </section>
    );
  }

  // 用 holeKey 反查每个孔的位置
  function holePos(key: string): { x: number; y: number } | null {
    if (key.startsWith("M:")) {
      const m = key.slice(2).match(/^([A-J])(\d+)$/);
      if (!m) return null;
      return { x: colX(parseInt(m[2], 10)), y: matrixY(m[1]) };
    }
    if (key.startsWith("R:")) {
      const parts = key.split(":");
      const rail = parts[1] as RailKind;
      const col = parseInt(parts[2], 10);
      return { x: colX(col), y: railY(rail) };
    }
    return null;
  }

  return (
    <section className="netlist-panel">
      <div className="panel-heading">
        <h2>面包板可视化网表</h2>
        <span>
          {usedNetIds.length} nets · {Array.from(model.holes.values()).reduce((sum, l) => sum + l.length, 0)} pins
        </span>
      </div>

      <div className="breadboard-wrap">
        <svg
          className="breadboard-svg"
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 板子背景 */}
          <rect
            x={4}
            y={4}
            width={BOARD_WIDTH - 8}
            height={BOARD_HEIGHT - 8}
            rx={10}
            ry={10}
            fill="#f7f3ea"
            stroke="#d6cfbf"
            strokeWidth={1.5}
          />

          {/* 中央凹槽 */}
          {(() => {
            const topRailsBottom = PAD_Y + ROW_STEP;
            const matrixTopStart = topRailsBottom + RAIL_GAP;
            const matrixTopEnd = matrixTopStart + (TOP_LETTERS.length - 1) * ROW_STEP;
            return (
              <rect
                x={PAD_X - 12}
                y={matrixTopEnd + ROW_STEP / 2}
                width={(BREADBOARD_COLS - 1) * COL_STEP + 24}
                height={CENTER_GAP - ROW_STEP}
                fill="#e8e0cd"
                stroke="#cbc3ad"
                strokeWidth={0.8}
              />
            );
          })()}

          {/* 电源轨指示线 */}
          {(["top_plus", "top_minus", "bot_plus", "bot_minus"] as RailKind[]).map((rail) => (
            <line
              key={`rail-line-${rail}`}
              x1={PAD_X - 8}
              x2={PAD_X + (BREADBOARD_COLS - 1) * COL_STEP + 8}
              y1={railY(rail)}
              y2={railY(rail)}
              stroke={RAIL_TINT[rail]}
              strokeOpacity={0.18}
              strokeWidth={1.5}
            />
          ))}

          {/* 列号 */}
          {Array.from({ length: BREADBOARD_COLS }, (_, i) => i + 1).map((col) =>
            col % 5 === 0 || col === 1 ? (
              <text
                key={`colnum-${col}`}
                x={colX(col)}
                y={PAD_Y - 6}
                textAnchor="middle"
                className="bb-text"
              >
                {col}
              </text>
            ) : null,
          )}

          {/* 行字母 */}
          {[...TOP_LETTERS, ...BOT_LETTERS].map((l) => (
            <text
              key={`rowletter-${l}`}
              x={PAD_X - 14}
              y={matrixY(l) + 3}
              textAnchor="middle"
              className="bb-text"
            >
              {l}
            </text>
          ))}

          {/* 电源轨标签 */}
          {(["top_plus", "top_minus", "bot_plus", "bot_minus"] as RailKind[]).map((rail) => (
            <text
              key={`rail-label-${rail}`}
              x={PAD_X - 14}
              y={railY(rail) + 3}
              textAnchor="middle"
              className="bb-text rail"
              fill={RAIL_TINT[rail]}
            >
              {RAIL_LABELS[rail]}
            </text>
          ))}

          {/* 1. net 连线（同一 net 不同孔之间画连接路径，凸显电气连通） */}
          {usedNetIds.map((netId) => {
            const keys = model.netHoles.get(netId) ?? [];
            if (keys.length < 2) return null;
            const role = model.netRoles.get(netId) ?? "SIGNAL";
            const color = getNetColor(netId, role);
            const isDim = activeNet !== null && activeNet !== netId;
            const points = keys
              .map((k) => holePos(k))
              .filter((p): p is { x: number; y: number } => Boolean(p));
            if (points.length < 2) return null;
            return (
              <polyline
                key={`netpath-${netId}`}
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2.4}
                strokeOpacity={isDim ? 0.08 : 0.55}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="0"
              />
            );
          })}

          {/* 2. 全部空孔（背景） */}
          {Array.from({ length: BREADBOARD_COLS }, (_, i) => i + 1).map((col) =>
            [...TOP_LETTERS, ...BOT_LETTERS].map((letter) => {
              const k = holeKey({ kind: "matrix", row: col, letter });
              if (model.holes.has(k)) return null;
              return (
                <circle
                  key={`empty-${k}`}
                  cx={colX(col)}
                  cy={matrixY(letter)}
                  r={HOLE_R - 1}
                  fill="#1f2937"
                  fillOpacity={0.08}
                />
              );
            }),
          )}
          {(["top_plus", "top_minus", "bot_plus", "bot_minus"] as RailKind[]).flatMap((rail) =>
            Array.from({ length: BREADBOARD_COLS }, (_, i) => i + 1).map((col) => {
              const k = holeKey({ kind: "rail", rail, col });
              if (model.holes.has(k)) return null;
              return (
                <circle
                  key={`empty-${k}`}
                  cx={colX(col)}
                  cy={railY(rail)}
                  r={HOLE_R - 1.4}
                  fill={RAIL_TINT[rail]}
                  fillOpacity={0.18}
                />
              );
            }),
          )}

          {/* 3. 已用孔（高亮 + 脉冲） */}
          {Array.from(model.holes.entries()).map(([k, pins]) => {
            const pos = holePos(k);
            if (!pos) return null;
            const netId = pins[0].netId;
            const role = model.netRoles.get(netId) ?? "SIGNAL";
            const color = getNetColor(netId, role);
            const isActive = activeNet === netId;
            const isDim = activeNet !== null && !isActive;
            return (
              <g
                key={`used-${k}`}
                className="bb-used"
                style={{ opacity: isDim ? 0.18 : 1 }}
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  const scale = rect.width / BOARD_WIDTH;
                  setHover({
                    x: pos.x * scale + 8,
                    y: pos.y * scale - 8,
                    netId,
                    netRole: role,
                    pins,
                  });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={() => setActiveNet((cur) => (cur === netId ? null : netId))}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={USED_GLOW}
                  fill={color}
                  fillOpacity={isActive ? 0.32 : 0.18}
                  className="bb-pulse"
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={HOLE_R + 1}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.4}
                />
              </g>
            );
          })}
        </svg>

        {hover ? (
          <div className="bb-tooltip" style={{ left: hover.x, top: hover.y }}>
            <div className="bb-tooltip-net">
              <span
                className="bb-tooltip-dot"
                style={{ background: getNetColor(hover.netId, hover.netRole) }}
              />
              <strong>{hover.netId}</strong>
              {hover.netRole !== "SIGNAL" ? <span className="bb-role-tag">{hover.netRole}</span> : null}
            </div>
            <ul>
              {hover.pins.map((p, i) => (
                <li key={i}>
                  <span className="bb-tooltip-comp">{p.componentId}</span>
                  <span className="bb-tooltip-pin">{p.pinName}</span>
                  <span className="bb-tooltip-hole">@{p.holeId}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* 图例 / net 索引 */}
      <div className="bb-legend">
        {usedNetIds.map((netId) => {
          const role = model.netRoles.get(netId) ?? "SIGNAL";
          const color = getNetColor(netId, role);
          const compCount = model.netComponents.get(netId)?.size ?? 0;
          const holeCount = model.netHoles.get(netId)?.length ?? 0;
          const isActive = activeNet === netId;
          return (
            <button
              key={netId}
              type="button"
              className={`bb-legend-item ${isActive ? "active" : ""}`}
              onClick={() => setActiveNet((cur) => (cur === netId ? null : netId))}
              onMouseEnter={() => setActiveNet(netId)}
              onMouseLeave={() => !isActive && setActiveNet(null)}
            >
              <span className="bb-legend-dot" style={{ background: color }} />
              <span className="bb-legend-name">{netId}</span>
              {role !== "SIGNAL" ? <span className={`bb-role-tag ${role.toLowerCase()}`}>{role}</span> : null}
              <span className="bb-legend-meta">
                {compCount} 元件 · {holeCount} 孔
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
