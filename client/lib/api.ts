const TOKEN_KEY = 'podium_access_token';
const USER_KEY = 'podium_user';

export type ApiUser = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type ApiDeck = {
  id: string;
  file_name: string;
  slide_count: number;
  plain_text: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
};

export type ApiSession = {
  id: string;
  deck_id: string;
  persona: string;
  status: string;
  room_name: string | null;
  feedback: Record<string, unknown> | null;
  overall_score: number | null;
  started_at: string;
  completed_at: string | null;
  deck_file_name: string | null;
};

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  return base.replace(/\/$/, '');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): ApiUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: ApiUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const nextHeaders = new Headers(headers);
  if (auth) {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  if (rest.body && !(rest.body instanceof FormData) && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers: nextHeaders,
  });

  if (!response.ok) {
    let detail = 'Request failed';
    try {
      const payload = await response.json();
      detail = payload.detail ?? payload.error ?? detail;
      if (Array.isArray(detail)) {
        detail = detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(', ');
      }
    } catch {
      // ignore
    }
    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function register(args: {
  email: string;
  password: string;
  display_name?: string;
}) {
  const data = await apiFetch<{
    access_token: string;
    user: ApiUser;
  }>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(args),
  });
  setSession(data.access_token, data.user);
  return data;
}

export async function login(args: { email: string; password: string }) {
  const data = await apiFetch<{
    access_token: string;
    user: ApiUser;
  }>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(args),
  });
  setSession(data.access_token, data.user);
  return data;
}

export async function fetchMe() {
  return apiFetch<ApiUser>('/auth/me');
}

export async function listDecks() {
  return apiFetch<ApiDeck[]>('/decks');
}

export async function uploadDeck(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<ApiDeck>('/decks', { method: 'POST', body: form });
}

export async function deleteDeck(id: string) {
  return apiFetch<{ ok: boolean }>(`/decks/${id}`, { method: 'DELETE' });
}

export async function createSession(args: { deck_id: string; persona: string }) {
  return apiFetch<ApiSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export async function listSessions() {
  return apiFetch<ApiSession[]>('/sessions');
}

export async function getSession(id: string) {
  return apiFetch<ApiSession>(`/sessions/${id}`);
}

export async function patchSession(
  id: string,
  body: { feedback?: unknown; status?: string; room_name?: string }
) {
  return apiFetch<ApiSession>(`/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getLiveKitToken(sessionId: string) {
  return apiFetch<{
    server_url: string;
    room_name: string;
    participant_name: string;
    participant_token: string;
    session_id: string;
  }>('/livekit/token', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function evaluateFallback(body: unknown) {
  return apiFetch<Record<string, unknown>>('/evaluate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
