// API client. All requests use relative /be/* handled by Next.js app/be/[...path]/route.ts.
export const API = "/be";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fsa_token");
}

export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem("fsa_token", t);
  else localStorage.removeItem("fsa_token");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ApiError("Request timed out. The server took too long to respond.", 408);
    }
    throw new ApiError("Network error: unable to reach the FinSentinel API.", 0);
  } finally {
    clearTimeout(timer);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((d: any) => d.msg).join(", ");
      else if (j.detail) msg = JSON.stringify(j.detail);
    } catch {}
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fsa:unauthorized"));
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(`${API}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${API}${path}`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    },
    90000
  );
  return handle<T>(res);
}

export function apiUploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}${path}`);
    xhr.timeout = 90000;
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      let json: any = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        if (xhr.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fsa:unauthorized"));
        }
        const msg =
          typeof json?.detail === "string"
            ? json.detail
            : Array.isArray(json?.detail)
            ? json.detail.map((d: any) => d.msg).join(", ")
            : `Upload failed (${xhr.status})`;
        reject(new ApiError(msg, xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError("Network error during upload.", 0));
    xhr.ontimeout = () => reject(new ApiError("Upload timed out.", 408));
    xhr.send(form);
  });
}

export async function apiDownload(path: string, filename: string, method: "GET" | "POST" = "GET", body?: any) {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${API}${path}`,
    {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    45000
  );
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const SENTIMENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: "bg-bull/10 border border-bull/30", text: "text-bull", label: "Bullish (positive)" },
  negative: { bg: "bg-bear/10 border border-bear/30", text: "text-bear", label: "Bearish (negative)" },
  neutral: { bg: "bg-slate-400/10 border border-slate-400/25", text: "text-slate-300", label: "Neutral" },
  mixed: { bg: "bg-violet/10 border border-violet/30", text: "text-violet-light", label: "Mixed" },
};

export function sentimentColor(s?: string | null) {
  switch (s) {
    case "positive":
      return "#10b981";
    case "negative":
      return "#ef4444";
    case "neutral":
      return "#94a3b8";
    default:
      return "#22d3ee";
  }
}

export function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

export function fmtFullDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}
