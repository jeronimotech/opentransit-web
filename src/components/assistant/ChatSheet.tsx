"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coarsen } from "@/lib/analytics/core";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Icon, Spinner } from "@/components/ui/primitives";
import { track } from "@/lib/analytics";
import { streamChat, type ChatHandle } from "@/lib/assistant/client";
import { applyChatEvent, assistantErrorKey, assistantQueryProps, assistantOf, chatSessionId, emptyAssistantTurn, markNoticeShown, providerLabel, resetConversation, shouldShowNotice, toolLabel, wireMessages, type ChatTurn } from "@/lib/assistant";
import { ChatCardView } from "./ChatCard";
import type { City } from "@/lib/api/types";

/**
 * The assistant, phase 1: text.
 *
 * Two rules shape this component. Cards arrive before the prose, so a useful
 * answer is on screen while the sentence is still being written. And nothing
 * the user types is ever tracked: the analytics event carries which tools ran
 * and how long it took, never the question.
 */
export function ChatSheet({ city, open, onClose, pos }: { city: City; open: boolean; onClose: () => void; pos: { lat: number; lon: number } | null }) {
  const { t, lang } = useI18n();
  const a = assistantOf(city);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const handle = useRef<ChatHandle | null>(null);
  const startedAt = useRef(0);
  const toolsUsed = useRef<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (shouldShowNotice(city.id)) setNotice(true);
    // Remember who opened us so Escape hands the focus back where it came from.
    const opener = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, city.id, onClose]);

  // Leaving must not leave a request (or a half-written reply) behind.
  useEffect(() => {
    if (open) return;
    handle.current?.abort();
    handle.current = null;
    setBusy(false);
    setConfirmNew(false);
  }, [open]);
  useEffect(
    () => () => {
      handle.current?.abort();
      handle.current = null;
    },
    [],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      if (notice) {
        markNoticeShown(city.id);
        setNotice(false);
      }
      const id = `a${Date.now()}`;
      const next: ChatTurn[] = [
        ...turns,
        { id: `u${Date.now()}`, role: "user", text: q, cards: [], tool: null, done: true },
        emptyAssistantTurn(id),
      ];
      setTurns(next);
      setInput("");
      setBusy(true);
      startedAt.current = Date.now();
      toolsUsed.current = [];

      const patch = (fn: (turn: ChatTurn) => ChatTurn) => setTurns((prev) => prev.map((x) => (x.id === id ? fn(x) : x)));

      handle.current = streamChat(
        city.id,
        {
          sessionId: chatSessionId(),
          messages: wireMessages(next.slice(0, -1)),
          // Rounded to ~110 m before it leaves the browser, matching what the
          // notice promises and what the mobile client sends. A question never
          // needs a precise fix, and an exact one would identify a doorway.
          context: {
            lat: pos ? coarsen(pos.lat) : null,
            lon: pos ? coarsen(pos.lon) : null,
            locale: lang,
          },
        },
        (ev) => {
          patch((x) => applyChatEvent(x, ev));
          if (ev.type === "tool") toolsUsed.current.push(ev.name);
          else if (ev.type === "error") {
            setBusy(false);
            // the question itself never leaves the device; only the fact that it failed
            track("error", { code: ev.code, screen: "assistant" });
          } else if (ev.type === "done") {
            setBusy(false);
            track("assistant_query", assistantQueryProps(toolsUsed.current, Date.now() - startedAt.current, true));
          }
        },
      );
    },
    [busy, city.id, lang, notice, pos, turns],
  );

  /**
   * "New conversation": drop the history and start a new session id. The reply
   * limit is counted per session on the server, so carrying the old id over
   * would start the new conversation with the old one's quota already spent.
   */
  const startNew = useCallback(() => {
    handle.current?.abort();
    handle.current = null;
    const fresh = resetConversation();
    setTurns(fresh.turns);
    setInput("");
    setBusy(false);
    setConfirmNew(false);
    inputRef.current?.focus();
  }, []);

  const suggestions = useMemo(() => t.assistant.suggestions, [t]);
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="assistant-title"
      data-testid="assistant-sheet"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[62vh] min-h-0 flex-col rounded-t-2xl border border-line bg-paper shadow-card md:inset-x-auto md:bottom-4 md:right-4 md:h-[min(640px,72vh)] md:w-[420px] md:rounded-2xl"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon.Chat className="text-signal" />
        <h2 id="assistant-title" className="flex-1 text-base font-extrabold tracking-tight">
          {t.assistant.title}
        </h2>
        <Button
          size="iconSm"
          variant="ghost"
          onClick={() => setConfirmNew(true)}
          disabled={!turns.length}
          aria-label={t.assistant.newChat}
          title={t.assistant.newChat}
          data-testid="assistant-new"
        >
          <Icon.NewChat width={18} height={18} />
        </Button>
        <Button size="iconSm" variant="ghost" onClick={onClose} aria-label={t.common.close}>
          <Icon.Close width={18} height={18} />
        </Button>
      </header>

      {confirmNew ? (
        <div className="border-b border-line bg-paper-3 px-4 py-2.5" role="alertdialog" aria-label={t.assistant.newChat} data-testid="assistant-new-confirm">
          <p className="text-xs text-ink-2">{t.assistant.newChatConfirm}</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmNew(false)}>
              {t.assistant.newChatNo}
            </Button>
            <Button size="sm" variant="primary" onClick={startNew} data-testid="assistant-new-confirm-yes">
              {t.assistant.newChatYes}
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="border-b border-line bg-paper-3 px-4 py-2 text-xs text-ink-2" role="note">
          {t.assistant.notice(providerLabel(a))}
        </p>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-busy={busy}>
        {!turns.length ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-2">{t.assistant.intro}</p>
            <ul className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => ask(s)} className="min-h-11 w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-left text-sm font-semibold hover:border-ink">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {turns.map((turn) => (
              <li key={turn.id} className={turn.role === "user" ? "flex justify-end" : ""}>
                {turn.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-sm text-paper">{turn.text}</p>
                ) : (
                  <div className="flex max-w-full flex-col gap-2">
                    {turn.cards.map((c, i) => (
                      <ChatCardView key={`${turn.id}-c${i}`} card={c} city={city} />
                    ))}
                    {turn.tool ? (
                      <p className="inline-flex items-center gap-2 text-sm text-ink-3" data-testid="assistant-thinking">
                        <Spinner className="h-3.5 w-3.5" /> {toolLabel(turn.tool, t.assistant)}
                      </p>
                    ) : null}
                    {turn.error ? (
                      <p className="rounded-lg border border-brick/40 bg-brick-soft px-3 py-2 text-sm font-semibold text-brick" role="alert" data-testid="assistant-error">
                        {t.assistant[assistantErrorKey(turn.error.code)]}
                      </p>
                    ) : turn.text ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
                    ) : !turn.cards.length && !turn.tool ? (
                      <p className="inline-flex items-center gap-2 text-sm text-ink-3">
                        <Spinner className="h-3.5 w-3.5" /> {t.assistant.thinking}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-line px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.assistant.placeholder}
          aria-label={t.assistant.placeholder}
          maxLength={300}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-paper-2 px-4 text-sm text-ink placeholder:text-ink-3 focus:border-signal"
        />
        <Button type="submit" variant="primary" size="icon" disabled={!input.trim() || busy} aria-label={t.assistant.send} className="rounded-full">
          {busy ? <Spinner className="border-t-signal-ink" /> : <Icon.Send width={18} height={18} />}
        </Button>
      </form>
    </div>
  );
}
