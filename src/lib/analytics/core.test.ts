import { describe, expect, it } from "vitest";
import { buildBatch, coarsen, defaultOptIn, makeEvent, pruneQueue, randomId, rotateCohort, sanitizeProps, shouldFlush, FLUSH_AT, FLUSH_EVERY_MS, MAX_BATCH, type Queued } from "./core";

const q = (n: number, enqueuedAt = Date.now()): Queued[] => Array.from({ length: n }, (_, i) => ({ type: "screen_view" as const, at: new Date().toISOString(), props: { screen: `s${i}` }, enqueuedAt }));

describe("analytics core", () => {
  it("coarsens coordinates to ~110 m and never stores raw ones", () => {
    expect(coarsen(4.7546123)).toBe(4.755);
    const p = sanitizeProps({ fromLat: 4.7546123, fromLon: -74.0459876, lat: 4.65, note: "x" });
    expect(p.fromLat).toBe(4.755);
    expect(p.fromLon).toBe(-74.046);
    expect(p.lat).toBe(4.65);
  });

  it("drops null/undefined, bounds labels and lists", () => {
    const p = sanitizeProps({ a: undefined, b: null, label: "x".repeat(200), modes: Array.from({ length: 30 }, (_, i) => `m${i}`) });
    expect("a" in p).toBe(false);
    expect("b" in p).toBe(false);
    expect((p.label as string).length).toBe(80);
    expect((p.modes as string[]).length).toBe(20);
  });

  it("makes an ISO-stamped event", () => {
    const e = makeEvent("plan_request", { fromLat: 1.23456 }, new Date("2026-09-06T10:00:00Z"));
    expect(e.at).toBe("2026-09-06T10:00:00.000Z");
    expect(e.props.fromLat).toBe(1.235);
  });

  it("rotates the cohort id after 30 days and keeps it before", () => {
    const now = Date.parse("2026-09-06T00:00:00Z");
    const c = rotateCohort(null, now, () => 0.5);
    expect(c.id).toHaveLength(22);
    expect(rotateCohort(c, now + 29 * 86_400_000)).toBe(c);
    const later = rotateCohort(c, now + 31 * 86_400_000, () => 0.1);
    expect(later.id).not.toBe(c.id);
  });

  it("random ids are 22 chars from a safe alphabet", () => {
    expect(randomId()).toMatch(/^[a-z0-9]{22}$/);
  });

  it("prunes events older than 24 h", () => {
    const now = Date.now();
    const kept = pruneQueue([...q(2, now - 1000), ...q(1, now - 25 * 3_600_000)], now);
    expect(kept).toHaveLength(2);
  });

  it("flush rules: size at 20, timer at 30 s, hide/manual immediately", () => {
    const now = Date.now();
    expect(shouldFlush([], 0, now, "manual")).toBe(false);
    expect(shouldFlush(q(FLUSH_AT - 1), now, now, "size")).toBe(false);
    expect(shouldFlush(q(FLUSH_AT), now, now, "size")).toBe(true);
    expect(shouldFlush(q(1), now - FLUSH_EVERY_MS + 1, now, "timer")).toBe(false);
    expect(shouldFlush(q(1), now - FLUSH_EVERY_MS, now, "timer")).toBe(true);
    expect(shouldFlush(q(1), now, now, "hide")).toBe(true);
  });

  it("batches at most 50 events and leaves the rest queued", () => {
    const { batch, rest } = buildBatch(q(60), { sessionId: "s", cohortId: "c" }, { platform: "web", appVersion: "1", locale: "es" });
    expect(batch.events).toHaveLength(MAX_BATCH);
    expect(rest).toHaveLength(10);
    expect("enqueuedAt" in batch.events[0]).toBe(false);
  });

  it("defaults OFF under Do Not Track or Global Privacy Control", () => {
    expect(defaultOptIn(null)).toBe(true);
    expect(defaultOptIn({ doNotTrack: "1" })).toBe(false);
    expect(defaultOptIn({ globalPrivacyControl: true })).toBe(false);
    expect(defaultOptIn({ doNotTrack: "0" })).toBe(true);
  });
});
