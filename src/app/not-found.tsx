import Link from "next/link";
import { Wordmark } from "@/components/shell/CityHeader";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <Link href="/">
        <Wordmark className="text-lg" />
      </Link>
      <h1 className="mt-16 text-3xl font-extrabold tracking-tight">404</h1>
      <p className="mt-2 text-ink-2">Esta página no existe. / This page does not exist.</p>
      <Link href="/" className="mt-4 font-semibold text-signal">
        opentransit
      </Link>
    </main>
  );
}
