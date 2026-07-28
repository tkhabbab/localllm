"use client";

import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { GroupedSessions } from "@/lib/sessions";
import type { ChatSession, User } from "@/types";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit3,
  Check,
  X,
  LogOut,
  PanelLeftClose,
  Settings,
  User as UserIcon,
  FileText,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  grouped: GroupedSessions;
  activeSession: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  user: User | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  documents?: ChatSession[]; // Wait, let's use dynamic type or any since we can represent Documents.
  onDeleteDocument?: (id: number) => void;
}

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title || "New Chat");

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        active ? "bg-gray-250 dark:bg-dark-700 text-gray-950 dark:text-dark-100" : "hover:bg-gray-150 dark:hover:bg-dark-800 text-gray-800 dark:text-dark-300"
      )}
      onClick={() => !editing && onSelect()}
    >
      <MessageSquare size={16} className="shrink-0 text-gray-500 dark:text-dark-400" />
      {editing ? (
        <form
          className="flex-1 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(title);
            setEditing(false);
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-gray-200 dark:bg-dark-700 px-2 py-0.5 rounded text-sm outline-none text-gray-950 dark:text-white"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button type="submit" className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300">
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(false);
              setTitle(session.title || "New Chat");
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-dark-400 dark:hover:text-dark-300"
          >
            <X size={14} />
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm truncate font-medium">
            {session.title || "New Chat"}
          </span>
          <div className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-500 dark:text-dark-400"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-600 text-red-500 dark:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SessionGroup({
  label,
  sessions,
  activeSession,
  onSelect,
  onDelete,
  onRename,
}: {
  label: string;
  sessions: ChatSession[];
  activeSession: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-dark-500 uppercase tracking-wider">
        {label}
      </div>
      {sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          active={activeSession === s.id}
          onSelect={() => onSelect(s.id)}
          onDelete={() => onDelete(s.id)}
          onRename={(title) => onRename(s.id, title)}
        />
      ))}
    </div>
  );
}

export default function Sidebar({
  open,
  onToggle,
  grouped,
  activeSession,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  user,
  onLogout,
  onOpenSettings,
}: SidebarProps) {
  if (!open) return null;

  return (
    <aside className="w-64 bg-gray-50 dark:bg-dark-950 border-r border-gray-200 dark:border-dark-700 flex flex-col shrink-0">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-dark-700">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-100 dark:bg-dark-800 dark:hover:bg-dark-700 border border-gray-200 dark:border-transparent rounded-lg text-sm text-gray-700 dark:text-dark-200 transition-colors flex-1 mr-2 font-medium"
        >
          <Plus size={16} />
          New Chat
        </button>
        <button
          onClick={onToggle}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-800 text-gray-500 dark:text-dark-400"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <SessionGroup
          label="Today"
          sessions={grouped.today}
          activeSession={activeSession}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
        <SessionGroup
          label="Previous 7 Days"
          sessions={grouped.week}
          activeSession={activeSession}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
        <SessionGroup
          label="Older"
          sessions={grouped.older}
          activeSession={activeSession}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
      </div>

      {/* Files List */}
      {activeSession && documents && documents.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-dark-700">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-2">
            Knowledge Base ({documents.length})
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between gap-2 px-2 py-1 bg-white dark:bg-dark-900 border border-gray-150 dark:border-dark-800 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText size={12} className="text-gray-500 shrink-0" />
                  <span className="truncate text-gray-700 dark:text-dark-300" title={doc.filename}>
                    {doc.filename}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteDocument?.(doc.id)}
                  className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors shrink-0"
                  title="Remove file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-t border-gray-200 dark:border-dark-700">
        <div className="flex items-center justify-between">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-dark-300 dark:hover:text-dark-100 truncate justify-start text-left max-w-[70%] font-medium transition-colors"
            title="Open Settings"
          >
            <UserIcon size={16} className="shrink-0 text-gray-500 dark:text-dark-400" />
            <span className="truncate">{user?.username}</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-800 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-800 text-gray-500 dark:text-dark-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
