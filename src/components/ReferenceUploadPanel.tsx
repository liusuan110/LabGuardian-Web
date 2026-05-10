import { FileJson, XCircle } from "lucide-react";
import type { ChangeEvent } from "react";

type Props = {
  referenceName: string | null;
  referenceCircuit: Record<string, unknown> | null;
  referenceError: string | null;
  onReferenceLoaded: (payload: Record<string, unknown>, name: string) => void;
  onReferenceError: (message: string) => void;
  onReferenceClear: () => void;
};

export function ReferenceUploadPanel({
  referenceName,
  referenceCircuit,
  referenceError,
  onReferenceLoaded,
  onReferenceError,
  onReferenceClear,
}: Props) {
  async function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".json")) {
      onReferenceError("请选择 logical_reference_v1 JSON 文件。");
      return;
    }

    try {
      const text = await selected.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      if (payload.format !== "logical_reference_v1") {
        onReferenceError("参考电路 JSON 的 format 必须是 logical_reference_v1。");
        return;
      }
      const name = typeof payload.name === "string" && payload.name ? payload.name : selected.name;
      onReferenceLoaded(payload, name);
    } catch (error) {
      onReferenceError(error instanceof Error ? error.message : "参考电路 JSON 解析失败。");
    }
  }

  const components = Array.isArray(referenceCircuit?.components)
    ? referenceCircuit.components.length
    : 0;
  const nets = Array.isArray(referenceCircuit?.nets) ? referenceCircuit.nets.length : 0;

  return (
    <section className="control-group reference-panel">
      <div className="section-title">
        <FileJson size={16} />
        <span>Reference JSON</span>
      </div>
      <label className="reference-upload">
        <input type="file" accept="application/json,.json" onChange={handleInput} />
        <span>{referenceName ?? "上传 logical_reference_v1"}</span>
      </label>
      {referenceCircuit ? (
        <div className="reference-summary">
          <span>{components} components</span>
          <span>{nets} nets</span>
          <button type="button" onClick={onReferenceClear} aria-label="清除参考电路">
            <XCircle size={16} />
          </button>
        </div>
      ) : null}
      {referenceError ? <p className="reference-error">{referenceError}</p> : null}
    </section>
  );
}
