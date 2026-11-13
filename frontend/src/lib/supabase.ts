const env = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
export const SUPABASE_SESSION_KEY = "findit_supabase_session";

export type BackendSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

export type ReportInsert = {
  item_type: "lost" | "found";
  title: string;
  category: string;
  campus: string;
  country: string;
  location: string;
  description: string;
  image_path: string;
  owner_id: string;
};

export type BackendItem = ReportInsert & {
  id: string;
  status: string;
  created_at: string;
};

function readStoredSession(): BackendSession | null {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackendSession;
    return parsed.access_token && parsed.refresh_token && parsed.user?.id ? parsed : null;
  } catch {
    localStorage.removeItem(SUPABASE_SESSION_KEY);
    return null;
  }
}

function storeSession(payload: Record<string, unknown>): BackendSession {
  const user = payload.user as BackendSession["user"] | undefined;
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !user?.id) {
    throw new Error("The authentication service returned an incomplete session.");
  }
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  const expiresAt = typeof payload.expires_at === "number"
    ? payload.expires_at
    : Math.floor(Date.now() / 1000) + expiresIn;
  const session: BackendSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user: { id: user.id, email: user.email }
  };
  localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(session));
  return session;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error("Cloud features are not configured yet. Add the Supabase project URL and publishable anon key.");
  }
  const headers = new Headers(options.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  else headers.delete("Authorization");
  if (options.body && !(options.body instanceof Blob) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { msg?: string; message?: string; error_description?: string; error?: string };
      message = parsed.message ?? parsed.msg ?? parsed.error_description ?? parsed.error ?? raw;
    } catch {
      // Keep the plain-text server response for useful diagnostics.
    }
    throw new Error(message || `Supabase request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function getBackendSession(): Promise<BackendSession | null> {
  if (!isSupabaseConfigured) return null;

  // Supabase email confirmation redirects back with tokens in the URL hash.
  const callbackParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const callbackAccess = callbackParams.get("access_token");
  const callbackRefresh = callbackParams.get("refresh_token");
  if (callbackAccess && callbackRefresh) {
    try {
      const user = await request<BackendSession["user"]>("/auth/v1/user", {}, callbackAccess);
      const expiresIn = Number(callbackParams.get("expires_in") ?? "3600");
      const confirmed = storeSession({
        access_token: callbackAccess,
        refresh_token: callbackRefresh,
        expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
        user
      });
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return confirmed;
    } catch {
      localStorage.removeItem(SUPABASE_SESSION_KEY);
      throw new Error("Email confirmation could not be completed. Please sign in again.");
    }
  }

  const current = readStoredSession();
  if (!current) return null;
  if (current.expires_at > Math.floor(Date.now() / 1000) + 90) return current;

  try {
    const refreshed = await request<Record<string, unknown>>(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refresh_token })
      }
    );
    return storeSession(refreshed);
  } catch {
    localStorage.removeItem(SUPABASE_SESSION_KEY);
    return null;
  }
}

export async function signUpWithPassword(email: string, password: string): Promise<BackendSession | null> {
  const redirectTo = window.location.origin + window.location.pathname;
  const result = await request<Record<string, unknown>>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, options: { emailRedirectTo: redirectTo } })
  });
  if (typeof result.access_token === "string") return storeSession(result);
  return null;
}

export async function signInWithPassword(email: string, password: string): Promise<BackendSession> {
  const result = await request<Record<string, unknown>>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return storeSession(result);
}

export async function signOutFromBackend(): Promise<void> {
  const session = readStoredSession();
  try {
    if (session) {
      await request<void>("/auth/v1/logout", { method: "POST" }, session.access_token);
    }
  } finally {
    localStorage.removeItem(SUPABASE_SESSION_KEY);
  }
}

export async function listBackendItems(): Promise<BackendItem[]> {
  const query = "?select=id,item_type,title,category,campus,country,location,description,image_path,status,owner_id,created_at&status=eq.active&order=created_at.desc&limit=250";
  return request<BackendItem[]>(`/rest/v1/items${query}`);
}

export function publicItemPhotoUrl(path: string): string {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${safePath}`;
}

export async function uploadItemPhoto(
  blob: Blob,
  userId: string,
  filename: string,
  accessToken: string
): Promise<string> {
  const extension = blob.type === "image/png" ? "png" : "jpg";
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || `item.${extension}`;
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  await request<void>(
    `/storage/v1/object/item-photos/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        "x-upsert": "false"
      },
      body: blob
    },
    accessToken
  );
  return path;
}

export async function deleteItemPhoto(path: string, accessToken: string): Promise<void> {
  await request<void>(
    "/storage/v1/object/item-photos",
    {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [path] })
    },
    accessToken
  );
}

export async function createBackendItem(
  item: ReportInsert,
  accessToken: string
): Promise<BackendItem> {
  const rows = await request<BackendItem[]>(
    "/rest/v1/items",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(item)
    },
    accessToken
  );
  if (!rows[0]) throw new Error("The report was uploaded but the database did not return the saved item.");
  return rows[0];
}

export async function resolveBackendItem(
  itemId: string,
  userId: string,
  accessToken: string
): Promise<void> {
  await request<void>(
    `/rest/v1/items?id=eq.${encodeURIComponent(itemId)}&owner_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "resolved" })
    },
    accessToken
  );
}
