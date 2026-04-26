import { ANALYZE_TIMEOUT_MS, DEFAULT_ANALYZE_OPTIONS } from "./config.js";

function withTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function analyzeImage(file, options = {}) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("conf", options.conf || DEFAULT_ANALYZE_OPTIONS.conf);
  formData.append("iou", options.iou || DEFAULT_ANALYZE_OPTIONS.iou);
  formData.append("imgsz", options.imgsz || DEFAULT_ANALYZE_OPTIONS.imgsz);

  const { controller, timeoutId } = withTimeout(ANALYZE_TIMEOUT_MS);
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload.detail || "识别失败");
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("识别超时，请检查模型服务或换一张较小的图片。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
