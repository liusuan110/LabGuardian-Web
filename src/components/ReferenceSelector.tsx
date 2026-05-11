import type { ReferenceSummary } from "../types/pipeline";

type Props = {
  references: ReferenceSummary[];
  selectedReferenceId: string | null;
  status: "idle" | "loading" | "success" | "error";
  error: string;
  onChange: (referenceId: string | null) => void;
};

export function ReferenceSelector({
  references,
  selectedReferenceId,
  status,
  error,
  onChange,
}: Props) {
  const selected = references.find((item) => item.reference_id === selectedReferenceId);

  return (
    <section className="reference-panel">
      <div className="section-title">参考电路</div>

      <select
        value={selectedReferenceId ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={status === "loading"}
      >
        <option value="">不使用参考电路</option>
        {references.map((ref) => (
          <option key={ref.reference_id} value={ref.reference_id}>
            {ref.name || ref.reference_id}
          </option>
        ))}
      </select>

      {status === "loading" ? <p className="muted">正在加载参考电路...</p> : null}
      {status === "error" ? (
        <p className="error-text">
          参考电路列表加载失败：{error}
          <br />
          <span className="muted">请确认后端已实现 GET /api/v1/references</span>
        </p>
      ) : null}
      {status === "success" && references.length === 0 ? (
        <p className="muted">后端未返回任何参考电路。</p>
      ) : null}

      {selected ? (
        <div className="reference-card">
          <strong>{selected.name || selected.reference_id}</strong>
          <span>
            {selected.component_count} 个元件 · {selected.net_count} 个网络
          </span>
          {selected.description ? <p>{selected.description}</p> : null}
          <code>{selected.reference_id}</code>
        </div>
      ) : status !== "error" ? (
        <p className="muted">
          未选择参考电路时只做独立诊断，不判断是否与标准电路一致。
        </p>
      ) : null}
    </section>
  );
}
