import type { AssistantConfig, AssistantProvider, AssistantPublic, ChatCard, ChatEvent, City } from "@/lib/api/types";

export const PROVIDER_NAMES: Record<AssistantProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
};

/**
 * Model shown as the field's placeholder when the operator leaves it empty.
 * Only Anthropic is pinned by the contract; the rest are the ids the API
 * documents as its default, and the field stays free text so an operator can
 * move to a newer model without waiting for a release.
 */
export const PROVIDER_DEFAULT_MODEL: Record<AssistantProvider, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5",
  deepseek: "deepseek-chat",
  gemini: "gemini-2.5-flash",
};

export const PROVIDERS: AssistantProvider[] = ["anthropic", "openai", "deepseek", "gemini"];

export const DEFAULT_ASSISTANT: AssistantConfig = {
  enabled: false,
  provider: "anthropic",
  model: null,
  apiKey: null,
  baseUrl: null,
  maxRepliesPerSession: 30,
  maxToolCallsPerReply: 6,
  dailyBudgetUsd: 5,
  rateLimitPerMinute: 6,
  systemExtra: null,
  logConversations: false,
};

/** The public slice of the city's assistant settings (never the key). */
export function assistantOf(city: City): AssistantPublic | null {
  const a = city.config?.assistant as AssistantConfig | AssistantPublic | null | undefined;
  if (!a) return null;
  return { enabled: !!a.enabled, provider: a.provider ?? "anthropic", model: a.model ?? null, providerName: (a as AssistantPublic).providerName ?? null };
}

/** Whether to show the entry point at all. Offline hides it (the API is the brain). */
export function assistantEnabled(city: City, online = true): boolean {
  return online && !!assistantOf(city)?.enabled;
}

export function providerLabel(a: AssistantPublic | null): string {
  if (!a) return "";
  return a.providerName || PROVIDER_NAMES[a.provider] || a.provider;
}

/* ── session identity and the one-time provider notice ───────────────────── */

const SESSION_KEY = "ot.assistant.session";
const NOTICE_KEY = "ot.assistant.notice";

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // private mode / blocked storage: the chat still works, it just re-introduces itself
  }
}

/** A random id per browser tab. Not linked to anything and never persisted to disk. */
export function chatSessionId(): string {
  const s = store();
  const cur = s?.getItem(SESSION_KEY);
  if (cur) return cur;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  s?.setItem(SESSION_KEY, id);
  return id;
}

/** True the first time in this session; the caller then shows the provider notice. */
export function shouldShowNotice(city: string): boolean {
  const s = store();
  if (!s) return true;
  return s.getItem(`${NOTICE_KEY}.${city}`) !== "1";
}

export function markNoticeShown(city: string): void {
  store()?.setItem(`${NOTICE_KEY}.${city}`, "1");
}

/* ── admin payload: the masked-key rule ──────────────────────────────────── */

/** "••••1a2b" — what the API returns instead of a stored key. */
export const isMaskedKey = (v: string | null | undefined): boolean => !!v && /^[•*]{2,}/.test(v);

/**
 * What to PUT for `apiKey`:
 *  - untouched (still the mask) → echo it back, so the server keeps what it has;
 *  - edited                     → the new plain value;
 *  - cleared by the operator    → `null`, which explicitly removes it.
 *
 * Dropping the field entirely would also "keep", but echoing is what the other
 * credential editors do and it keeps one rule in one place.
 */
export function assistantPayload(draft: AssistantConfig): AssistantConfig {
  const key = draft.apiKey;
  return { ...draft, apiKey: key === null || key === "" ? null : key };
}

/** True when the operator typed a new key (so the UI can say "se guardará"). */
export function keyIsNew(draft: AssistantConfig, original: string | null | undefined): boolean {
  const k = draft.apiKey;
  if (!k) return false;
  if (isMaskedKey(k)) return false;
  return k !== original;
}

/* ── conversation model ──────────────────────────────────────────────────── */

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  /** Prose, accumulated from `token` frames. */
  text: string;
  /** Structured results, in arrival order — they land before the prose. */
  cards: ChatCard[];
  /** The tool currently running, for the "pensando…" line. */
  tool: string | null;
  done: boolean;
  error?: { code: string; message: string } | null;
};

export const emptyAssistantTurn = (id: string): ChatTurn => ({ id, role: "assistant", text: "", cards: [], tool: null, done: false, error: null });

/** Human label for the tool being run, so "pensando…" says what it is doing. */
export function toolLabel(name: string, t: { tools: Record<string, string>; thinking: string }): string {
  return t.tools[name] ?? t.thinking;
}

/** Only the messages the API needs: role + text, no cards, no ids. */
export function wireMessages(turns: ChatTurn[]): { role: "user" | "assistant"; content: string }[] {
  return turns
    .filter((x) => x.text.trim() && !x.error)
    .map((x) => ({ role: x.role, content: x.text }));
}

/**
 * One event folded into the running turn. Pure, so the ordering rule the contract
 * cares about — a `card` is shown as soon as its tool returns, before the prose —
 * is testable without rendering anything.
 */
export function applyChatEvent(turn: ChatTurn, ev: ChatEvent): ChatTurn {
  switch (ev.type) {
    case "token":
      return { ...turn, text: turn.text + ev.text, tool: null };
    case "tool":
      return { ...turn, tool: ev.name };
    case "card":
      return { ...turn, cards: [...turn.cards, { kind: ev.kind, payload: ev.payload }], tool: null };
    case "error":
      return { ...turn, error: { code: ev.code, message: ev.message }, tool: null, done: true };
    case "done":
      return { ...turn, done: true, tool: null };
  }
}

export type AssistantErrorKey = "errBudget" | "errDisabled" | "errRate" | "errUpstream";

/**
 * Which plain sentence to show. Anything unrecognised reads as "the provider is
 * down", which is the honest description of an error we cannot name.
 */
export function assistantErrorKey(code: string): AssistantErrorKey {
  switch (code) {
    case "ASSISTANT_BUDGET":
      return "errBudget";
    case "ASSISTANT_DISABLED":
      return "errDisabled";
    case "ASSISTANT_RATE_LIMITED":
      return "errRate";
    default:
      return "errUpstream";
  }
}

/**
 * The only analytics the assistant emits. `CONTRACT-analytics.md` forbids free text,
 * so this builds the event from three values and nothing else: what the question was
 * can never be reconstructed from it, and neither can where it was asked.
 */
export function assistantQueryProps(toolsUsed: string[], latencyMs: number, ok: boolean): { toolsUsed: string[]; latencyMs: number; ok: boolean } {
  return { toolsUsed: [...new Set(toolsUsed)], latencyMs: Math.max(0, Math.round(latencyMs)), ok };
}
