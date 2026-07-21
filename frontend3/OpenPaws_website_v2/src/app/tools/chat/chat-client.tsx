"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import type { ChatSession } from "@/lib/chat";

type Msg = { role: "user" | "assistant"; content: string };

/** Render Markdown (incl. GFM tables) to HTML. */
function renderMarkdown(md: string): string {
  return micromark(md, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}

/** Short "when" label for the sidebar, e.g. "Jul 8, 14:32". */
function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatClient({
  sessions,
  activeSessionId,
  initialMessages,
}: {
  sessions: ChatSession[];
  activeSessionId: string | null;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(activeSessionId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync when navigating between sessions. Keyed on the
  // session id only: `initialMessages` gets a new identity on every server
  // re-render (e.g. router.refresh() updating the sidebar), and re-syncing on
  // it would wipe an in-flight reply and any visible error.
  useEffect(() => {
    setMessages(initialMessages);
    setSessionId(activeSessionId);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, pending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || pending) return;

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: query }]);
    setPending(true);

    const wasNewChat = !sessionId;
    // Roll back the optimistic user message and restore the input on failure.
    const fail = (message: string) => {
      setError(message);
      setMessages((m) => m.slice(0, -1));
      setInput(query);
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query }),
      });

      // Errors come back as JSON, not a stream.
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || contentType.includes("application/json")) {
        let message = "Something went wrong.";
        let returnedSessionId: string | undefined;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
          returnedSessionId = data?.sessionId;
          // A buffered (non-streaming) success still works: render the reply.
          if (res.ok && typeof data?.reply === "string") {
            setSessionId(data.sessionId);
            setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
            router.replace(`/tools/chat?session=${data.sessionId}`);
            if (wasNewChat) router.refresh();
            return;
          }
        } catch {
          /* keep default message */
        }
        if (returnedSessionId) setSessionId(returnedSessionId);
        fail(message);
        return;
      }

      // Stream NDJSON tokens into a freshly-appended assistant bubble.
      let newSessionId =
        res.headers.get("x-session-id") || sessionId || null;
      let assistantText = "";
      let assistantStarted = false;
      const appendToken = (token: string) => {
        if (!token) return;
        assistantText += token;
        // Flip the flag synchronously, NOT inside the setMessages updater:
        // updaters run lazily at the next render, and when the whole stream
        // arrives in one chunk (Vercel buffers small responses) the read loop
        // finishes before React ever renders — the "did anything stream?"
        // check below would still see false and discard a successful reply.
        const isFirstToken = !assistantStarted;
        assistantStarted = true;
        setMessages((m) => {
          const next = [...m];
          if (isFirstToken) {
            next.push({ role: "assistant", content: assistantText });
          } else {
            next[next.length - 1] = { role: "assistant", content: assistantText };
          }
          return next;
        });
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      const handleLine = (line: string) => {
        if (!line) return;
        let evt: {
          type?: string;
          content?: string;
          sessionId?: string;
        };
        try {
          evt = JSON.parse(line);
        } catch {
          return; // skip non-JSON lines
        }
        if (evt.type === "begin" && evt.sessionId) {
          newSessionId = evt.sessionId;
        } else if (evt.type === "item" && typeof evt.content === "string") {
          appendToken(evt.content);
        } else if (evt.type === "error") {
          streamError = evt.content ?? "The assistant was interrupted.";
        }
        // "end" → nothing to do
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          handleLine(buffer.slice(0, nl).trim());
          buffer = buffer.slice(nl + 1);
        }
      }
      handleLine(buffer.trim());

      if (!assistantStarted) {
        // Nothing streamed back — surface an error and roll back. The session
        // (and the user's message) were still saved server-side, so refresh
        // the sidebar rather than leaving a ghost "No chats yet."
        fail(
          streamError ??
            "The assistant returned no response. Your question was restored — press Send to try again.",
        );
        if (newSessionId) {
          setSessionId(newSessionId);
          if (wasNewChat) router.refresh();
        }
        return;
      }
      if (streamError) setError(streamError);

      if (newSessionId) setSessionId(newSessionId);
      // Refresh the server tree so the sidebar shows the new/updated session.
      if (newSessionId) router.replace(`/tools/chat?session=${newSessionId}`);
      if (wasNewChat) router.refresh();
    } catch {
      fail("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="py-4">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: previous chats */}
        <aside className="lg:border-r lg:border-white/10 lg:pr-6">
          <Link
            href="/tools/chat"
            onClick={() => {
              setMessages([]);
              setSessionId(null);
              setError(null);
            }}
            className="block rounded-lg border border-teal/50 bg-teal/[0.08] px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.15em] text-white transition-colors hover:bg-teal/20"
          >
            + New chat
          </Link>

          <p className="mt-6 mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-grey">
            Previous chats
          </p>
          <nav className="flex flex-col gap-1">
            {sessions.length === 0 && (
              <span className="text-sm text-white/40">No chats yet.</span>
            )}
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/tools/chat?session=${s.id}`}
                className={`rounded-md px-3 py-2 transition-colors ${
                  s.id === sessionId
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
                title={s.title}
              >
                <span className="block truncate text-sm">{s.title}</span>
                {/* Distinguishes chats with identical opening questions.
                    suppressHydrationWarning: the server renders in its own
                    timezone/locale; the client re-renders in the user's. */}
                <span
                  suppressHydrationWarning
                  className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white/30"
                >
                  {formatSessionDate(s.updated_at)}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main: Q&A thread */}
        <section className="flex min-h-[70vh] flex-col">
          <div
            ref={threadRef}
            className="flex-1 space-y-6 overflow-y-auto pb-6"
          >
            {messages.length === 0 && !pending && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="text-4xl" aria-hidden="true">💬</span>
                <h1 className="mt-4 font-display text-3xl text-white">
                  Ask anything
                </h1>
                <p className="mt-2 max-w-sm text-white/50">
                  Get answers from an AI fine-tuned for animal advocacy.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}

            {/* Thinking dots only until the first token arrives (after which the
                streaming assistant bubble is already showing). */}
            {pending && messages[messages.length - 1]?.role === "user" && (
              <Bubble role="assistant" content="" thinking />
            )}
          </div>

          {error && (
            <p className="mb-3 font-mono text-xs text-coral" role="alert">
              {error}
            </p>
          )}

          {/* Input */}
          <form onSubmit={send} className="flex items-end gap-3 border-t border-white/10 pt-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e);
                }
              }}
              rows={1}
              placeholder="Ask a question…"
              disabled={pending}
              className="max-h-40 flex-1 resize-none rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
            >
              {pending ? "…" : "Send"}
            </button>
          </form>
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/30">
            Enter to send · Shift+Enter for a new line
          </p>
        </section>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  thinking = false,
}: {
  role: "user" | "assistant";
  content: string;
  thinking?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap bg-teal text-on-teal"
            : "border border-white/10 bg-white/[0.03] text-white/85"
        }`}
      >
        {thinking ? (
          <span className="inline-flex gap-1" aria-label="Thinking">
            <Dot /> <Dot /> <Dot />
          </span>
        ) : isUser ? (
          content
        ) : (
          <div
            className="prose-paws prose-paws-chat"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
  );
}
