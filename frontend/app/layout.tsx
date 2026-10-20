import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebGuard — Security & UX Auditor",
  description: "Scan any website for security vulnerabilities and UX issues in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
