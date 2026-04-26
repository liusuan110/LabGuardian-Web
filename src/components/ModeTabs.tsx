import type { CanvasMode } from "../types/ui";

type Props = {
  mode: CanvasMode;
  onChange: (mode: CanvasMode) => void;
};

const tabs: Array<{ key: CanvasMode; label: string }> = [
  { key: "detect", label: "检测结果" },
  { key: "pins", label: "引脚定位" },
  { key: "mapping", label: "孔位映射" },
  { key: "netlist", label: "网表" },
];

export function ModeTabs({ mode, onChange }: Props) {
  return (
    <nav className="mode-tabs" aria-label="结果视图">
      {tabs.map((tab) => (
        <button
          className={mode === tab.key ? "active" : ""}
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
