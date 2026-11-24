import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Lab",
  description: "Earn your belts, one lesson at a time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
