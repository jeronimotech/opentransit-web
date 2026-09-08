import type { Metadata } from "next";
import { SharedEtaView } from "@/components/share/SharedEtaView";

type Props = { params: Promise<{ city: string; token: string }> };

/**
 * A shared trip is a private link between two people: it must never be indexed,
 * and it carries no title that would leak the destination into a search engine.
 */
export const metadata: Metadata = {
  // `absolute` skips the root layout's "%s · opentransit" template, which turned this
  // into "opentransit · opentransit" in the tab and in any link preview.
  title: { absolute: "opentransit" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedEtaPage({ params }: Props) {
  const { city, token } = await params;
  return <SharedEtaView city={decodeURIComponent(city)} token={decodeURIComponent(token)} />;
}
