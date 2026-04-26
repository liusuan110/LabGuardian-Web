import { useEffect } from "react";
import { getHealth, getVersion } from "../../api/pipeline";
import type { DemoAction } from "./demoReducer";

export function useBackendStatus(dispatch: React.Dispatch<DemoAction>) {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        await getHealth();
        const version = await getVersion();
        if (!cancelled) {
          dispatch({
            type: "backend",
            online: true,
            message: "后端在线",
            version,
          });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "backend",
            online: false,
            message: error instanceof Error ? error.message : "后端不可用",
          });
        }
      }
    }

    void check();
    const intervalId = window.setInterval(check, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dispatch]);
}
