import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ADMIN_ENABLED } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** `NEXT_PUBLIC_ADMIN_ENABLED=0` removes the whole section (404) for deployments that don't want it. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!ADMIN_ENABLED) notFound();
  return children;
}
