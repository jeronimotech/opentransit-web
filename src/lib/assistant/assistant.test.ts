import { describe, expect, it } from "vitest";
import { SseDecoder, decodeChatStream, toChatEvent } from "./sse";
import {
  DEFAULT_ASSISTANT,
  applyChatEvent,
  assistantEnabled,
  assistantErrorKey,
  assistantOf,
  assistantPayload,
  assistantQueryProps,
  emptyAssistantTurn,
  isMaskedKey,
  keyIsNew,
  chatSessionId,
  providerLabel,
  resetConversation,
  spentToday,
  toolLabel,
  wireMessages,
  type ChatTurn,
} from "./index";
import { ASSISTANT_RULES, EN_MESSAGES, validateAssistant } from "@/lib/admin/validate";
import type { AssistantConfig, ChatEvent, City } from "@/lib/api/types";

/* ── SSE parsing ─────────────────────────────────────────────────────────── */

describe("SSE frame decoding", () => {
  it("reads the payload-typed shape", () => {
    const events = decodeChatStream(['data: {"type":"token","text":"Hola"}', "", 'data: {"type":"done","costUsd":0.004}', "", ""].join("\n"));
    expect(events).toEqual([
      { type: "token", text: "Hola" },
      { type: "done", usage: null, costUsd: 0.004 },
    ]);
  });

  it("reads the named-event shape, where the payload carries no type", () => {
    const events = decodeChatStream(["event: token", 'data: {"text":"Hola"}', "", "event: tool", 'data: {"name":"plan_trip","args":{"to":"Portal Sur"}}', "", ""].join("\n"));
    expect(events).toEqual([
      { type: "token", text: "Hola" },
      { type: "tool", name: "plan_trip", args: { to: "Portal Sur" } },
    ]);
  });

  it("lets the payload's own type win over the frame name", () => {
    expect(toChatEvent({ event: "token", data: '{"type":"error","code":"ASSISTANT_BUDGET","message":"x"}' })).toEqual({
      type: "error",
      code: "ASSISTANT_BUDGET",
      message: "x",
    });
  });

  it("keeps a partial frame until the rest of the chunk arrives", () => {
    const dec = new SseDecoder();
    expect(dec.push('data: {"type":"tok')).toEqual([]);
    const frames = dec.push('en","text":"bue"}\n\n');
    expect(frames.map(toChatEvent)).toEqual([{ type: "token", text: "bue" }]);
  });

  it("accepts CRLF, comments and keep-alives without emitting anything for them", () => {
    const events = decodeChatStream([": keep-alive", "", 'data: {"type":"token","text":"a"}', "", "data: [DONE]", "", ""].join("\r\n"));
    expect(events).toEqual([{ type: "token", text: "a" }]);
  });

  it("treats a bare data line under event: token as a delta", () => {
    expect(decodeChatStream("event: token\ndata: hola\n\n")).toEqual([{ type: "token", text: "hola" }]);
  });

  it("emits done for a [DONE] sentinel that is named", () => {
    expect(decodeChatStream("event: done\ndata: [DONE]\n\n")).toEqual([{ type: "done" }]);
  });

  it("ignores an unknown event type rather than breaking the stream", () => {
    const events = decodeChatStream(['data: {"type":"thinking","text":"…"}', "", 'data: {"type":"token","text":"ok"}', "", ""].join("\n"));
    expect(events).toEqual([{ type: "token", text: "ok" }]);
  });

  it("flushes a last frame that never got its blank line", () => {
    expect(decodeChatStream('data: {"type":"token","text":"fin"}')).toEqual([{ type: "token", text: "fin" }]);
  });
});

/* ── card-before-prose ordering ──────────────────────────────────────────── */

const fold = (events: ChatEvent[]): ChatTurn => events.reduce(applyChatEvent, emptyAssistantTurn("a1"));

describe("cards arrive before the prose", () => {
  const stream = [
    'data: {"type":"tool","name":"plan_trip"}',
    "",
    'data: {"type":"card","kind":"itinerary","payload":{"id":"it1"}}',
    "",
    'data: {"type":"token","text":"Toma el "}',
    "",
    'data: {"type":"token","text":"J74."}',
    "",
    'data: {"type":"done","usage":{"outputTokens":12},"costUsd":0.002}',
    "",
    "",
  ].join("\n");

  it("keeps the contract's order: tool, then card, then prose", () => {
    expect(decodeChatStream(stream).map((e) => e.type)).toEqual(["tool", "card", "token", "token", "done"]);
  });

  it("has the card on the turn while the prose is still empty", () => {
    const events = decodeChatStream(stream);
    const atCard = fold(events.slice(0, 2));
    expect(atCard.cards).toEqual([{ kind: "itinerary", payload: { id: "it1" } }]);
    expect(atCard.text).toBe("");
    expect(atCard.done).toBe(false);
  });

  it("clears the running-tool line once its card lands", () => {
    expect(fold(decodeChatStream(stream).slice(0, 1)).tool).toBe("plan_trip");
    expect(fold(decodeChatStream(stream).slice(0, 2)).tool).toBeNull();
  });

  it("ends with both the card and the whole sentence", () => {
    const turn = fold(decodeChatStream(stream));
    expect(turn.cards).toHaveLength(1);
    expect(turn.text).toBe("Toma el J74.");
    expect(turn.done).toBe(true);
    expect(turn.error).toBeNull();
  });

  it("keeps several cards in arrival order", () => {
    const turn = fold([
      { type: "card", kind: "board", payload: 1 },
      { type: "card", kind: "alerts", payload: 2 },
    ]);
    expect(turn.cards.map((c) => c.kind)).toEqual(["board", "alerts"]);
  });
});

/* ── error states ────────────────────────────────────────────────────────── */

describe("error states", () => {
  it("decodes each contract error code", () => {
    for (const code of ["ASSISTANT_DISABLED", "ASSISTANT_BUDGET", "ASSISTANT_RATE_LIMITED", "ASSISTANT_UPSTREAM"]) {
      expect(decodeChatStream(`data: {"type":"error","code":"${code}","message":"no"}\n\n`)).toEqual([{ type: "error", code, message: "no" }]);
    }
  });

  it("maps every code to its own sentence, and anything else to provider-down", () => {
    expect(assistantErrorKey("ASSISTANT_BUDGET")).toBe("errBudget");
    expect(assistantErrorKey("ASSISTANT_DISABLED")).toBe("errDisabled");
    expect(assistantErrorKey("ASSISTANT_RATE_LIMITED")).toBe("errRate");
    expect(assistantErrorKey("ASSISTANT_UPSTREAM")).toBe("errUpstream");
    expect(assistantErrorKey("SOMETHING_NEW")).toBe("errUpstream");
  });

  it("falls back to a code when the server sends none", () => {
    expect(decodeChatStream('data: {"type":"error","message":"boom"}\n\n')).toEqual([{ type: "error", code: "ASSISTANT_UPSTREAM", message: "boom" }]);
  });

  it("ends the turn and drops the thinking line", () => {
    const turn = fold([
      { type: "tool", name: "next_departures" },
      { type: "error", code: "ASSISTANT_BUDGET", message: "sin saldo" },
    ]);
    expect(turn.done).toBe(true);
    expect(turn.tool).toBeNull();
    expect(turn.error).toEqual({ code: "ASSISTANT_BUDGET", message: "sin saldo" });
  });

  it("never sends a failed turn back as conversation history", () => {
    const turns: ChatTurn[] = [
      { id: "u1", role: "user", text: "¿hay desvíos?", cards: [], tool: null, done: true },
      { id: "a1", role: "assistant", text: "", cards: [], tool: null, done: true, error: { code: "ASSISTANT_UPSTREAM", message: "x" } },
    ];
    expect(wireMessages(turns)).toEqual([{ role: "user", content: "¿hay desvíos?" }]);
  });

  it("sends only role and content, never cards or ids", () => {
    const turns: ChatTurn[] = [
      { id: "u1", role: "user", text: "hola", cards: [], tool: null, done: true },
      { id: "a1", role: "assistant", text: "hola!", cards: [{ kind: "board", payload: { secret: 1 } }], tool: null, done: true },
    ];
    expect(wireMessages(turns)).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "hola!" },
    ]);
  });
});

/* ── the masked-key payload rule ─────────────────────────────────────────── */

const cfg = (over: Partial<AssistantConfig> = {}): AssistantConfig => ({ ...DEFAULT_ASSISTANT, ...over });

describe("the API key never leaks and is only sent when it changed", () => {
  it("recognises what the API returns instead of a stored key", () => {
    expect(isMaskedKey("••••1a2b")).toBe(true);
    expect(isMaskedKey("****1a2b")).toBe(true);
    expect(isMaskedKey("sk-ant-real-key")).toBe(false);
    expect(isMaskedKey("")).toBe(false);
    expect(isMaskedKey(null)).toBe(false);
  });

  it("echoes the mask untouched, so the server keeps the key it has", () => {
    expect(assistantPayload(cfg({ apiKey: "••••1a2b" })).apiKey).toBe("••••1a2b");
    expect(keyIsNew(cfg({ apiKey: "••••1a2b" }), "••••1a2b")).toBe(false);
  });

  it("sends the plain value only when the operator typed a new one", () => {
    expect(assistantPayload(cfg({ apiKey: "sk-new" })).apiKey).toBe("sk-new");
    expect(keyIsNew(cfg({ apiKey: "sk-new" }), "••••1a2b")).toBe(true);
  });

  it("sends null to clear, and treats an emptied field as a clear", () => {
    expect(assistantPayload(cfg({ apiKey: "" })).apiKey).toBeNull();
    expect(assistantPayload(cfg({ apiKey: null })).apiKey).toBeNull();
    expect(keyIsNew(cfg({ apiKey: "" }), "••••1a2b")).toBe(false);
  });

  it("leaves every other field exactly as edited", () => {
    const draft = cfg({ apiKey: "••••1a2b", model: "gpt-5", dailyBudgetUsd: 12, logConversations: true });
    expect(assistantPayload(draft)).toEqual(draft);
  });
});

/* ── admin validation ────────────────────────────────────────────────────── */

/** The error keys are dotted paths, so read them as plain keys, not as a path. */
const fields = (a: AssistantConfig) => Object.keys(validateAssistant(a, EN_MESSAGES)).map((x) => x.replace("config.assistant.", ""));

describe("admin validation", () => {
  it("accepts the defaults plus a key", () => {
    expect(fields(cfg({ apiKey: "••••1a2b" }))).toEqual([]);
  });

  it("refuses to enable the assistant with no key at all", () => {
    expect(fields(cfg({ enabled: true, apiKey: null }))).toContain("apiKey");
    expect(fields(cfg({ enabled: true, apiKey: "••••1a2b" }))).not.toContain("apiKey");
  });

  it("keeps the limits inside their documented ranges", () => {
    expect(fields(cfg({ maxRepliesPerSession: 0 }))).toContain("maxRepliesPerSession");
    expect(fields(cfg({ maxRepliesPerSession: ASSISTANT_RULES.maxRepliesPerSession[1] + 1 }))).toContain("maxRepliesPerSession");
    expect(fields(cfg({ maxToolCallsPerReply: 99 }))).toContain("maxToolCallsPerReply");
    expect(fields(cfg({ rateLimitPerMinute: 0 }))).toContain("rateLimitPerMinute");
    expect(fields(cfg({ dailyBudgetUsd: -1 }))).toContain("dailyBudgetUsd");
    expect(fields(cfg({ dailyBudgetUsd: 0 }))).not.toContain("dailyBudgetUsd");
  });

  it("only accepts an https base URL", () => {
    expect(fields(cfg({ baseUrl: "http://proxy.local" }))).toContain("baseUrl");
    expect(fields(cfg({ baseUrl: "https://proxy.local/v1" }))).not.toContain("baseUrl");
    expect(fields(cfg({ baseUrl: "" }))).not.toContain("baseUrl");
  });

  it("caps the optional system note so it cannot become a second prompt", () => {
    expect(fields(cfg({ systemExtra: "x".repeat(501) }))).toContain("systemExtra");
    expect(fields(cfg({ systemExtra: "Prefiere TransMilenio." }))).not.toContain("systemExtra");
  });
});

/* ── the entry point ─────────────────────────────────────────────────────── */

const city = (assistant: unknown): City =>
  ({ id: "bogota", config: { assistant } } as unknown as City);

describe("when the entry point is shown", () => {
  it("is hidden when the city has no assistant block at all", () => {
    expect(assistantEnabled(city(null))).toBe(false);
    expect(assistantOf(city(undefined))).toBeNull();
  });

  it("is hidden when the city turned it off", () => {
    expect(assistantEnabled(city({ enabled: false, provider: "anthropic" }))).toBe(false);
  });

  it("is hidden offline, because every answer comes from the API", () => {
    expect(assistantEnabled(city({ enabled: true, provider: "anthropic" }), false)).toBe(false);
    expect(assistantEnabled(city({ enabled: true, provider: "anthropic" }), true)).toBe(true);
  });

  it("names the provider for the one-time notice", () => {
    expect(providerLabel(assistantOf(city({ enabled: true, provider: "deepseek" })))).toBe("DeepSeek");
    expect(providerLabel(assistantOf(city({ enabled: true, provider: "openai", providerName: "Azure OpenAI" })))).toBe("Azure OpenAI");
    expect(providerLabel(null)).toBe("");
  });

  it("never exposes the key even if a server mistakenly sent one", () => {
    const pub = assistantOf(city({ enabled: true, provider: "anthropic", apiKey: "sk-leak" }));
    expect(Object.keys(pub ?? {})).not.toContain("apiKey");
  });
});

describe("the thinking line names the tool", () => {
  const t = { tools: { plan_trip: "buscando rutas…" }, thinking: "pensando…" };
  it("uses the tool's own words when we have them", () => {
    expect(toolLabel("plan_trip", t)).toBe("buscando rutas…");
  });
  it("falls back to a generic line for a tool we do not know", () => {
    expect(toolLabel("some_new_tool", t)).toBe("pensando…");
  });
});

describe("the key never reaches a client", () => {
  it("the public city carries only the slice the UI needs", async () => {
    const { publicCity } = await import("@/mocks/admin");
    const a = publicCity().config?.assistant as Record<string, unknown>;
    expect(a).not.toHaveProperty("apiKey");
    expect(a).not.toHaveProperty("systemExtra");
    expect(a).not.toHaveProperty("dailyBudgetUsd");
    expect(a.enabled).toBe(true);
    expect(a.providerName).toBe("Anthropic");
  });

  it("the admin store hands back a mask, never the stored key", async () => {
    const { mockRequest } = await import("@/mocks/handlers");
    type MaskedConfig = { config: { assistant: { apiKey: string } } };
    const res = await mockRequest<{ effective: MaskedConfig; yaml: MaskedConfig }>("/v1/admin/cities/bogota/config", {}, {
      method: "GET",
      body: null,
      headers: { "X-Admin-Token": "demo" },
    });
    for (const key of [res.effective.config.assistant.apiKey, res.yaml.config.assistant.apiKey]) {
      expect(isMaskedKey(key)).toBe(true);
      expect(key).not.toContain("sk-ant");
    }
  });
});

describe("the mock server keeps or replaces the key the way the API does", () => {
  it("walks a new key, an echoed mask and a clear", async () => {
    const { mockRequest } = await import("@/mocks/handlers");
    const init = (body: unknown) => ({ method: "PUT", body: JSON.stringify(body), headers: { "X-Admin-Token": "demo" } });
    type Res = { yaml: { config: CityConfigLike }; override: { config: CityConfigLike } | null };
    const read = async (): Promise<Res> =>
      mockRequest<Res>("/v1/admin/cities/bogota/config", {}, { method: "GET", body: null, headers: { "X-Admin-Token": "demo" } });

    const base = (await read()).yaml.config;
    const put = async (apiKey: string | null) =>
      mockRequest<Res>("/v1/admin/cities/bogota/config", {}, init({ config: { ...base, assistant: { ...base.assistant, apiKey } } }));

    // a plain value replaces the stored key
    let r = await put("sk-openai-abcd1234");
    expect(r.override?.config.assistant.apiKey).toBe("••••1234");

    // the mask echoed back keeps it: the mask still ends in the same four characters
    r = await put("••••1234");
    expect(r.override?.config.assistant.apiKey).toBe("••••1234");

    // clearing it is refused while the assistant is on, which is the whole point
    await expect(put(null)).rejects.toThrow();
  });
});

type CityConfigLike = { assistant: { apiKey: string | null; enabled: boolean } } & Record<string, unknown>;

describe("what analytics is allowed to see", () => {
  it("carries three values and nothing that could rebuild the question", () => {
    const props = assistantQueryProps(["plan_trip", "plan_trip", "find_place"], 1234.7, true);
    expect(Object.values(props).every((v) => typeof v === "number" || typeof v === "boolean" || Array.isArray(v))).toBe(true);
    expect(Object.keys(props).sort()).toEqual(["latencyMs", "ok", "toolsUsed"]);
    expect(props.toolsUsed).toEqual(["plan_trip", "find_place"]);
    expect(props.latencyMs).toBe(1235);
    // the only strings are tool names: no prose, no coordinates
    expect(props.toolsUsed.every((x) => /^[a-z_]+$/.test(x))).toBe(true);
  });

  it("never reports a negative latency, whatever the clock did", () => {
    expect(assistantQueryProps([], -5, false).latencyMs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The card kinds are a contract with the API, not a guess. The list below is
// the contract as of the revision named next to it, and it is asserted on every
// run — this repo alone is enough to catch a renderer that drops a kind, which
// is exactly how the web shipped dropping seven of ten.
//
// When the API repo happens to sit next to this one, a second test compares the
// pinned list against the API's own source, so a rename there is caught the day
// it lands instead of the day someone notices an answer went blank. A clone of
// this repo alone skips that comparison rather than failing on a missing file.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ChatCardView } from "@/components/assistant/ChatCard";
import { coarsen } from "@/lib/analytics/core";

/** Every `{"kind": …}` the assistant's tools emit (opentransit-api, 2026-09-07). */
const API_CARD_KINDS = ["alerts", "bikeStations", "board", "fares", "itineraries", "next", "place", "routes", "stops", "vehicles"];

/** Every field `GET /chat/health` answers with (opentransit-api, 2026-09-07). */
const API_HEALTH_FIELDS = ["enabled", "provider", "model", "hasKey", "dailyBudgetUsd", "spentUsd", "calls", "errors", "startedAt"];

const apiFile = (...parts: string[]) => join(process.cwd(), "..", "opentransit-api", ...parts);
const TOOLS_PY = apiFile("app", "assistant", "tools.py");
const CHAT_PY = apiFile("app", "routers", "chat.py");
/** The neighbouring repo is a bonus, not a requirement: CI checks out this one alone. */
const hasApiRepo = existsSync(TOOLS_PY) && existsSync(CHAT_PY);
const DRIFT = "the API contract moved: update the pinned list in this file (and whatever consumes it)";

describe("card kinds", () => {
  it("the renderer handles every kind the API emits", () => {
    const rendered = ChatCardView.toString();
    expect(API_CARD_KINDS.filter((k) => !rendered.includes(`"${k}"`))).toEqual([]);
  });

  it("the type union lists every kind the API emits", () => {
    const types = readFileSync(join(process.cwd(), "src", "lib", "api", "types.ts"), "utf8");
    const union = types.slice(types.indexOf("export type ChatCardKind ="), types.indexOf("export type ChatCard ="));
    expect(API_CARD_KINDS.filter((k) => !union.includes(`"${k}"`))).toEqual([]);
  });

  it.skipIf(!hasApiRepo)("the pinned list still matches the API's own source", () => {
    const src = readFileSync(TOOLS_PY, "utf8");
    const emitted = [...new Set([...src.matchAll(/"kind":\s*"([A-Za-z]+)"/g)].map((m) => m[1]))].sort();
    expect(emitted.length).toBeGreaterThan(5); // the file was found and parsed
    expect(emitted, DRIFT).toEqual([...API_CARD_KINDS].sort());
  });

  it("the mock emits kinds the renderer knows", () => {
    const mock = readFileSync(join(process.cwd(), "src", "mocks", "assistant.ts"), "utf8");
    const mocked = [...new Set([...mock.matchAll(/kind:\s*"([A-Za-z]+)"/g)].map((m) => m[1]))];
    const rendered = ChatCardView.toString();
    expect(mocked.filter((k) => !rendered.includes(`"${k}"`))).toEqual([]);
  });
});

describe("the position sent with a question", () => {
  it("is coarsened to ~110 m before it leaves the browser", () => {
    // The notice promises we do not send an exact location; the sheet must round
    // to the same 3 decimals the mobile client and the analytics queue use.
    const sheet = readFileSync(join(process.cwd(), "src", "components", "assistant", "ChatSheet.tsx"), "utf8");
    expect(sheet).toMatch(/lat:\s*pos\s*\?\s*coarsen\(pos\.lat\)/);
    expect(sheet).toMatch(/lon:\s*pos\s*\?\s*coarsen\(pos\.lon\)/);
    expect(sheet).not.toMatch(/lat:\s*pos\?\.lat\s*\?\?/);
  });

  it("coarsen keeps three decimals", () => {
    expect(coarsen(4.6766217)).toBe(4.677);
    expect(coarsen(-74.0467209)).toBe(-74.047);
  });
});

/* ── starting a new conversation ─────────────────────────────────────────── */

describe("new conversation", () => {
  /** sessionStorage does not exist under vitest's node environment. */
  function fakeStorage() {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    } as Storage;
    (globalThis as { sessionStorage?: Storage }).sessionStorage = store;
    return store;
  }

  it("clears the history and starts a session the server has not counted yet", () => {
    fakeStorage();
    const before = chatSessionId();
    expect(chatSessionId()).toBe(before); // stable while the conversation lasts

    const fresh = resetConversation();
    expect(fresh.turns).toEqual([]);
    expect(fresh.sessionId).not.toBe(before);
    expect(chatSessionId()).toBe(fresh.sessionId); // the next question uses the new one
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  it("the sheet offers the button and only wipes after a confirmation", () => {
    const sheet = readFileSync(join(process.cwd(), "src", "components", "assistant", "ChatSheet.tsx"), "utf8");
    expect(sheet).toMatch(/data-testid="assistant-new"/);
    expect(sheet).toMatch(/disabled=\{!turns\.length\}/); // nothing to clear, nothing to press
    expect(sheet).toMatch(/onClick=\{startNew\}/); // the wipe hangs off the confirmation, not the header button
    expect(sheet).toMatch(/onClick=\{\(\) => setConfirmNew\(true\)\}/);
  });
});

/* ── the admin health payload ────────────────────────────────────────────── */

describe("assistant health", () => {
  it("the type carries every field the API sends, spend included", () => {
    const types = readFileSync(join(process.cwd(), "src", "lib", "api", "types.ts"), "utf8");
    const block = types.slice(types.indexOf("export type AssistantHealth ="));
    const decl = block.slice(0, block.indexOf("};"));
    // a declaration, not a substring: "spentUsdX" must not satisfy "spentUsd"
    expect(API_HEALTH_FIELDS.filter((f) => !new RegExp(`\\b${f}\\??:`).test(decl))).toEqual([]);
  });

  it.skipIf(!hasApiRepo)("the pinned field list still matches the API's own router", () => {
    const src = readFileSync(CHAT_PY, "utf8");
    const at = src.indexOf("async def chat_health");
    const body = src.slice(at, at + 1200);
    const fields = [...new Set([...body.matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]))];
    expect(fields, DRIFT).toEqual(API_HEALTH_FIELDS);
  });

  it("reads either spelling and survives a payload with neither", () => {
    // the shape the live API answers with
    expect(spentToday({ spentUsd: 0.178151 })).toBeCloseTo(0.178151, 6);
    // the shape an older server answers with
    expect(spentToday({ spendTodayUsd: 0.34 })).toBe(0.34);
    // and the crash the admin page used to take
    expect(spentToday({})).toBeNull();
    expect(spentToday(null)).toBeNull();
  });

  it("the admin tab never dereferences the spend field directly", () => {
    const tab = readFileSync(join(process.cwd(), "src", "components", "admin", "AssistantTab.tsx"), "utf8");
    expect(tab).not.toMatch(/health\.spendTodayUsd\.toFixed/);
    expect(tab).not.toMatch(/health\.spentUsd\.toFixed/);
    expect(tab).toMatch(/spentToday\(probe\.health\)/);
  });

  it("the mock answers with the field name the API uses", () => {
    const mock = readFileSync(join(process.cwd(), "src", "mocks", "assistant.ts"), "utf8");
    expect(mock).toMatch(/spentUsd:/);
  });
});
