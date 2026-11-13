export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  opsSummary?: string;
};

type Props = {
  messages: ChatMessage[];
  busy: boolean;
  disabled: boolean;
  disabledReason?: string;
  onSend: (text: string) => void;
};

export function ChatPanel({
  messages,
  busy,
  disabled,
  disabledReason,
  onSend,
}: Props) {
  return (
    <aside className="flex h-full min-h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--chrome-border)] bg-[var(--chrome-surface)] text-sm text-[var(--chrome-fg)]">
      <div className="border-b border-[var(--chrome-border)] px-3 py-2 font-medium">
        AI Assistant
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-xs text-[var(--chrome-muted)]">
            Ask for HUD ROIs, then refine: add, move, rename, or delete boxes.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`max-w-[90%] rounded-xl px-3 py-2 ${
              m.role === "user"
                ? "ml-auto rounded-br-sm bg-[var(--accent)] text-white"
                : "mr-auto rounded-bl-sm border border-[var(--chrome-border)] bg-white text-[var(--chrome-fg)]"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.opsSummary ? (
              <p
                className={`mt-1 text-xs ${
                  m.role === "user" ? "text-sky-100" : "text-[var(--chrome-muted)]"
                }`}
              >
                {m.opsSummary}
              </p>
            ) : null}
          </div>
        ))}
        {busy && (
          <p className="text-xs text-[var(--chrome-muted)]">Thinking…</p>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-[var(--chrome-border)] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get("text") || "").trim();
          if (!text || disabled || busy) return;
          onSend(text);
          e.currentTarget.reset();
        }}
      >
        <input
          name="text"
          className="min-w-0 flex-1 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-input)] px-2 py-1.5 text-[var(--chrome-fg)] disabled:opacity-50"
          placeholder={disabledReason || "Message…"}
          disabled={disabled || busy}
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          disabled={disabled || busy}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
