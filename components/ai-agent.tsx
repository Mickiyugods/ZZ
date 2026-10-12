"use client";

import * as React from "react";
import { IconMessageCircle2, IconX, IconSend2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi, I'm the ZEEP Assistant. Ask me how vaults, raffles, or launching a coin works.",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export function AiAgent() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const r = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await r.json().catch(() => ({}));
      const reply = r.ok ? data.reply || "Sorry, I couldn't generate a reply." : data.error || "Something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the ZEEP Assistant — try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="ZEEP Assistant"
          className="fixed bottom-24 right-5 z-[80] flex w-[min(360px,calc(100vw-40px))] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-[14px] font-semibold">ZEEP Assistant</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className={cn("flex size-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]", focusRing)}
            >
              <IconX className="size-[16px]" stroke={1.75} />
            </button>
          </div>

          <div ref={listRef} className="flex max-h-[360px] min-h-[200px] flex-col gap-2.5 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-[var(--primitive-radius-control-sm,0.5rem)] px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user"
                    ? "self-end bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "self-start border border-[var(--border)] bg-[var(--background)]",
                )}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] text-[var(--muted-foreground)]">
                Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] px-3 py-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about vaults, raffles…"
                className="input min-h-9 flex-1 py-2 text-[13px]"
                disabled={sending}
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={sending || !input.trim()}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50",
                  focusRing,
                )}
              >
                <IconSend2 className="size-[16px]" stroke={1.75} />
              </button>
            </form>
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Can make mistakes — not financial advice.</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close ZEEP Assistant" : "Open ZEEP Assistant"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-5 right-5 z-[80] flex size-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]",
          focusRing,
        )}
      >
        {open ? <IconX className="size-[22px]" stroke={1.75} /> : <IconMessageCircle2 className="size-[22px]" stroke={1.75} />}
      </button>
    </>
  );
}
