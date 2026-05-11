import { useEffect } from "react";
import { getReference, listReferences } from "../../api/references";
import type { DemoAction } from "./demoReducer";

export function useReferences(dispatch: React.Dispatch<DemoAction>, selectedReferenceId: string | null) {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: "references-loading" });
      try {
        const refs = await listReferences();
        if (!cancelled) {
          dispatch({ type: "references-success", references: refs });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "references-error",
            error: error instanceof Error ? error.message : "参考电路列表加载失败",
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentReference(referenceId: string) {
      dispatch({ type: "current-reference-loading" });
      try {
        const reference = await getReference(referenceId);
        if (!cancelled) {
          dispatch({ type: "current-reference-success", reference });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "current-reference-error",
            error: error instanceof Error ? error.message : "完整逻辑参考电路加载失败",
          });
        }
      }
    }

    if (!selectedReferenceId) {
      dispatch({ type: "clear-current-reference" });
    } else {
      loadCurrentReference(selectedReferenceId);
    }

    return () => {
      cancelled = true;
    };
  }, [dispatch, selectedReferenceId]);
}
