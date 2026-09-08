import type { AssistantPublic, City } from "./api/types";

/**
 * What this deployment actually does with data, derived from the city's own config.
 *
 * Both app stores require a privacy policy describing *this* app. Bogotá's
 * `links.privacy` points at the transit agency's own policy, which says nothing about
 * our analytics, our assistant or our location handling, so it cannot serve as ours.
 *
 * Everything here is derived rather than written down a second time: a city that turns
 * analytics off, or runs the assistant on another provider, gets a policy that says so.
 * A policy describing a build other than the one you are running is worse than none.
 */
export type PrivacyFacts = {
  analyticsEnabled: boolean;
  /** Days a coarsened event is kept before deletion. */
  retentionDays: number | null;
  /** Smallest group an aggregate is ever shown for. */
  kThreshold: number | null;
  assistantEnabled: boolean;
  /** Named, because a question leaves our servers for them. */
  assistantProvider: string | null;
  /** Host serving map tiles: it sees the reader's IP address, and we do not control it. */
  tileHost: string | null;
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  gemini: "Google (Gemini)",
};

export function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** A provider id as a person reads it, so the policy can name who receives a question. */
export function providerLabel(a?: AssistantPublic | null): string | null {
  if (!a) return null;
  if (a.providerName) return a.providerName;
  return PROVIDER_NAMES[a.provider] ?? a.provider ?? null;
}

export function privacyFacts(city: City, tileStyleUrl?: string | null): PrivacyFacts {
  const analytics = city.config?.analytics ?? null;
  // The public city sends the reduced assistant shape; the admin one carries more.
  const assistant = (city.config?.assistant ?? null) as AssistantPublic | null;
  return {
    analyticsEnabled: analytics?.enabled === true,
    retentionDays: analytics?.retentionDays ?? null,
    kThreshold: analytics?.kThreshold ?? null,
    assistantEnabled: assistant?.enabled === true,
    assistantProvider: assistant?.enabled === true ? providerLabel(assistant) : null,
    tileHost: hostOf(tileStyleUrl),
  };
}
