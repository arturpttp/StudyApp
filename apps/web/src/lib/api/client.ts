export type RequestConfig = {
  method: string;
  url: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseErrorConfig<TError = unknown> = {
  error: TError;
  status: number;
};

export type Client = typeof client;

export async function client<TData, TError = unknown, TBody = unknown>(
  options: RequestConfig,
): Promise<{ data: TData }> {
  const url = new URL(options.url, window.location.origin);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url, {
    method: options.method,
    headers: options.data
      ? { "content-type": "application/json", ...options.headers }
      : options.headers,
    body: options.data ? JSON.stringify(options.data) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return { data: undefined as TData };
  }

  const data = await res.json();
  return { data };
}

export default client;
