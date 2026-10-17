import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margin — Your annotation workspace",
  description: "Keep your PDFs, create digital or personal handwritten notes, and review every detail before exporting.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
