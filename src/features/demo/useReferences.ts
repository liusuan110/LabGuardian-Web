import { useEffect } from "react";
import { listReferences } from "../../api/references";
import type { DemoAction } from "./demoReducer";

export function useReferences(dispatch: React.Dispatch<DemoAction>) {
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
}
