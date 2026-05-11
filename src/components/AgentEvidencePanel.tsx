import { BookOpen, CheckCircle2, CircleAlert, Gauge } from "lucide-react";
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
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
  if (!parsed.intent && !parsed.concept && !parsed.verification) {
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
