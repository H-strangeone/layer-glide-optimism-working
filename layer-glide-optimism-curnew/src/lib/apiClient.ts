const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5500';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string, headers?: HeadersInit) =>
            request<T>(path, { headers }),
  post:   <T>(path: string, body: unknown, headers?: HeadersInit) =>
            request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  delete: <T>(path: string, headers?: HeadersInit) =>
            request<T>(path, { method: 'DELETE', headers }),
};