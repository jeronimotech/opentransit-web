/**
 * First-party analytics core (v1.5) — pure logic, no browser globals, unit-tested.
 *
 * Privacy rules live here so every caller inherits them: coordinates are coarsened to
 * 3 decimals (≈110 m) before an event is even queued, free text never enters the
 * queue, ids are random and short-lived, and an opt-out empties the queue.
 */
import type { AnalyticsBatch, AnalyticsEvent, AnalyticsEventType, AnalyticsPlatform, AnalyticsProps } from "@/lib/api/types";

export const MAX_BATCH = 50;
export const FLUSH_EVERY_MS = 30_000;
export const FLUSH_AT = 20;
export const DROP_AFTER_MS = 24 * 60 * 60 * 1000;
export const COHORT_ROTATION_MS = 30 * 24 * 60 * 60 * 1000;

/** ≈110 m: enough for mobility analysis, useless for identifying a home. */
export function coarsen(v: number): number {
  return Math.round(v * 1000) / 1000;
}

const COORD_KEYS = new Set(["lat", "lon", "fromLat", "fromLon", "toLat", "toLon"]);
/** Props that could carry free text; they are only allowed for stop/POI style labels and are truncated. */
const LABEL_KEYS = new Set(["label"]);
const MAX_LABEL = 80;
const MAX_LIST = 20;

/** Coarsen coordinates, cap labels, drop undefined/functions, bound lists. Never throws. */
export function sanitizeProps(props: AnalyticsProps | undefined): AnalyticsProps {
  const out: AnalyticsProps = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (COORD_KEYS.has(k) && typeof v === "number") {
      if (Number.isFinite(v)) out[k] = coarsen(v);
      continue;
    }
    if (LABEL_KEYS.has(k) && typeof v === "string") {
      out[k] = v.slice(0, MAX_LABEL);
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.filter((x): x is string => typeof x === "string").slice(0, MAX_LIST);
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = typeof v === "string" ? v.slice(0, 120) : v;
  }
  return out;
}

export function makeEvent(type: AnalyticsEventType, props: AnalyticsProps | undefined, now: Date = new Date()): AnalyticsEvent {
  return { type, at: now.toISOString(), props: sanitizeProps(props) };
}

/** Random, unguessable, not derived from anything about the device. */
export function randomId(rng: () => number = Math.random): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 22; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
}

export type CohortState = { id: string; issuedAt: number };

/** A cohort id lives 30 days at most; after that a fresh one, unlinkable to the old. */
export function rotateCohort(state: CohortState | null, now: number, rng: () => number = Math.random): CohortState {
  if (state && Number.isFinite(state.issuedAt) && now - state.issuedAt < COHORT_ROTATION_MS && state.id) return state;
  return { id: randomId(rng), issuedAt: now };
}

export type Queued = AnalyticsEvent & { enqueuedAt: number };

/** Drop events older than 24 h (offline for a day → they no longer matter). */
export function pruneQueue(queue: Queued[], now: number): Queued[] {
  return queue.filter((e) => now - e.enqueuedAt < DROP_AFTER_MS);
}

export function shouldFlush(queue: Queued[], lastFlushAt: number, now: number, reason: "timer" | "size" | "hide" | "manual"): boolean {
  if (!queue.length) return false;
  if (reason === "hide" || reason === "manual") return true;
  if (reason === "size") return queue.length >= FLUSH_AT;
  return now - lastFlushAt >= FLUSH_EVERY_MS;
}

export function buildBatch(
  queue: Queued[],
  ids: { sessionId: string; cohortId: string },
  meta: { platform: AnalyticsPlatform; appVersion: string; locale: string },
  now: Date = new Date(),
): { batch: AnalyticsBatch; rest: Queued[] } {
  const take = queue.slice(0, MAX_BATCH);
  return {
    batch: {
      sessionId: ids.sessionId,
      cohortId: ids.cohortId,
      platform: meta.platform,
      appVersion: meta.appVersion,
      locale: meta.locale,
      sentAt: now.toISOString(),
      events: take.map(({ type, at, props }) => ({ type, at, props })),
    },
    rest: queue.slice(MAX_BATCH),
  };
}

/** Do Not Track / Global Privacy Control → default OFF (the person can still turn it on). */
export function defaultOptIn(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | null | undefined): boolean {
  if (!nav) return true;
  if (nav.doNotTrack === "1") return false;
  if (nav.globalPrivacyControl === true) return false;
  return true;
}
