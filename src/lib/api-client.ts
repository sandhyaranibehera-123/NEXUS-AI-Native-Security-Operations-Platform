const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getStoredTokens() {
  try {
    const raw = localStorage.getItem("nexus.tokens");
    if (!raw) return null;
    return JSON.parse(raw) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  if (tokens) {
    localStorage.setItem("nexus.tokens", JSON.stringify(tokens));
  } else {
    localStorage.removeItem("nexus.tokens");
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return null;

  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!res.ok) {
    setStoredTokens(null);
    return null;
  }

  const data = await res.json();
  setStoredTokens({ accessToken: data.accessToken, refreshToken: tokens.refreshToken });
  return data.accessToken;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const tokens = getStoredTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && tokens?.refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error ?? "Request failed", res.status, body.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: { type: string; data: unknown }) => void,
): Promise<void> {
  const tokens = getStoredTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new ApiError("Stream failed", res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          // skip malformed SSE
        }
      }
    }
  }
}

export function getWsUrl(path: string): string {
  const wsBase = import.meta.env.VITE_WS_URL ?? API_URL.replace(/^http/, "ws");
  const tokens = getStoredTokens();
  const sep = path.includes("?") ? "&" : "?";
  return `${wsBase}${path}${tokens?.accessToken ? `${sep}token=${tokens.accessToken}` : ""}`;
}

export { API_URL };
