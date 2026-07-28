const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    register: (username: string, password: string) =>
      request<{ id: number; username: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request("/auth/logout", { method: "POST" }),
    me: () => request<{ id: number; username: string; created_at: string }>("/auth/me"),
  },

  chats: {
    list: () => request<import("@/types").ChatSession[]>("/chats"),
    create: (title?: string) =>
      request<import("@/types").ChatSession>("/chats", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    get: (id: number) => request<import("@/types").ChatSession>(`/chats/${id}`),
    update: (id: number, title: string) =>
      request<import("@/types").ChatSession>(`/chats/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    delete: (id: number) =>
      request<void>(`/chats/${id}`, { method: "DELETE" }),
    messages: (id: number) =>
      request<import("@/types").Message[]>(`/chats/${id}/messages`),
  },

  documents: {
    list: (sessionId?: number) =>
      request<import("@/types").Document[]>(`/documents${sessionId ? `?session_id=${sessionId}` : ""}`),
    upload: async (file: File, sessionId?: number) => {
      const form = new FormData();
      form.append("file", file);
      if (sessionId) form.append("session_id", String(sessionId));
      const res = await fetch(`${API_BASE}/documents/upload${sessionId ? `?session_id=${sessionId}` : ""}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<import("@/types").Document>;
    },
    status: (id: number) =>
      request<{ id: number; status: string; page_count: number | null }>(`/documents/${id}/status`),
    delete: (id: number) =>
      request<void>(`/documents/${id}`, { method: "DELETE" }),
  },

  models: {
    list: () => request<{ models: import("@/types").ModelInfo[] }>("/models"),
  },

  streamChat: (sessionId: number, content: string, modelOverride?: string) => {
    const body = JSON.stringify({
      content,
      ...(modelOverride ? { model_override: modelOverride } : {}),
    });
    return fetch(`${API_BASE}/chats/${sessionId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
  },
};
