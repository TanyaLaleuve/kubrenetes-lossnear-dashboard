/**
 * En-tête commun à toutes les pages d'un serveur : même hauteur et même
 * alignement partout pour que le bandeau ServerNav ne bouge jamais.
 */
export function ServerHeader({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle: string;
  /** Contenu aligné à droite (badge de statut par ex.). */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-mono text-lg font-semibold">{name}</h1>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}
