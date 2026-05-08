import { useMemo, useState } from "react";
import type { CircuitAnalysisResult, PipelineResult, PortVisualizationResult } from "../types/pipeline";
import {
  ALL_STRIPS,
  BREADBOARD_COLS,
  BOT_LETTERS,
  HALF_BOUNDARY,
  TOP_LETTERS,
  buildBreadboardModel,
  getNetColor,
  holeKey,
  parseHoleId,
  type BreadboardPinRef,
  type RailKind,
  type StripKind,
} from "../utils/breadboard";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
};

// SVG 几何参数
const PAD_X = 28;
const PAD_Y = 22;
const COL_STEP = 13;       // 60 列下每列横向间距
const ROW_STEP = 18;       // 每行纵向间距
const RAIL_GAP = 14;       // 轨与矩阵之间的空隙
const CENTER_GAP = 22;     // 中央 E↔F 之间的凹槽
const CENTER_X_GAP = 14;   // 中央左右半之间的横向断开 (col 30↔31)
const HOLE_R = 4.4;        // 孔半径
const USED_GLOW = 9;       // 已用孔的外圈半径

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
  // 60 列板：col 31 起整体右移 CENTER_X_GAP 体现物理中央断开
  const extra = col > HALF_BOUNDARY ? CENTER_X_GAP : 0;
  return PAD_X + (col - 1) * COL_STEP + extra;
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

const BOARD_WIDTH = PAD_X * 2 + (BREADBOARD_COLS - 1) * COL_STEP + CENTER_X_GAP;
const BOARD_HEIGHT = railY("bot_minus") + PAD_Y;

const STRIP_PAD = 7;
const STRIP_WIDTH = HOLE_R * 2 + 6;
const STRIP_HEIGHT = HOLE_R * 2 + 6;

type StripGeom = { x: number; y: number; w: number; h: number; cx: number; cy: number; rx: number };

function stripGeometry(kind: StripKind): StripGeom {
  if (kind.kind === "matrix") {
    const letters = kind.half === "top" ? TOP_LETTERS : BOT_LETTERS;
    const yTop = matrixY(letters[0]) - STRIP_PAD;
    const yBot = matrixY(letters[letters.length - 1]) + STRIP_PAD;
    const x = colX(kind.col) - STRIP_WIDTH / 2;
    return {
      x,
      y: yTop,
      w: STRIP_WIDTH,
      h: yBot - yTop,
      cx: colX(kind.col),
      cy: (yTop + yBot) / 2,
      rx: STRIP_WIDTH / 2,
    };
  }
  // rail half: L 段覆盖 col 1..HALF_BOUNDARY，R 段覆盖 col HALF_BOUNDARY+1..BREADBOARD_COLS
  const startCol = kind.half === "L" ? 1 : HALF_BOUNDARY + 1;
  const endCol = kind.half === "L" ? HALF_BOUNDARY : BREADBOARD_COLS;
  const x = colX(startCol) - 8;
  const xEnd = colX(endCol) + 8;
  const w = xEnd - x;
  const y = railY(kind.rail) - STRIP_HEIGHT / 2;
  return {
    x,
    y,
    w,
    h: STRIP_HEIGHT,
    cx: x + w / 2,
    cy: railY(kind.rail),
    rx: STRIP_HEIGHT / 2,
  };
}

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

  /** 元件锚点 = 该元件全部已用孔位置的平均坐标 */
  function componentAnchor(componentId: string): { x: number; y: number } | null {
    const holes = model.componentHoles.get(componentId);
    if (!holes || holes.size === 0) return null;
    const pts = Array.from(holes)
      .map((k) => holePos(k))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    if (pts.length === 0) return null;
    const sx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const sy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x: sx, y: sy };
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
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
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

          {/* 中央水平凹槽 (E↔F 之间) */}
          {(() => {
            const topRailsBottom = PAD_Y + ROW_STEP;
            const matrixTopStart = topRailsBottom + RAIL_GAP;
            const matrixTopEnd = matrixTopStart + (TOP_LETTERS.length - 1) * ROW_STEP;
            return (
              <rect
                x={PAD_X - 12}
                y={matrixTopEnd + ROW_STEP / 2}
                width={BOARD_WIDTH - (PAD_X - 12) * 2}
                height={CENTER_GAP - ROW_STEP}
                fill="#e8e0cd"
                stroke="#cbc3ad"
                strokeWidth={0.8}
              />
            );
          })()}

          {/* 中央垂直分隔 (col 30 ↔ col 31)：物理上左右两半电源轨在此断开 */}
          {(() => {
            const xMid = colX(HALF_BOUNDARY) + COL_STEP / 2 + CENTER_X_GAP / 2;
            return (
              <rect
                x={xMid - CENTER_X_GAP / 2}
                y={PAD_Y - 8}
                width={CENTER_X_GAP}
                height={BOARD_HEIGHT - (PAD_Y - 8) * 2}
                fill="#ece4cf"
                stroke="#cbc3ad"
                strokeWidth={0.8}
                strokeDasharray="3 2"
              />
            );
          })()}

          {/* 0.5: strip lanes (面包板天然电气连接) */}
          {ALL_STRIPS.map(({ id, kind }) => {
            const g = stripGeometry(kind);
            const usage = model.stripUsage.get(id);
            const railTint = kind.kind === "rail" ? RAIL_TINT[kind.rail] : null;
            if (usage) {
              const color = getNetColor(usage.netId, usage.role);
              const isActive = activeNet === usage.netId;
              const isDim = activeNet !== null && !isActive;
              return (
                <g
                  key={`strip-${id}`}
                  className="bb-strip used"
                  style={{ opacity: isDim ? 0.18 : 1 }}
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    const scale = rect.width / BOARD_WIDTH;
                    setHover({
                      x: g.cx * scale + 8,
                      y: g.cy * scale - 8,
                      netId: usage.netId,
                      netRole: usage.role,
                      pins: usage.pins,
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setActiveNet((cur) => (cur === usage.netId ? null : usage.netId))}
                >
                  <rect
                    x={g.x}
                    y={g.y}
                    width={g.w}
                    height={g.h}
                    rx={g.rx}
                    ry={g.rx}
                    fill={color}
                    fillOpacity={isActive ? 0.28 : 0.16}
                    stroke={color}
                    strokeOpacity={isActive ? 0.85 : 0.55}
                    strokeWidth={1.2}
                  />
                </g>
              );
            }
            // 空 strip：仅显示一条非常淡的导电带
            return (
              <rect
                key={`strip-${id}`}
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                rx={g.rx}
                ry={g.rx}
                fill={railTint ?? "#a8a092"}
                fillOpacity={railTint ? 0.07 : 0.06}
                stroke={railTint ?? "#cbc3ad"}
                strokeOpacity={0.25}
                strokeWidth={0.7}
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

          {/* 2.5: 元件之间的电气连接（虚线）。
              每条 net 涉及 >= 2 个元件时，把元件锚点 (其孔位平均) 连成一条虚线，
              凸显"电气连接发生在哪些元件之间"。 */}
          {usedNetIds.map((netId) => {
            const compIds = Array.from(model.netComponents.get(netId) ?? []);
            if (compIds.length < 2) return null;
            const role = model.netRoles.get(netId) ?? "SIGNAL";
            const color = getNetColor(netId, role);
            const isDim = activeNet !== null && activeNet !== netId;
            const isActive = activeNet === netId;
            const anchors = compIds
              .map((cid) => componentAnchor(cid))
              .filter((p): p is { x: number; y: number } => Boolean(p))
              .sort((a, b) => a.x - b.x); // 按 x 排序避免无谓交叉
            if (anchors.length < 2) return null;
            return (
              <polyline
                key={`compedge-${netId}`}
                points={anchors.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={isActive ? 2.8 : 2}
                strokeOpacity={isDim ? 0.08 : isActive ? 0.95 : 0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 4"
              />
            );
          })}

          {/* 3.0 ambiguous 候选孔位（虚线小圈，提示这根脚也可能落到这里） */}
          {Array.from(model.holes.entries()).flatMap(([selectedKey, pins]) => {
            const pos = holePos(selectedKey);
            if (!pos) return [];
            const ambig = pins.find((p) => p.isAmbiguous && p.candidateHoleIds && p.candidateHoleIds.length > 1);
            if (!ambig || !ambig.candidateHoleIds) return [];
            const role = model.netRoles.get(ambig.netId) ?? "SIGNAL";
            const color = getNetColor(ambig.netId, role);
            const isDim = activeNet !== null && activeNet !== ambig.netId;
            return ambig.candidateHoleIds.slice(0, 4).flatMap((candStr, i) => {
              const candAddr = parseHoleId(candStr);
              if (!candAddr) return [];
              const candKey = holeKey(candAddr);
              if (candKey === selectedKey) return [];
              const cp = holePos(candKey);
              if (!cp) return [];
              return [
                <line
                  key={`amb-line-${selectedKey}-${i}`}
                  x1={pos.x}
                  y1={pos.y}
                  x2={cp.x}
                  y2={cp.y}
                  stroke={color}
                  strokeOpacity={isDim ? 0.06 : 0.4}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />,
                <circle
                  key={`amb-cand-${selectedKey}-${i}`}
                  cx={cp.x}
                  cy={cp.y}
                  r={HOLE_R + 2.5}
                  fill="none"
                  stroke={color}
                  strokeOpacity={isDim ? 0.1 : 0.55}
                  strokeWidth={1.1}
                  strokeDasharray="2 2"
                />,
              ];
            });
          })}

          {/* 3. 已用孔（高亮 + 脉冲） */}
          {Array.from(model.holes.entries()).map(([k, pins]) => {
            const pos = holePos(k);
            if (!pos) return null;
            const netId = pins[0].netId;
            const role = model.netRoles.get(netId) ?? "SIGNAL";
            const color = getNetColor(netId, role);
            const isActive = activeNet === netId;
            const isDim = activeNet !== null && !isActive;
            const isAmbiguous = pins.some((p) => p.isAmbiguous);
            return (
              <g
                key={`used-${k}`}
                className={`bb-used${isAmbiguous ? " ambiguous" : ""}`}
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
                {isAmbiguous ? (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={HOLE_R + 4}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1.4}
                    strokeDasharray="3 2"
                    className="bb-ambig-ring"
                  />
                ) : null}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={HOLE_R + 1}
                  fill={color}
                  stroke={isAmbiguous ? "#f59e0b" : "#fff"}
                  strokeWidth={isAmbiguous ? 1.8 : 1.4}
                />
              </g>
            );
          })}

          {/* 4. 标签层 (顶层): 列号 / 行字母 / 电源轨标签 / 元件标签 */}
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
          {/* 行字母双侧 */}
          {[...TOP_LETTERS, ...BOT_LETTERS].flatMap((l) => [
            <text
              key={`rowletter-L-${l}`}
              x={PAD_X - 14}
              y={matrixY(l) + 3}
              textAnchor="middle"
              className="bb-text"
            >
              {l}
            </text>,
            <text
              key={`rowletter-R-${l}`}
              x={BOARD_WIDTH - PAD_X + 14}
              y={matrixY(l) + 3}
              textAnchor="middle"
              className="bb-text"
            >
              {l}
            </text>,
          ])}
          {/* 电源轨标签：左右两端各一份 (× 4 轨 = 8 个) */}
          {(["top_plus", "top_minus", "bot_plus", "bot_minus"] as RailKind[]).flatMap((rail) => [
            <text
              key={`rail-label-L-${rail}`}
              x={PAD_X - 14}
              y={railY(rail) + 3}
              textAnchor="middle"
              className="bb-text rail"
              fill={RAIL_TINT[rail]}
            >
              {RAIL_LABELS[rail]}
            </text>,
            <text
              key={`rail-label-R-${rail}`}
              x={BOARD_WIDTH - PAD_X + 14}
              y={railY(rail) + 3}
              textAnchor="middle"
              className="bb-text rail"
              fill={RAIL_TINT[rail]}
            >
              {RAIL_LABELS[rail]}
            </text>,
          ])}
          {/* 元件标签：在元件锚点上方显示 component_id (避开聚焦淡化时也能看到) */}
          {Array.from(model.componentHoles.keys()).map((cid) => {
            const a = componentAnchor(cid);
            if (!a) return null;
            const compType = model.componentTypes.get(cid) ?? "";
            return (
              <g key={`complabel-${cid}`} className="bb-component-label">
                <rect
                  x={a.x - 22}
                  y={a.y - 28}
                  width={44}
                  height={14}
                  rx={3}
                  fill="#1f2937"
                  fillOpacity={0.78}
                />
                <text
                  x={a.x}
                  y={a.y - 18}
                  textAnchor="middle"
                  className="bb-text comp"
                >
                  {cid}
                </text>
                {compType ? (
                  <title>{`${cid} · ${compType}`}</title>
                ) : null}
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
            {hover.pins.some((p) => p.isAmbiguous) ? (
              <div className="bb-tooltip-ambig">
                <div className="bb-tooltip-ambig-title">⚠ 该孔位吸附存在歧义</div>
                {hover.pins
                  .filter((p) => p.isAmbiguous)
                  .map((p, i) => (
                    <div key={i} className="bb-tooltip-ambig-row">
                      {p.candidateHoleIds && p.candidateHoleIds.length > 1 ? (
                        <span className="bb-tooltip-ambig-cands">
                          候选: {p.candidateHoleIds.slice(0, 4).join(" / ")}
                        </span>
                      ) : null}
                      {p.ambiguityReasons && p.ambiguityReasons.length > 0 ? (
                        <span className="bb-tooltip-ambig-reasons">
                          原因: {p.ambiguityReasons.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>
            ) : null}
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
