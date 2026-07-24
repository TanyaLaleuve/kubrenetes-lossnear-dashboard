import {
  Archive,
  FileText,
  Play,
  Power,
  RotateCw,
  Settings,
  Skull,
  Terminal,
  Trash2,
  Upload,
  Users,
  Download,
  CalendarClock,
  ScrollText,
} from "lucide-react";
import type { ActivityEntry } from "@/lib/servers/activity";
import { formatAge } from "@/lib/k8s/format";

/** Icône + libellé lisible par clé d'action. */
const ACTION_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  "server.start": { icon: Play, label: "Démarrage" },
  "server.stop": { icon: Power, label: "Arrêt" },
  "server.restart": { icon: RotateCw, label: "Redémarrage" },
  "server.kill": { icon: Skull, label: "Kill" },
  "console.command": { icon: Terminal, label: "Commande console" },
  "file.upload": { icon: Upload, label: "Envoi de fichier" },
  "file.download": { icon: Download, label: "Téléchargement" },
  "file.write": { icon: FileText, label: "Modification de fichier" },
  "file.delete": { icon: Trash2, label: "Suppression" },
  "file.mkdir": { icon: FileText, label: "Création de dossier" },
  "file.rename": { icon: FileText, label: "Renommage" },
  "file.compress": { icon: Archive, label: "Compression" },
  "file.extract": { icon: Archive, label: "Extraction" },
  "settings.update": { icon: Settings, label: "Paramètres" },
  "startup.update": { icon: Settings, label: "Démarrage (config)" },
  "member.add": { icon: Users, label: "Membre ajouté" },
  "member.update": { icon: Users, label: "Permissions modifiées" },
  "member.remove": { icon: Users, label: "Membre retiré" },
  "backup.create": { icon: Archive, label: "Sauvegarde créée" },
  "backup.restore": { icon: Archive, label: "Restauration" },
  "backup.delete": { icon: Archive, label: "Sauvegarde supprimée" },
  "schedule.run": { icon: CalendarClock, label: "Planificateur" },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { icon: ScrollText, label: action };
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucune activité pour l&apos;instant.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((e) => {
        const { icon: Icon, label } = metaFor(e.action);
        const system = e.userId === null;
        return (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
          >
            <span
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                system ? "bg-info/10 text-info" : "bg-accent/10 text-accent"
              }`}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{e.actorName}</span>{" "}
                <span className="text-muted-foreground">{label.toLowerCase()}</span>
              </p>
              {e.detail && (
                <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
              )}
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground"
              dateTime={e.createdAt.toISOString()}
              title={e.createdAt.toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            >
              {formatAge(e.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
