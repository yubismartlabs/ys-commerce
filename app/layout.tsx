import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ys-commerce | Multi-vendor marketplace",
  description: "AliExpress-style multi-vendor marketplace. Buy and sell in USD / English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-ali-bg font-sans text-neutral-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
