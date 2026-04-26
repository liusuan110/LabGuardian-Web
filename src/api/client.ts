const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function apiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function endpoint(path: string) {
  return `${apiBaseUrl()}${path}`;
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `HTTP ${response.status}`;
      throw new ApiError(detail, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("请求超时，请确认后端服务和模型推理状态。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
