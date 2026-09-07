import { API_URL, MOCK } from "@/lib/api/client";
import { SseDecoder, toChatEvent } from "./sse";
import type { AssistantHealth, ChatEvent, ChatRequest } from "@/lib/api/types";

export type ChatHandle = { abort: () => void };

/**
 * Opens `POST /v1/cities/{city}/chat` and pushes typed events as they arrive.
 *
 * `EventSource` is GET-only, so this reads the response body as a stream. The
 * returned handle aborts the request: leaving the sheet must not leave a
 * connection (or a half-written reply) behind.
 */
export function streamChat(
  city: string,
  body: ChatRequest,
  onEvent: (ev: ChatEvent) => void,
  opts?: { signal?: AbortSignal },
): ChatHandle {
  const ctrl = new AbortController();
  const signal = opts?.signal ?? ctrl.signal;

  const run = async () => {
    if (MOCK) {
      const { mockChatStream } = await import("@/mocks/assistant");
      await mockChatStream(body, onEvent, signal);
      return;
    }
    const res = await fetch(`${API_URL}/v1/cities/${encodeURIComponent(city)}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      // errors come back as JSON, not as a stream
      let code = "ASSISTANT_UPSTREAM";
      let message = `${res.status} ${res.statusText}`;
      try {
        const j = (await res.json()) as { error?: { code?: string; message?: string } };
        code = j.error?.code ?? code;
        message = j.error?.message ?? message;
      } catch {
        /* not json */
      }
      onEvent({ type: "error", code, message });
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    const sse = new SseDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of sse.push(dec.decode(value, { stream: true }))) {
        const ev = toChatEvent(frame);
        if (ev) onEvent(ev);
      }
    }
    for (const frame of sse.flush()) {
      const ev = toChatEvent(frame);
      if (ev) onEvent(ev);
    }
  };

  run().catch((err) => {
    if (signal.aborted) return; // the user closed the sheet; not an error
    onEvent({ type: "error", code: "ASSISTANT_UPSTREAM", message: err instanceof Error ? err.message : String(err) });
  });

  return { abort: () => ctrl.abort() };
}

/** Admin-only health: which provider is configured and what it has spent today. */
export async function assistantHealth(city: string, token: string): Promise<AssistantHealth> {
  if (MOCK) {
    const { mockAssistantHealth } = await import("@/mocks/assistant");
    return mockAssistantHealth();
  }
  const res = await fetch(`${API_URL}/v1/cities/${encodeURIComponent(city)}/chat/health`, {
    headers: { "X-Admin-Token": token, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as AssistantHealth;
}
