// Client helpers — fetch API có kèm Authorization header từ localStorage.token.
// Dùng cho mọi admin page để chuẩn hoá việc gọi /api/admin/*.

export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...init, headers, credentials: "include" });
}

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number };
};

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await adminFetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}
