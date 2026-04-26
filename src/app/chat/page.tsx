"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Citation {
  entityType: string;
  entityId: string;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

const EXAMPLE_CHIPS = [
  "Who's at risk of leaving?",
  "Who had the most impact this quarter?",
  "Which designers should I pair for mentorship?",
  "What themes are coming up in team concerns?",
  "Whose happiness is trending down?",
  "Who hasn't had partner feedback recently?",
  "Give me a quick state of the team.",
];

function citationLink(c: Citation): string {
  if (c.entityType === "designer") return `/designers/${c.entityId}`;
  if (c.entityType === "one-on-one") return `/one-on-ones/${c.entityId}`;
  if (c.entityType === "review-cycle") return `/cycles/${c.entityId}`;
  return `/designers/${c.entityId}`;
}

function CitationChip({ c }: { c: Citation }) {
  return (
    <Link href={citationLink(c)}>
      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-secondary/80 font-mono">
        {c.entityType}:{c.entityId.slice(-6)}
      </Badge>
    </Link>
  );
}

function renderContent(text: string): string {
  // Convert [entity-type:id] to styled spans (handled separately via citations array)
  return text.replace(/\[([a-z-]+):([a-zA-Z0-9]+)\]/g, "[$1:…$2]");
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
          AI
        </div>
      )}
      <div className={`max-w-[80%] space-y-1`}>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm"
          }`}
        >
          {renderContent(msg.content)}
          {msg.streaming && <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-text-bottom" />}
        </div>
        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.citations.map((c, i) => <CitationChip key={i} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load existing history
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => {
        setMessages((d.data ?? []).map((m: Message & { citations: string }) => ({
          ...m,
          citations: typeof m.citations === "string" ? JSON.parse(m.citations) : m.citations,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function clearHistory() {
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
    toast.success("Conversation cleared.");
  }

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Add streaming placeholder
    const placeholder: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.aiDisabled) {
          setMessages((prev) => prev.slice(0, -1).concat({
            role: "assistant",
            content: "AI is disabled. Enable AI_MODE=anthropicDirect in .env.local to use chat.",
            citations: [],
          }));
          return;
        }
        throw new Error(err.error ?? "Request failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let finalCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.text) {
              accumulated += event.text;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: accumulated, streaming: true };
                return next;
              });
            }
            if (event.done) {
              finalCitations = event.citations ?? [];
            }
          } catch { /* skip */ }
        }
      }

      // Finalize
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: accumulated, citations: finalCitations, streaming: false };
        return next;
      });
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      toast.error(String(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Team chat</h1>
          <p className="text-xs text-muted-foreground">Ask anything about your team — grounded in your notes.</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={clearHistory}>
          New conversation
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && <p className="text-sm text-muted-foreground text-center">Loading…</p>}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <p className="text-sm text-muted-foreground">Ask a question about your team.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Example chips (when messages exist) */}
      {messages.length > 0 && !sending && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
          {EXAMPLE_CHIPS.slice(0, 4).map((chip) => (
            <button
              key={chip}
              onClick={() => send(chip)}
              className="rounded-full border px-3 py-1 text-xs whitespace-nowrap hover:bg-muted transition-colors shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32"
            placeholder="Ask about your team… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          <Button
            size="sm"
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="h-11 px-4"
          >
            {sending ? "…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
