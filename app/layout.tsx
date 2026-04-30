import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Simple invoices page backed by Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
