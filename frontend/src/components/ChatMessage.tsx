"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useState, useCallback } from "react";
import { Copy, Check, User, Bot } from "lucide-react";
import type { Message } from "@/types";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-300 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy code"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-4 py-4 ${isUser ? "" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-blue-600" : "bg-emerald-600"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-800 dark:text-dark-200">
            {isUser ? "You" : "AI"}
          </span>
          {message.model_used && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 border border-gray-200 dark:border-transparent font-medium">
              {message.model_used}
            </span>
          )}
        </div>

        <div className="prose dark:prose-invert prose-sm max-w-none text-gray-855 dark:text-dark-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");

                if (match) {
                  return (
                    <div className="relative group my-3">
                      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 dark:bg-dark-700 rounded-t-lg border-b border-gray-200 dark:border-dark-600">
                        <span className="text-xs text-gray-500 dark:text-dark-400 font-medium">{match[1]}</span>
                      </div>
                      <CopyButton text={codeString} />
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderTopLeftRadius: 0,
                          borderTopRightRadius: 0,
                          background: "#1e1e2e",
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                return (
                  <code
                    className="bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded text-sm text-pink-600 dark:text-pink-300 font-semibold"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-gray-250 dark:border-dark-600">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return (
                  <th className="border border-gray-250 dark:border-dark-600 px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-left text-sm font-semibold">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="border border-gray-250 dark:border-dark-600 px-3 py-1.5 text-sm">
                    {children}
                  </td>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-dark-300 animate-pulse ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}
