/**
 * Thin fetch wrapper around the Industrial FireWatch FastAPI backend.
 *
 * In development, requests go to the relative `/api` path and Vite proxies them
 * to the FastAPI server (see `vite.config.ts`), which avoids CORS entirely.
 * In other environments set `VITE_API_BASE_URL` to the backend origin.
 */

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

/** True when the backend could not be reached at all (server down, DNS, timeout). */
export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Abort as soon as either the caller cancels or the timeout fires.
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        if (payload?.detail) detail = String(payload.detail);
      } catch {
        // Non-JSON error body — keep the status line as the message.
      }
      throw new ApiError(detail, response.status, path);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // The caller cancelled deliberately (unmount, superseded request) — propagate as-is
    // so callers can ignore it rather than rendering it as a connection failure.
    if (signal?.aborted) throw error;

    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `Request to ${path} timed out after ${timeoutMs}ms`
        : `Cannot reach FireWatch API at ${API_BASE_URL || window.location.origin}${path}`;
    throw new ApiError(message, 0, path);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
