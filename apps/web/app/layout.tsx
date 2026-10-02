import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const displayFont = Playfair_Display({
  preload: false,
  subsets: ["latin"],
  variable: "--display-font",
});

const bodyFont = Plus_Jakarta_Sans({
  preload: false,
  subsets: ["latin"],
  variable: "--body-font",
});

export const metadata: Metadata = {
  title: "Make My Resume",
  description:
    "Tailor your resume to every job with evidence-backed AI suggestions—without inventing experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  );
}
