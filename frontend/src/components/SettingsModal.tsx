"use client";

import React, { useState } from "react";
import { X, User, Palette, BookOpen, ShieldAlert, Cpu, Keyboard, Sun, Moon } from "lucide-react";
import type { User as UserType } from "@/types";
import { formatDate } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  theme: string; // Accent theme
  onChangeTheme: (theme: string) => void;
  themeMode: "light" | "dark";
  onChangeThemeMode: (mode: "light" | "dark") => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  theme,
  onChangeTheme,
  themeMode,
  onChangeThemeMode,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "theme" | "docs">("profile");

  if (!isOpen) return null;

  const themes = [
    { id: "robi", name: "Robi Red", colorClass: "bg-[#E21E26] border-red-500" },
    { id: "blue", name: "Default Blue", colorClass: "bg-blue-600 border-blue-400" },
    { id: "emerald", name: "Emerald Green", colorClass: "bg-emerald-600 border-emerald-400" },
    { id: "purple", name: "Royal Purple", colorClass: "bg-purple-600 border-purple-400" },
    { id: "rose", name: "Rose Red", colorClass: "bg-rose-600 border-rose-400" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl w-full max-w-2xl h-[500px] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50 dark:bg-dark-900 p-3 border-r border-gray-200 dark:border-dark-700 flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === "profile"
                  ? "bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-dark-100 font-medium"
                  : "text-gray-600 dark:text-dark-400 hover:bg-gray-100/70 dark:hover:bg-dark-800 hover:text-gray-950 dark:hover:text-dark-200"
              }`}
            >
              <User size={16} />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("theme")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === "theme"
                  ? "bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-dark-100 font-medium"
                  : "text-gray-600 dark:text-dark-400 hover:bg-gray-100/70 dark:hover:bg-dark-800 hover:text-gray-950 dark:hover:text-dark-200"
              }`}
            >
              <Palette size={16} />
              Theme Color
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === "docs"
                  ? "bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-dark-100 font-medium"
                  : "text-gray-600 dark:text-dark-400 hover:bg-gray-100/70 dark:hover:bg-dark-800 hover:text-gray-950 dark:hover:text-dark-200"
              }`}
            >
              <BookOpen size={16} />
              Documentation
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-dark-800">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-4">
                    User Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Username</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-dark-200">{user?.username}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-gray-200 dark:border-dark-700/60">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Role</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 font-medium">
                        Standard User
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-gray-200 dark:border-dark-700/60">
                      <span className="text-sm text-gray-600 dark:text-dark-400">Created At</span>
                      <span className="text-sm text-gray-800 dark:text-dark-300">
                        {user?.created_at ? formatDate(user.created_at) : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-300">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium mb-1">Security Notice</h4>
                    <p className="text-xs text-amber-600 dark:text-amber-400/90 leading-relaxed">
                      This is a secure and private AI workspace. Your chats and document uploads are encrypted and stored privately on the local enterprise infrastructure.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "theme" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3">
                    Theme Mode
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onChangeThemeMode("light")}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-center transition-all ${
                        themeMode === "light"
                          ? "bg-blue-50/50 dark:bg-dark-700 border-blue-500 text-blue-600 dark:text-blue-400 font-medium"
                          : "bg-gray-50 dark:bg-dark-900 hover:bg-gray-100 dark:hover:bg-dark-700 border-gray-200 dark:border-dark-700 text-gray-700 dark:text-dark-300"
                      }`}
                    >
                      <Sun size={16} />
                      Light Theme
                    </button>
                    <button
                      onClick={() => onChangeThemeMode("dark")}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-center transition-all ${
                        themeMode === "dark"
                          ? "bg-blue-55/50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 font-medium"
                          : "bg-gray-50 dark:bg-dark-900 hover:bg-gray-100 dark:hover:bg-dark-700 border-gray-200 dark:border-dark-700 text-gray-700 dark:text-dark-300"
                      }`}
                    >
                      <Moon size={16} />
                      Dark Theme
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">
                    Accent Color Theme
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400 leading-relaxed mb-4">
                    Select your preferred color scheme for buttons, loaders, and highlight colors globally.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {themes.map((t) => {
                      const isSelected = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => onChangeTheme(t.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "bg-gray-50 dark:bg-dark-700 border-gray-400 dark:border-dark-500 ring-2 ring-blue-500/10"
                              : "bg-gray-50 dark:bg-dark-900 hover:bg-gray-100 dark:hover:bg-dark-700 border-gray-200 dark:border-dark-700"
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full ${t.colorClass} border shrink-0`} />
                          <span className={`text-sm ${isSelected ? "text-gray-900 dark:text-dark-100 font-semibold" : "text-gray-600 dark:text-dark-300"}`}>
                            {t.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "docs" && (
              <div className="space-y-6 text-gray-700 dark:text-dark-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3">
                     Enterprise AI Documentation
                  </h3>
                  <p className="text-xs text-gray-550 dark:text-dark-400 mb-4">
                    Learn how Enterprise AI assists you, and view interface shortcuts.
                  </p>
                </div>

                {/* Section 1: AI Router */}
                <div className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-dark-200 font-semibold mb-2">
                    <Cpu size={16} className="text-blue-500 dark:text-blue-400" />
                    <span>Intelligent AI Routing</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-dark-300 leading-relaxed mb-3">
                    Enterprise AI automatically analyzes your request and routes it to the most suitable AI profile:
                  </p>
                  <ul className="text-xs space-y-1.5 list-disc pl-4 text-gray-600 dark:text-dark-400">
                    <li><strong className="text-gray-800 dark:text-dark-200">General Assistant:</strong> Handles casual communication, basic translations, summaries, and direct queries.</li>
                    <li><strong className="text-gray-800 dark:text-dark-200">Technical & Coding Specialist:</strong> Optimizes logic, debugs scripts, and formats clean code blocks.</li>
                    <li><strong className="text-gray-800 dark:text-dark-200">Analytical Reasoning Expert:</strong> Deep-dives, compares system concepts, and answers complex logical tasks.</li>
                  </ul>
                </div>

                {/* Section 2: RAG Pipeline */}
                <div className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-dark-200 font-semibold mb-2">
                    <BookOpen size={16} className="text-emerald-605 dark:text-emerald-400" />
                    <span>Document Research & Image Reading</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-dark-300 leading-relaxed">
                    Upload documents, search reports, or images using the paperclip icon. The platform automatically reads and extracts text layers from them, securely indexing the information. Once uploaded, you can ask questions directly about their contents in the chat window to get immediate summaries and citations.
                  </p>
                </div>

                {/* Section 3: Hotkeys */}
                <div className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-dark-200 font-semibold mb-2">
                    <Keyboard size={16} className="text-purple-500 dark:text-purple-400" />
                    <span>Interface Shortcuts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between border-b border-gray-200 dark:border-dark-700/60 pb-1.5">
                      <span className="text-gray-500 dark:text-dark-400">Send Message</span>
                      <kbd className="bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded font-mono border border-gray-300 dark:border-dark-600">Enter</kbd>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-dark-700/60 pb-1.5">
                      <span className="text-gray-500 dark:text-dark-400">Add New Line</span>
                      <kbd className="bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded font-mono border border-gray-300 dark:border-dark-600">Shift + Enter</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
