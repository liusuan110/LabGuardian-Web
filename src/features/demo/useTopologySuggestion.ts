import { useCallback, useEffect, useRef, useState } from "react";
import { suggestTopology } from "../../api/topology";
import type { TopologySuggestResponse } from "../../types/topology";
import type {
  CircuitAnalysisResult,
  PipelineResult,
  PortVisualizationResult,
} from "../../types/pipeline";
import { getStageData } from "../../utils/pipeline";

/**
 * The hook accepts the broader pipeline-result union (mirrors `state.pipelineResult`'s
 * actual type), since the topology stage data shape is the same across variants.
 */
type AnyPipelineResult =
  | PipelineResult
  | CircuitAnalysisResult
  | PortVisualizationResult
  | null;

/**
 * CADx Phase 1 — auto-fetch GNN-A topology suggestion when the pipeline
 * produces a netlist_v2.
 *
 * Local hook state (intentionally NOT in the reducer): the suggestion
 * is a derived, refetchable side-channel. Putting it in the reducer
 * would force every reducer action to think about cache invalidation.
 *
 * Re-fetch policy:
 *   - Trigger on every netlist_v2 *value* change (by JSON.stringify
 *     identity). A new pipeline run typically produces a new graph.
 *   - The user can manually retry via `retry()` (e.g. after backend
 *     restart with newer ckpt).
 *
 * Failure modes:
 *   - Network error → `error` populated, `suggestion` left at last good value
 *   - HTTP 200 with `enabled: false` → `suggestion.disabled_reason` set,
 *     no `error` (this is a valid response, just no AI verdict). The
 *     UI uses `enabled` to decide whether to render the hypothesis list.
 */
export function useTopologySuggestion(pipelineResult: AnyPipelineResult) {
  const [suggestion, setSuggestion] = useState<TopologySuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Track the last graph signature we fetched for, so a no-op re-render
  // (e.g. selecting a different reference) doesn't re-fetch unnecessarily.
  const lastSignatureRef = useRef<string | null>(null);

  // Cancellable in-flight request token. AbortController in `requestJson`
  // is per-call; this nonce lets us drop late responses from a previous
  // pipeline run that finishes after a newer one has started.
  const requestNonceRef = useRef(0);

  // Extract netlist_v2 from the pipeline result. The pipeline stores it
  // under stage="topology". We don't fetch when null/empty.
  const netlistV2 = pipelineResult
    ? getStageData(pipelineResult, "topology").netlist_v2
    : null;

  // Build a stable signature for cache-keying. Stringify is cheap for the
  // ~3-15 KB netlists we work with. We could hash for bigger graphs.
  const signature = netlistV2
    ? JSON.stringify({ retryNonce, netlistV2 })
    : null;

  useEffect(() => {
    // Reset to clean slate when there's no netlist (e.g. before first run, or
    // after a new upload resets pipelineResult). Bump the request nonce so an
    // in-flight fetch from the previous result can't re-populate a stale
    // suggestion after the reset.
    if (!netlistV2 || signature === null) {
      lastSignatureRef.current = null;
      requestNonceRef.current += 1;
      setSuggestion(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (signature === lastSignatureRef.current) {
      return; // already fetched this exact graph
    }
    lastSignatureRef.current = signature;

    const myNonce = ++requestNonceRef.current;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const result = await suggestTopology({
          netlist_v2: netlistV2 as Record<string, unknown>,
          top_k: 5,
        });
        // Drop the result if a newer request has been issued in the meantime.
        if (requestNonceRef.current === myNonce) {
          setSuggestion(result);
          setLoading(false);
        }
      } catch (err) {
        if (requestNonceRef.current === myNonce) {
          setError(
            err instanceof Error ? err.message : "AI 拓扑识别请求失败",
          );
          setLoading(false);
        }
      }
    })();
  }, [signature, netlistV2]);

  const retry = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  return { suggestion, loading, error, retry };
}
