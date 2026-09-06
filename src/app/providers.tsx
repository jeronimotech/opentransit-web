"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { I18nProvider } from "@/lib/i18n/provider";
import { ThemeProvider } from "@/lib/theme";
import { retryPolicy } from "@/lib/api/hooks";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: retryPolicy, staleTime: 30_000 },
        },
      }),
  );
  useEffect(() => {
    const nav = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    track("app_open", { coldStart: nav !== "back_forward", entry: window.location.search.includes("from=") ? "deeplink" : "home" });
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
