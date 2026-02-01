"use client";

import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <head>
        <title>LocalChat</title>
        <meta name="description" content="A clean, minimalistic AI chat application" />
      </head>
      <body
        className={`${figtree.variable} ${geistMono.variable} antialiased font-sans`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {children}
      </body>
    </html>
  );
}
