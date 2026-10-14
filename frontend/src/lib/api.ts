const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

/**
 * Requests still in flight, across the whole app. lib/settle.ts watches it to tell when a
 * page has everything it asked for — the moment its prerendered HTML can be swapped for
 * the live page, and the moment the prerender step snapshots it.
 */
let pending = 0;
export function pendingRequests(): number {
  return pending;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  pending += 1;
  try {
    return await request<T>(path, options);
  } finally {
    pending -= 1;
  }
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? response.statusText);
  }
  return data as T;
}
