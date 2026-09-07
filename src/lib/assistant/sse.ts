import type { ChatEvent, ChatUsage } from "@/lib/api/types";

/**
 * SSE decoding for the chat stream.
 *
 * `EventSource` cannot POST, so the chat is a `fetch` whose body we read as a
 * stream and split into frames ourselves. Two shapes are accepted, because the
 * server may name the frame either way and a client that only understood one of
 * them would silently render nothing:
 *
 *   event: token          |   data: {"type":"token","text":"…"}
 *   data: {"text":"…"}    |
 *
 * When both are present the `type` inside the payload wins.
 */
export type SseFrame = { event: string | null; data: string };

/** Splits a raw SSE text stream into frames, keeping any trailing partial frame. */
export class SseDecoder {
  private buf = "";

  /** Feed a chunk; returns every frame that is now complete. */
  push(chunk: string): SseFrame[] {
    this.buf += chunk.replace(/\r\n/g, "\n");
    const out: SseFrame[] = [];
    let i: number;
    // frames are separated by a blank line
    while ((i = this.buf.indexOf("\n\n")) !== -1) {
      const raw = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      const frame = parseFrame(raw);
      if (frame) out.push(frame);
    }
    return out;
  }

  /** Anything left when the body ends (a server that forgot the final blank line). */
  flush(): SseFrame[] {
    const rest = this.buf;
    this.buf = "";
    const frame = rest.trim() ? parseFrame(rest) : null;
    return frame ? [frame] : [];
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive
    const idx = line.indexOf(":");
    const field = idx === -1 ? line : line.slice(0, idx);
    // "data: x" and "data:x" both mean x
    const value = idx === -1 ? "" : line.slice(idx + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length && event === null) return null;
  return { event, data: data.join("\n") };
}

/**
 * A frame becomes a typed event, or `null` when it carries nothing we understand
 * (a keep-alive, a `[DONE]` sentinel, or a payload from a newer server).
 */
export function toChatEvent(frame: SseFrame): ChatEvent | null {
  const raw = frame.data.trim();
  if (!raw || raw === "[DONE]") return frame.event === "done" ? { type: "done" } : null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // a bare `data:` line under `event: token` is still a usable delta
    return frame.event === "token" ? { type: "token", text: frame.data } : null;
  }
  const type = String(body.type ?? frame.event ?? "");
  switch (type) {
    case "token": {
      const text = typeof body.text === "string" ? body.text : typeof body.delta === "string" ? body.delta : "";
      return text ? { type: "token", text } : null;
    }
    case "tool":
      return { type: "tool", name: String(body.name ?? ""), args: (body.args as Record<string, unknown>) ?? undefined };
    case "card":
      return { type: "card", kind: String(body.kind ?? "unknown"), payload: body.payload ?? null };
    case "done":
      return { type: "done", usage: (body.usage as ChatUsage | undefined) ?? null, costUsd: typeof body.costUsd === "number" ? body.costUsd : null };
    case "error":
      return { type: "error", code: String(body.code ?? "ASSISTANT_UPSTREAM"), message: String(body.message ?? "") };
    default:
      return null;
  }
}

/** Convenience for the tests and the client: whole text → events. */
export function decodeChatStream(text: string): ChatEvent[] {
  const dec = new SseDecoder();
  const frames = [...dec.push(text), ...dec.flush()];
  return frames.map(toChatEvent).filter((e): e is ChatEvent => e !== null);
}
