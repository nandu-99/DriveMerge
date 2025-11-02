const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";

type FetchOptions = RequestInit & { json?: unknown };

function getToken() {
  return typeof window !== "undefined"
    ? localStorage.getItem("dm_token")
    : null;
}

export async function apiFetch(path: string, opts: FetchOptions = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else {
    body = opts.body as BodyInit | undefined;
  }

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    let serverMessage: string | undefined;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (typeof d["message"] === "string")
        serverMessage = d["message"] as string;
    }

    const err = new Error(
      serverMessage || res.statusText || "API error"
    ) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiPost(path: string, json: unknown) {
  return apiFetch(path, { method: "POST", json });
}

export async function apiGet(path: string) {
  return apiFetch(path, { method: "GET" });
}

export default { apiFetch, apiPost, apiGet };
