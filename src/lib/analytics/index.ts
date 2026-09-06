"use client";

/**
 * Analytics service for the browser: a local queue (localStorage), batched flushes,
 * a per-tab session id, a 30-day cohort id, and a user opt-out that discards everything.
 * Every public function swallows its own errors — analytics must never break the app.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { AnalyticsEventType, AnalyticsProps } from "@/lib/api/types";
import { buildBatch, defaultOptIn, makeEvent, pruneQueue, randomId, rotateCohort, shouldFlush, type CohortState, type Queued } from "./core";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "web";
const K_QUEUE = "opentransit.analytics.queue";
const K_COHORT = "opentransit.analytics.cohort";
const K_OPT = "opentransit.analytics.optin";
const K_SESSION = "opentransit.analytics.session";

type State = { city: string | null; queue: Queued[]; lastFlushAt: number; sessionId: string; cohort: CohortState | null; optIn: boolean; flushing: boolean };

const listeners = new Set<() => void>();
let state: State | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function load(): State {
  if (state) return state;
  const optRaw = safe(() => localStorage.getItem(K_OPT), null);
  const optIn = optRaw === null ? defaultOptIn(typeof navigator !== "undefined" ? (navigator as Navigator & { globalPrivacyControl?: boolean }) : null) : optRaw === "1";
  const queue = safe<Queued[]>(() => JSON.parse(localStorage.getItem(K_QUEUE) ?? "[]") as Queued[], []);
  const cohort = safe<CohortState | null>(() => JSON.parse(localStorage.getItem(K_COHORT) ?? "null") as CohortState | null, null);
  let sessionId = safe(() => sessionStorage.getItem(K_SESSION), null);
  if (!sessionId) {
    sessionId = randomId();
    safe(() => sessionStorage.setItem(K_SESSION, sessionId!), undefined);
  }
  state = { city: null, queue: pruneQueue(Array.isArray(queue) ? queue : [], Date.now()), lastFlushAt: Date.now(), sessionId, cohort, optIn, flushing: false };
  return state;
}

function persist() {
  if (!state) return;
  safe(() => localStorage.setItem(K_QUEUE, JSON.stringify(state!.queue.slice(-500))), undefined);
  if (state.cohort) safe(() => localStorage.setItem(K_COHORT, JSON.stringify(state!.cohort)), undefined);
  for (const l of listeners) l();
}

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => void flush("timer"), 5_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush("hide");
  });
}

/** Bind the service to the city whose API receives the events. */
export function setAnalyticsCity(city: string | null) {
  const s = load();
  s.city = city;
  ensureTimer();
}

export function track(type: AnalyticsEventType, props?: AnalyticsProps) {
  try {
    const s = load();
    if (!s.optIn) return;
    const ev = makeEvent(type, props);
    s.queue.push({ ...ev, enqueuedAt: Date.now() });
    persist();
    if (shouldFlush(s.queue, s.lastFlushAt, Date.now(), "size")) void flush("size");
  } catch {
    /* never let analytics throw into UI code */
  }
}

export async function flush(reason: "timer" | "size" | "hide" | "manual" = "manual") {
  const s = load();
  if (s.flushing || !s.city || !s.optIn) return;
  const now = Date.now();
  s.queue = pruneQueue(s.queue, now);
  if (!shouldFlush(s.queue, s.lastFlushAt, now, reason)) return;
  s.cohort = rotateCohort(s.cohort, now);
  const { batch, rest } = buildBatch(s.queue, { sessionId: s.sessionId, cohortId: s.cohort.id }, { platform: "web", appVersion: APP_VERSION, locale: safe(() => navigator.language, "es") });
  s.flushing = true;
  s.lastFlushAt = now;
  try {
    await api.events(s.city, batch);
    s.queue = rest;
  } catch {
    /* keep the queue; retry on the next tick (24 h cap prunes old ones) */
  } finally {
    s.flushing = false;
    persist();
  }
}

export function setOptIn(on: boolean) {
  const s = load();
  s.optIn = on;
  safe(() => localStorage.setItem(K_OPT, on ? "1" : "0"), undefined);
  if (!on) s.queue = [];
  persist();
}

/** "Borrar mis estadísticas": drop the local queue and rotate every id. */
export function clearAnalytics() {
  const s = load();
  s.queue = [];
  s.cohort = rotateCohort(null, Date.now());
  s.sessionId = randomId();
  safe(() => sessionStorage.setItem(K_SESSION, s.sessionId), undefined);
  safe(() => localStorage.removeItem(K_QUEUE), undefined);
  persist();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => load().optIn;

/** Settings toggle state + actions. */
export function useAnalyticsSettings() {
  const optIn = useSyncExternalStore(subscribe, snapshot, () => true);
  const queued = useSyncExternalStore(subscribe, () => load().queue.length, () => 0);
  return { optIn, queued, setOptIn, clear: clearAnalytics };
}

/** Fire one `screen_view` per screen mount and keep the service bound to the city. */
export function useScreenView(city: string | null, screen: string) {
  useEffect(() => {
    setAnalyticsCity(city);
    track("screen_view", { screen });
  }, [city, screen]);
}

/** Stable tracker for components; `track` itself is already safe to import anywhere. */
export function useTrack() {
  return useCallback((type: AnalyticsEventType, props?: AnalyticsProps) => track(type, props), []);
}
