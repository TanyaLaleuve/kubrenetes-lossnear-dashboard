"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  Play,
  Plus,
  Power,
  Terminal,
  Archive,
  Download,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { RecurrenceBuilder } from "@/components/RecurrenceBuilder";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  deleteScheduleAction,
  runScheduleNowAction,
  saveScheduleAction,
  toggleScheduleAction,
  type ScheduleFormState,
} from "@/lib/schedules/actions";
import { describeCron, nextRun } from "@/lib/schedules/cron";
import { formatAge } from "@/lib/k8s/format";

type TaskType = "power" | "command" | "backup" | "download";

type Task = {
  type: TaskType;
  delaySeconds: number;
  action?: string;
  command?: string;
  note?: string;
  url?: string;
  path?: string;
};

type ScheduleItem = {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  onlyWhenOnline: boolean;
  lastRunAt: Date | null;
  lastStatus: "ok" | "error" | "running" | null;
  tasks: {
    type: TaskType;
    payload: Record<string, string>;
    delaySeconds: number;
  }[];
};

const TASK_ICON: Record<TaskType, typeof Power> = {
  power: Power,
  command: Terminal,
  backup: Archive,
  download: Download,
};

export function ScheduleManager({
  serverId,
  schedules,
  canManage,
}: {
  serverId: string;
  schedules: ScheduleItem[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<ScheduleItem | "new" | null>(null);

  return (
    <div className="space-y-4">
      {canManage && editing === null && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle planification
        </button>
      )}

      {editing !== null && (
        <ScheduleForm
          serverId={serverId}
          schedule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {schedules.length === 0 && editing === null ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune tâche planifiée.
        </p>
      ) : (
        <ul className="space-y-2">
          {schedules.map((s) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              canManage={canManage}
              onEdit={() => setEditing(s)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleRow({
  schedule,
  canManage,
  onEdit,
}: {
  schedule: ScheduleItem;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [busy, start] = useTransition();
  const [feedback, setFeedback] = useState<ScheduleFormState>({});
  const next = schedule.enabled ? nextRun(schedule.cron, new Date()) : null;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock className="size-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {schedule.name}
            {schedule.lastStatus === "error" && (
              <span className="ml-2 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                dernier échec
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {describeCron(schedule.cron)}
            {next && ` · prochaine ${next.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}`}
            {schedule.lastRunAt && ` · dernière ${formatAge(schedule.lastRunAt)}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {schedule.tasks.map((t, i) => {
              const Icon = TASK_ICON[t.type];
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Icon className="size-3" aria-hidden />
                  {taskLabel(t.type, t.payload)}
                </span>
              );
            })}
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <ToggleSwitch
              checked={schedule.enabled}
              onChange={(v) => start(async () => toggleScheduleAction(schedule.id, v))}
              label=""
            />
            <button
              type="button"
              onClick={() => start(async () => setFeedback(await runScheduleNowAction(schedule.id)))}
              disabled={busy}
              aria-label="Exécuter maintenant"
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent disabled:opacity-50"
            >
              <Play className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Modifier"
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => start(async () => deleteScheduleAction(schedule.id))}
              disabled={busy}
              aria-label="Supprimer"
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>
      {feedback.error && <p className="mt-2 text-xs text-destructive">{feedback.error}</p>}
      {feedback.success && <p className="mt-2 text-xs text-success">{feedback.success}</p>}
    </li>
  );
}

function ScheduleForm({
  serverId,
  schedule,
  onClose,
}: {
  serverId: string;
  schedule: ScheduleItem | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [cron, setCron] = useState(schedule?.cron ?? "0 4 * * *");
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [onlyWhenOnline, setOnlyWhenOnline] = useState(
    schedule?.onlyWhenOnline ?? false,
  );
  const [tasks, setTasks] = useState<Task[]>(
    schedule?.tasks.map((t) => ({
      type: t.type,
      delaySeconds: t.delaySeconds,
      ...t.payload,
    })) ?? [{ type: "power", delaySeconds: 0, action: "restart" }],
  );
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next = nextRun(cron, new Date());

  function updateTask(i: number, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function save() {
    setError(null);
    start(async () => {
      const result = await saveScheduleAction({
        ...(schedule ? { id: schedule.id } : {}),
        serverId,
        name,
        cron,
        enabled,
        onlyWhenOnline,
        tasks,
      });
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-accent/30 bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {schedule ? "Modifier la planification" : "Nouvelle planification"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:bg-card-hover"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="sname" className="text-xs font-medium text-muted-foreground">
          Nom
        </label>
        <input
          id="sname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. Sauvegarde quotidienne"
          maxLength={96}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Récurrence</p>
        <RecurrenceBuilder value={cron} onChange={setCron} />
        <p className="text-[11px] text-muted-foreground">
          {next
            ? `Prochaine exécution : ${next.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })} (Europe/Paris)`
            : "Récurrence invalide."}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Tâches (dans l&apos;ordre)</p>
        {tasks.map((task, i) => (
          <TaskEditor
            key={i}
            index={i}
            task={task}
            onChange={(patch) => updateTask(i, patch)}
            onRemove={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
            onUp={i > 0 ? () => setTasks((prev) => swap(prev, i, i - 1)) : undefined}
            onDown={i < tasks.length - 1 ? () => setTasks((prev) => swap(prev, i, i + 1)) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            setTasks((prev) => [...prev, { type: "power", delaySeconds: 0, action: "restart" }])
          }
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden />
          Ajouter une tâche
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ToggleSwitch checked={enabled} onChange={setEnabled} label="Activée" />
        <ToggleSwitch
          checked={onlyWhenOnline}
          onChange={setOnlyWhenOnline}
          label="Ne pas exécuter si le serveur est éteint"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 sm:ml-auto"
        >
          {busy ? "…" : "Enregistrer"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function TaskEditor({
  index,
  task,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  index: number;
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const input =
    "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <select
          value={task.type}
          onChange={(e) => onChange({ type: e.target.value as TaskType })}
          className={input}
        >
          <option value="power">Alimentation</option>
          <option value="command">Commande console</option>
          <option value="backup">Sauvegarde</option>
          <option value="download">Télécharger un fichier</option>
        </select>

        {task.type === "power" && (
          <select
            value={task.action ?? "restart"}
            onChange={(e) => onChange({ action: e.target.value })}
            className={input}
          >
            <option value="start">Démarrer</option>
            <option value="stop">Arrêter</option>
            <option value="restart">Redémarrer</option>
            <option value="kill">Kill</option>
          </select>
        )}
        {task.type === "command" && (
          <input
            value={task.command ?? ""}
            onChange={(e) => onChange({ command: e.target.value })}
            placeholder="ex. save-all"
            className={`${input} min-w-40 flex-1`}
          />
        )}
        {task.type === "backup" && (
          <input
            value={task.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="note (optionnel)"
            className={`${input} min-w-40 flex-1`}
          />
        )}

        <div className="ml-auto flex items-center gap-1">
          {onUp && (
            <button type="button" onClick={onUp} aria-label="Monter" className="cursor-pointer rounded border border-border px-1.5 text-xs text-muted-foreground hover:text-foreground">↑</button>
          )}
          {onDown && (
            <button type="button" onClick={onDown} aria-label="Descendre" className="cursor-pointer rounded border border-border px-1.5 text-xs text-muted-foreground hover:text-foreground">↓</button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label="Retirer la tâche"
            className="grid size-7 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {task.type === "download" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={task.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…/server.jar"
            className={input}
          />
          <input
            value={task.path ?? ""}
            onChange={(e) => onChange({ path: e.target.value })}
            placeholder="destination : server.jar"
            className={input}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Délai avant cette tâche
        <input
          type="number"
          min={0}
          max={3600}
          value={task.delaySeconds}
          onChange={(e) => onChange({ delaySeconds: Number(e.target.value) || 0 })}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
        />
        secondes
      </label>
    </div>
  );
}

function taskLabel(type: TaskType, payload: Record<string, string>): string {
  switch (type) {
    case "power":
      return { start: "Démarrer", stop: "Arrêter", restart: "Redémarrer", kill: "Kill" }[payload.action ?? ""] ?? "Alimentation";
    case "command":
      return `Commande : ${payload.command ?? ""}`;
    case "backup":
      return "Sauvegarde";
    case "download":
      return `Télécharger → ${payload.path ?? ""}`;
  }
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
