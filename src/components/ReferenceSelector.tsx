import type { LogicalReference, ReferenceSummary } from "../types/pipeline";

type Props = {
  references: ReferenceSummary[];
  selectedReferenceId: string | null;
  status: "idle" | "loading" | "success" | "error";
  error: string;
  currentReference: LogicalReference | null;
  currentReferenceStatus: "idle" | "loading" | "success" | "error";
  currentReferenceError: string;
  onChange: (referenceId: string | null) => void;
};

export function ReferenceSelector({
  references,
  selectedReferenceId,
  status,
  error,
  currentReference,
  currentReferenceStatus,
  currentReferenceError,
  onChange,
}: Props) {
  const selected = references.find((item) => item.reference_id === selectedReferenceId);
  const selectedName = currentReference?.name ?? selected?.name ?? selectedReferenceId ?? "";
  const selectedDescription = currentReference?.description ?? selected?.description;
  const componentCount = currentReference?.components?.length ?? selected?.component_count ?? 0;
  const netCount = currentReference?.nets?.length ?? selected?.net_count ?? 0;

  return (
    <section className="reference-panel">
      <div className="section-title">逻辑参考电路</div>
      <p className="muted">
        参考电路只用于逻辑拓扑比较，不要求面包板孔位、元件编号或跳线走向一致。
      </p>

      <select
        value={selectedReferenceId ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={status === "loading"}
      >
        <option value="">不使用逻辑参考电路</option>
        {references.map((ref) => (
          <option key={ref.reference_id} value={ref.reference_id}>
            {ref.name || ref.reference_id}
          </option>
        ))}
      </select>

      {status === "loading" ? <p className="muted">正在加载逻辑参考电路列表...</p> : null}
      {status === "error" ? (
        <p className="error-text">
          逻辑参考电路列表加载失败：{error}
          <br />
          <span className="muted">请确认后端已实现 GET /api/v1/references</span>
        </p>
      ) : null}
      {status === "success" && references.length === 0 ? (
        <p className="muted">后端未返回任何逻辑参考电路。</p>
      ) : null}

      {selected ? (
        <div className="reference-card">
          <strong>{selectedName}</strong>
          <span>
            {componentCount} 个元件 · {netCount} 个网络
          </span>
          {selectedDescription ? <p>{selectedDescription}</p> : null}
          <code>{selected.reference_id}</code>
          {currentReferenceStatus === "loading" ? <p className="muted">正在读取完整 reference JSON...</p> : null}
          {currentReferenceStatus === "error" ? (
            <p className="error-text">完整 reference JSON 加载失败：{currentReferenceError}</p>
          ) : null}
        </div>
      ) : status !== "error" ? (
        <p className="muted">
          未选择逻辑参考电路时只做当前识别结果诊断，不做参考拓扑比较。
        </p>
      ) : null}
    </section>
  );
}
