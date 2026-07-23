import { ThemeCustomizer } from "@/components/ThemeCustomizer";

export const metadata = { title: "Apparence" };

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Apparence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis une palette ou ajuste chaque couleur : le site change en
          direct. Ta préférence est gardée sur cet appareil (rien n&apos;est
          partagé avec les autres). « Réinitialiser » remet le thème par défaut.
        </p>
      </header>

      <ThemeCustomizer />
    </div>
  );
}
