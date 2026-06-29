// Cliente HTTP central de la API CORPETUR.
// - Adjunta el token JWT (Authorization: Bearer ...) en cada llamada.
// - Lanza ApiError con el mensaje del backend.
// - En 401 limpia la sesión y redirige al login.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080/api";
const TOKEN_KEY = "corpetur_token";
const USER_KEY = "corpetur_user";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, usuario: unknown) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

export function getStoredUser<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // por defecto true
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      sessionStorage.setItem("corpetur_sesion_expirada", "1");
      window.location.href = "/login";
    }
    throw new ApiError("Sesión expirada o no autorizada.", 401);
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error ?? data.title ?? msg;
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) msg = txt;
    }
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

// Maneja 401 igual que api(): limpia sesión y manda al login.
function manejar401() {
  clearSession();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    sessionStorage.setItem("corpetur_sesion_expirada", "1");
    window.location.href = "/login";
  }
  throw new ApiError("Sesión expirada o no autorizada.", 401);
}

async function lanzarError(res: Response): Promise<never> {
  let msg = `Error ${res.status}`;
  try { const data = await res.json(); msg = data.error ?? data.title ?? msg; }
  catch { const txt = await res.text().catch(() => ""); if (txt) msg = txt; }
  throw new ApiError(msg, res.status);
}

// Sube un archivo (multipart). No fija Content-Type: el navegador pone el boundary.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: formData });
  if (res.status === 401) manejar401();
  if (!res.ok) await lanzarError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? ((await res.json()) as T) : (undefined as T);
}

// Descarga un binario protegido (con token) y devuelve un object URL para
// usarlo en <img>, vista previa o descarga. Recuerda revocar el URL al terminar.
export async function apiBlobUrl(path: string): Promise<string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (res.status === 401) manejar401();
  if (!res.ok) await lanzarError(res);
  return URL.createObjectURL(await res.blob());
}
