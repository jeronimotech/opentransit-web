"use client";

import { useEffect, useState } from "react";

/**
 * Connectivity as a boolean. Starts optimistic so the server render and the first
 * client render agree; `navigator.onLine` is read in the effect.
 *
 * The assistant uses this to hide its entry point: the answers come from the API,
 * so offering the chat with no network would only produce an error sheet.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const off = () => setOnline(false);
    const on = () => setOnline(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  return online;
}
