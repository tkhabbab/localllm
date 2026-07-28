export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  model_used: string | null;
  created_at: string;
}

export interface Document {
  id: number;
  filename: string;
  status: "processing" | "ready" | "error";
  page_count: number | null;
  created_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: string;
}

export interface StreamEvent {
  type: "meta" | "token" | "done" | "error";
  content?: string;
  intent?: string;
  model?: string;
  message?: string;
}
