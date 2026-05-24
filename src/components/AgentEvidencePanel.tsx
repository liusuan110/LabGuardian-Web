import { BookOpen, CheckCircle2, CircleAlert, Gauge, Image as ImageIcon } from "lucide-react";
import type { AgentEvidence } from "../types/agent";

type Props = {
  evidence?: AgentEvidence[];
};

type ParsedAgentEvidence = {
  intent?: string;
  concept?: {
    conceptId: string;
    title: string;
    summary: string;
  };
  verification?: {
    passed: boolean | null;
    issues: string[];
  };
  circuitReferences: CircuitReference[];
};

type CircuitReference = {
  circuitId: string;
  name: string;
  summary: string;
  image: string;
  imageUrl: string;
  visibleComponents: string[];
  visibleNodes: string[];
  notes: string[];
  matchedFeatures: string[];
  score?: number;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function apiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function knowledgeAssetUrl(path: string) {
  if (!path) return "";
  if (/^(data:|https?:\/\/)/.test(path)) return path;
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${apiBaseUrl()}/${encodeURI(normalized)}`;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractCircuitReferences(evidence: AgentEvidence[] = []): CircuitReference[] {
  const refs: CircuitReference[] = [];
  for (const item of evidence) {
    if (item.evidence_type !== "tool_results") continue;
    const results = Array.isArray(item.payload.results) ? item.payload.results : [];
    for (const rawResult of results) {
      if (!rawResult || typeof rawResult !== "object") continue;
      const result = rawResult as { tool_name?: unknown; payload?: unknown };
      if (result.tool_name !== "circuit_lookup_tool") continue;
      const payload = result.payload && typeof result.payload === "object" ? result.payload as Record<string, unknown> : {};
      const circuits = Array.isArray(payload.circuits) ? payload.circuits : [];
      for (const rawCircuit of circuits.slice(0, 2)) {
        if (!rawCircuit || typeof rawCircuit !== "object") continue;
        const circuit = rawCircuit as Record<string, unknown>;
        const image = readString(circuit.image);
        const annotations =
          circuit.image_annotations && typeof circuit.image_annotations === "object"
            ? circuit.image_annotations as Record<string, unknown>
            : {};
        refs.push({
          circuitId: readString(circuit.circuit_id),
          name: readString(circuit.name) || readString(circuit.circuit_id) || "典型电路",
          summary: readString(circuit.summary),
          image,
          imageUrl: knowledgeAssetUrl(image),
          visibleComponents: readStringList(annotations.visible_components),
          visibleNodes: readStringList(annotations.visible_nodes),
          notes: readStringList(annotations.notes),
          matchedFeatures: readStringList(circuit.matched_features),
          score: readNumber(circuit.score),
        });
      }
    }
  }

  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = ref.circuitId || ref.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAgentEvidence(evidence: AgentEvidence[] = []): ParsedAgentEvidence {
  const intentItem = evidence.find((item) => item.evidence_type === "intent");
  const conceptItem = evidence.find((item) => item.evidence_type === "concept_pack");
  const verificationItem = evidence.find((item) => item.evidence_type === "verification_report");

  const conceptId = readString(conceptItem?.payload.concept_id);
  const title = readString(conceptItem?.payload.title);
  const summary = readString(conceptItem?.payload.summary);
  const passed = verificationItem?.payload.passed;

  return {
    intent: readString(intentItem?.payload.intent) || intentItem?.summary.replace(/^intent=/, ""),
    concept: conceptItem
      ? {
          conceptId: conceptId || conceptItem.source_id,
          title: title || conceptItem.summary || "知识点",
          summary,
        }
      : undefined,
    verification: verificationItem
      ? {
          passed: typeof passed === "boolean" ? passed : null,
          issues: readStringList(verificationItem.payload.issues),
        }
      : undefined,
    circuitReferences: extractCircuitReferences(evidence),
  };
}

function intentLabel(intent: string) {
  const labels: Record<string, string> = {
    concept_tutor: "概念讲解",
    diagnostic: "电路诊断",
    mixed: "诊断 + 概念",
    lab_guidance: "实验指导",
  };
  return labels[intent] ?? intent;
}

function verifierLabel(passed: boolean | null) {
  if (passed === true) return "通过";
  if (passed === false) return "未通过";
  return "未确认";
}

export function AgentEvidencePanel({ evidence }: Props) {
  const parsed = parseAgentEvidence(evidence);
  if (!parsed.intent && !parsed.concept && !parsed.verification && parsed.circuitReferences.length === 0) {
    return null;
  }

  return (
    <div className="agent-evidence-panel">
      {parsed.intent ? (
        <div className="agent-evidence-row">
          <Gauge size={13} />
          <span>回答模式</span>
          <strong>{intentLabel(parsed.intent)}</strong>
        </div>
      ) : null}

      {parsed.concept ? (
        <div className="agent-concept-card">
          <div className="agent-concept-head">
            <BookOpen size={13} />
            <span>{parsed.concept.title}</span>
            <code>{parsed.concept.conceptId}</code>
          </div>
          {parsed.concept.summary ? <p>{parsed.concept.summary}</p> : null}
        </div>
      ) : null}

      {parsed.circuitReferences.map((ref) => (
        <div className="agent-circuit-card" key={ref.circuitId || ref.name}>
          <div className="agent-circuit-head">
            <ImageIcon size={13} />
            <span>{ref.name}</span>
            {ref.score !== undefined ? <code>score {ref.score.toFixed(1)}</code> : null}
          </div>
          {ref.imageUrl ? (
            <img
              className="agent-circuit-image"
              src={ref.imageUrl}
              alt={`${ref.name} 参考电路图`}
              loading="lazy"
            />
          ) : null}
          {ref.summary ? <p>{ref.summary}</p> : null}
          {ref.visibleComponents.length > 0 ? (
            <div className="agent-circuit-tags" aria-label="图中可见元件">
              {ref.visibleComponents.slice(0, 12).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
          {ref.visibleNodes.length > 0 || ref.matchedFeatures.length > 0 ? (
            <small>
              {ref.visibleNodes.length > 0 ? `可见节点：${ref.visibleNodes.slice(0, 8).join("、")}` : ""}
              {ref.visibleNodes.length > 0 && ref.matchedFeatures.length > 0 ? " · " : ""}
              {ref.matchedFeatures.length > 0 ? `命中依据：${ref.matchedFeatures.slice(0, 3).join("、")}` : ""}
            </small>
          ) : null}
          {ref.notes.length > 0 ? <small>{ref.notes[0]}</small> : null}
        </div>
      ))}

      {parsed.verification ? (
        <div className="agent-evidence-row">
          {parsed.verification.passed ? (
            <CheckCircle2 size={13} />
          ) : (
            <CircleAlert size={13} />
          )}
          <span>Verifier</span>
          <strong>{verifierLabel(parsed.verification.passed)}</strong>
          {parsed.verification.issues.length > 0 ? (
            <small>{parsed.verification.issues.join("；")}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
