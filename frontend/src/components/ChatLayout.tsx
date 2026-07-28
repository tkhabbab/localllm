"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { ChatSession, Message, ModelInfo, StreamEvent, Document as DocType } from "@/types";
import { api } from "@/lib/api";
import { groupSessions } from "@/lib/sessions";
import { formatDate, cn } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import SettingsModal from "@/components/SettingsModal";
import {
  Send,
  Paperclip,
  Plus,
  Loader2,
  AlertCircle,
  ChevronDown,
  FileText,
  X,
} from "lucide-react";

export default function ChatLayout() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamMeta, setStreamMeta] = useState<{ intent?: string; model?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadingDocs, setUploadingDocs] = useState<Map<number, DocType>>(new Map());
  const [sessionDocs, setSessionDocs] = useState<DocType[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState("robi");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") || "robi";
    setTheme(savedTheme);

    const savedMode = (localStorage.getItem("app_theme_mode") || "light") as "light" | "dark";
    setThemeMode(savedMode);
    if (savedMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("app_theme", newTheme);
  };

  const changeThemeMode = (mode: "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("app_theme_mode", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const themeBg = useCallback((type: "primary" | "hover") => {
    if (theme === "robi") return type === "primary" ? "bg-[#EC1C24]" : "hover:bg-[#C30C41]";
    if (theme === "emerald") return type === "primary" ? "bg-emerald-600" : "hover:bg-emerald-500";
    if (theme === "purple") return type === "primary" ? "bg-purple-600" : "hover:bg-purple-500";
    if (theme === "rose") return type === "primary" ? "bg-rose-600" : "hover:bg-rose-500";
    return type === "primary" ? "bg-blue-600" : "hover:bg-blue-500";
  }, [theme]);

  const themeText = useCallback(() => {
    if (theme === "robi") return "text-[#EC1C24] dark:text-[#ff4d52]";
    if (theme === "emerald") return "text-emerald-500 dark:text-emerald-400";
    if (theme === "purple") return "text-purple-500 dark:text-purple-400";
    if (theme === "rose") return "text-rose-500 dark:text-rose-400";
    return "text-blue-500 dark:text-blue-400";
  }, [theme]);

  const themeBorder = useCallback(() => {
    if (theme === "robi") return "border-[#EC1C24] dark:border-[#ff4d52]";
    if (theme === "emerald") return "border-emerald-500";
    if (theme === "purple") return "border-purple-500";
    if (theme === "rose") return "border-rose-500";
    return "border-blue-500";
  }, [theme]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.chats.list();
      setSessions(data);
    } catch {}
  }, []);

  const loadMessages = useCallback(
    async (sessionId: number) => {
      try {
        const data = await api.chats.messages(sessionId);
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      } catch {}
    },
    [scrollToBottom]
  );

  const loadModels = useCallback(async () => {
    try {
      const data = await api.models.list();
      setModels(data.models);
    } catch {}
  }, []);

  const loadSessionDocs = useCallback(async (sessionId: number) => {
    try {
      const docs = await api.documents.list(sessionId);
      setSessionDocs(docs);
    } catch {}
  }, []);

  const handleDeleteDoc = useCallback(async (docId: number) => {
    try {
      await api.documents.delete(docId);
      setSessionDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadModels();
  }, [loadSessions, loadModels]);

  const selectSession = useCallback(
    async (id: number) => {
      setActiveSession(id);
      setError(null);
      setSessionDocs([]);
      await Promise.all([loadMessages(id), loadSessionDocs(id)]);
    },
    [loadMessages, loadSessionDocs]
  );

  const createSession = useCallback(async () => {
    try {
      const session = await api.chats.create();
      await loadSessions();
      setActiveSession(session.id);
      setMessages([]);
      setSessionDocs([]);
    } catch {}
  }, [loadSessions]);

  const deleteSession = useCallback(
    async (id: number) => {
      try {
        await api.chats.delete(id);
        if (activeSession === id) {
          setActiveSession(null);
          setMessages([]);
        }
        await loadSessions();
      } catch {}
    },
    [activeSession, loadSessions]
  );

  const renameSession = useCallback(
    async (id: number, title: string) => {
      try {
        await api.chats.update(id, title);
        await loadSessions();
      } catch {}
    },
    [loadSessions]
  );

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !activeSession) return;
      for (const file of Array.from(files)) {
        try {
          const doc = await api.documents.upload(file, activeSession);
          // Add to session documents immediately (shows up in input box row instantly)
          setSessionDocs((prev) => [...prev, doc]);

          const poll = setInterval(async () => {
            try {
              const status = await api.documents.status(doc.id);
              if (status.status !== "processing") {
                clearInterval(poll);
                // Update status inside sessionDocs state
                setSessionDocs((prev) =>
                  prev.map((d) => (d.id === doc.id ? { ...d, status: status.status as "ready" | "error" | "processing", page_count: status.page_count } : d))
                );
              }
            } catch {
              clearInterval(poll);
            }
          }, 2000);
        } catch (e: any) {
          setError(e.message);
        }
      }
    },
    [activeSession]
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeSession || streaming) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setStreaming(true);
    setStreamContent("");
    setStreamMeta(null);

    const tempUserMsg: Message = {
      id: Date.now(),
      session_id: activeSession,
      role: "user",
      content: userMessage,
      model_used: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      abortRef.current = new AbortController();
      const response = await api.streamChat(
        activeSession,
        userMessage,
        selectedModel || undefined
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: { intent?: string; model?: string } = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            if (event.type === "meta") {
              meta = { intent: event.intent, model: event.model };
              setStreamMeta(meta);
            } else if (event.type === "token" && event.content) {
              fullContent += event.content;
              setStreamContent(fullContent);
              scrollToBottom();
            } else if (event.type === "error") {
              throw new Error(event.message || "Stream error");
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }

      const assistantMsg: Message = {
        id: Date.now() + 1,
        session_id: activeSession,
        role: "assistant",
        content: fullContent,
        model_used: meta.model || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamContent("");
      setStreamMeta(null);
      await loadSessions();
    } catch (e: any) {
      setError(e.message || "Failed to get response");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, activeSession, streaming, selectedModel, scrollToBottom, loadSessions]);

  const grouped = groupSessions(sessions);

  return (
    <div className="flex h-screen bg-white dark:bg-dark-900 text-gray-800 dark:text-dark-100 transition-colors duration-150">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        grouped={grouped}
        activeSession={activeSession}
        onSelect={selectSession}
        onCreate={createSession}
        onDelete={deleteSession}
        onRename={renameSession}
        user={user}
        onLogout={logout}
        onOpenSettings={() => setShowSettings(true)}
        documents={sessionDocs.filter((d) => d.status === "ready")}
        onDeleteDocument={handleDeleteDoc}
      />

      <main className="flex flex-col flex-1 min-w-0 bg-white dark:bg-dark-900">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-dark-400"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-medium text-gray-850 dark:text-dark-200">
              {activeSession
                ? sessions.find((s) => s.id === activeSession)?.title || "New Chat"
                : "Enterprise AI"}
            </h1>
          </div>

          {/* Model override dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500 text-gray-700 dark:text-dark-300"
            >
              {selectedModel
                ? models.find((m) => m.id === selectedModel)?.name || selectedModel
                : "Auto-route"}
              <ChevronDown size={14} />
            </button>
            {showModelDropdown && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-xl z-50">
                <button
                  onClick={() => {
                    setSelectedModel("");
                    setShowModelDropdown(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-700 rounded-t-lg",
                    !selectedModel && themeText()
                  )}
                >
                  Auto-route (recommended)
                </button>
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-700 last:rounded-b-lg",
                      selectedModel === m.id && themeText()
                    )}
                  >
                    {m.name}
                    <span className="ml-2 text-xs text-dark-500">({m.type})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-dark-400">
              <img src="/robi.svg" alt="Robi AI logo" className="w-16 h-16 mb-4 object-contain animate-pulse" style={{ animationDuration: '3s' }} />
              <p className="text-lg mb-2 text-gray-900 dark:text-dark-200 font-semibold">Welcome to Enterprise AI</p>
              <p className="text-sm text-gray-500 dark:text-dark-500">
                Create a new chat or select an existing one to get started
              </p>
              <button
                onClick={createSession}
                className={cn(
                  "mt-6 px-6 py-2.5 text-white rounded-lg transition-colors font-medium shadow-md shadow-black/10",
                  themeBg("primary"),
                  themeBg("hover")
                )}
              >
                New Chat
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4 px-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {streaming && streamContent && (
                <ChatMessage
                  message={{
                    id: -1,
                    session_id: activeSession,
                    role: "assistant",
                    content: streamContent,
                    model_used: streamMeta?.model || null,
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              {streaming && !streamContent && (
                <div className="flex items-center gap-2 py-4 text-dark-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 py-3 px-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm my-2">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeSession && (
          <div className="border-t border-gray-200 dark:border-dark-700 p-4">
            <div className="max-w-3xl mx-auto">
              {/* Attached active documents list */}
              {sessionDocs.filter((d) => d.status !== "ready").length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {sessionDocs.filter((d) => d.status !== "ready").map((doc) => {
                    const isProcessing = doc.status === "processing";
                    const isError = doc.status === "error";
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-dark-800 border rounded-xl text-xs max-w-[240px] shadow-sm select-none transition-all",
                          isError ? "border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10" : "border-gray-200 dark:border-dark-700"
                        )}
                      >
                        {isProcessing ? (
                          <Loader2 size={14} className="text-blue-500 dark:text-blue-400 animate-spin shrink-0" />
                        ) : (
                          <FileText size={14} className={cn("shrink-0", isError ? "text-red-500" : "text-gray-500 dark:text-dark-400")} />
                        )}
                        <span className={cn("truncate flex-1 font-medium", isError ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-dark-200")}>
                          {doc.filename} {isProcessing && <span className="text-[10px] text-gray-400">(processing...)</span>}
                        </span>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className={cn(
                            "p-0.5 rounded-full transition-colors shrink-0",
                            isError ? "hover:bg-red-200/50 dark:hover:bg-red-900/30 text-red-500" : "hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-red-500"
                          )}
                          title="Remove document"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-end gap-2 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl p-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 transition-colors"
                  title="Upload file"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Send a message..."
                  rows={1}
                  className="flex-1 bg-transparent outline-none resize-none text-gray-950 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 max-h-36"
                  style={{ height: "auto", minHeight: "24px" }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 144) + "px";
                    setInput(el.value);
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    input.trim() && !streaming
                      ? `${themeBg("primary")} ${themeBg("hover")} text-white`
                      : "text-gray-400 dark:text-dark-500 cursor-not-allowed"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-dark-500 mt-2 text-center">
                AI responses may be inaccurate. Verify important information.
              </p>
            </div>
          </div>
        )}
      </main>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        theme={theme}
        onChangeTheme={changeTheme}
        themeMode={themeMode}
        onChangeThemeMode={changeThemeMode}
      />
    </div>
  );
}
