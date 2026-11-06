import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `${APP_NAME}: the app` };
export default function AppLayout({ children }: { children: ReactNode }) { return children; }
