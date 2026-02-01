"use client";

import { Geist, Geist_Mono, Raleway } from "next/font/google";
import "./globals.css";

const raleway = Raleway({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="en" className={raleway.variable}>
      <head>
        <title>LocalChat</title>
        <meta name="description" content="A clean, minimalistic AI chat application" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {children}
      </body>
    </html>
  );
}
