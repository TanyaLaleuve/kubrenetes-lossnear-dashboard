import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { getSiteTheme } from "@/lib/theme-server";
import { themeStyle } from "@/lib/theme";
import "./globals.css";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Lossnear — Kubernetes",
    template: "%s · Lossnear K8s",
  },
  description: "Dashboard d'administration du cluster Kubernetes lossnear",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Palette globale choisie en administration, posée en variables CSS sur
  // <html> au rendu serveur : appliquée à tout le monde, sans flash ni JS.
  const themeVars = themeStyle(await getSiteTheme()) as CSSProperties;

  return (
    <html
      lang="fr"
      style={themeVars}
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
