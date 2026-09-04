"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { QrCode } from "./QrCode";
import { Button, Icon } from "./primitives";

/**
 * Station/route QR (TransMi App's `?estacion=` links, done with canonical HTTPS URLs).
 * Collapsed by default; prints just the code and the title.
 */
export function QrPanel({ path, title }: { path: string; title: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="rounded-card border border-line bg-paper-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <Icon.Qr width={16} height={16} /> {t.qr.title}
        </span>
        <Icon.Chevron width={16} height={16} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && url ? (
        <div className="print-qr flex flex-col items-center gap-3 border-t border-line px-3 py-3">
          <QrCode value={url} size={168} label={title} />
          <p className="print-title hidden text-center text-lg font-extrabold">{title}</p>
          <p className="max-w-xs text-center text-xs text-ink-3">{t.qr.hint}</p>
          <p className="max-w-full truncate text-center text-[11px] text-ink-3">{url}</p>
          <div className="flex gap-2 print:hidden">
            <Button size="sm" onClick={copy}>
              {copied ? t.qr.copied : t.qr.copy}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              {t.qr.print}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
