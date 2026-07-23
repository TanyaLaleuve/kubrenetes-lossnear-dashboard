import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Applique la palette enregistrée avant le premier rendu, pour éviter
            un flash de la couleur par défaut. Doit rester synchro avec
            THEME_TOKENS / THEME_STORAGE_KEY (lib/theme.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem('lossnear:theme')||'{}');var k=['background','foreground','card','card-hover','muted','muted-foreground','border','accent','accent-foreground','warning','destructive','info'];for(var i=0;i<k.length;i++){var v=t[k[i]];if(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))document.documentElement.style.setProperty('--'+k[i],v);}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
