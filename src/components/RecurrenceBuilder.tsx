"use client";

import { useMemo, useState } from "react";

/**
 * Construit une expression cron sans que l'utilisateur ait à en écrire :
 * « toutes les X min/heures », « chaque jour à HH:MM », « certains jours à
 * HH:MM », ou cron avancé. Émet la chaîne cron via onChange.
 */
type Mode = "minutes" | "hours" | "daily" | "weekly" | "cron";

const DAYS = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mer" },
  { v: 4, l: "Jeu" },
  { v: 5, l: "Ven" },
  { v: 6, l: "Sam" },
  { v: 0, l: "Dim" },
];

/** Devine un mode + ses paramètres depuis une expression cron existante. */
function fromCron(cron: string): {
  mode: Mode;
  every: number;
  hour: number;
  minute: number;
  days: number[];
  raw: string;
} {
  const base = { mode: "daily" as Mode, every: 6, hour: 4, minute: 0, days: [1] as number[], raw: cron };
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return { ...base, mode: "cron" };
  const [m, h, dom, mon, dow] = p;
  if (dom === "*" && mon === "*") {
    if (dow === "*" && /^\*\/\d+$/.test(m) && h === "*") {
      return { ...base, mode: "minutes", every: Number(m.slice(2)) };
    }
    if (dow === "*" && /^\*\/\d+$/.test(h) && m === "0") {
      return { ...base, mode: "hours", every: Number(h.slice(2)) };
    }
    if (dow === "*" && /^\d+$/.test(h) && /^\d+$/.test(m)) {
      return { ...base, mode: "daily", hour: Number(h), minute: Number(m) };
    }
    if (dow !== "*" && /^\d+$/.test(h) && /^\d+$/.test(m)) {
      return {
        ...base,
        mode: "weekly",
        hour: Number(h),
        minute: Number(m),
        days: dow.split(",").map(Number),
      };
    }
  }
  return { ...base, mode: "cron" };
}

export function RecurrenceBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (cron: string) => void;
}) {
  const initial = useMemo(() => fromCron(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [every, setEvery] = useState(initial.every);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [days, setDays] = useState<number[]>(initial.days);
  const [raw, setRaw] = useState(initial.raw);

  function emit(next: Partial<{ mode: Mode; every: number; hour: number; minute: number; days: number[]; raw: string }>) {
    const m = next.mode ?? mode;
    const e = next.every ?? every;
    const h = next.hour ?? hour;
    const mi = next.minute ?? minute;
    const d = next.days ?? days;
    const r = next.raw ?? raw;
    let cron = r;
    if (m === "minutes") cron = `*/${Math.max(1, e)} * * * *`;
    else if (m === "hours") cron = `0 */${Math.max(1, e)} * * *`;
    else if (m === "daily") cron = `${mi} ${h} * * *`;
    else if (m === "weekly") cron = `${mi} ${h} * * ${(d.length ? d : [1]).sort((a, b) => a - b).join(",")}`;
    onChange(cron);
  }

  const timeInputs = (
    <span className="inline-flex items-center gap-1">
      à
      <input
        type="number"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => {
          const v = Math.min(23, Math.max(0, Number(e.target.value) || 0));
          setHour(v);
          emit({ hour: v });
        }}
        className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      h
      <input
        type="number"
        min={0}
        max={59}
        value={minute}
        onChange={(e) => {
          const v = Math.min(59, Math.max(0, Number(e.target.value) || 0));
          setMinute(v);
          emit({ minute: v });
        }}
        className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["minutes", "Toutes les X min"],
            ["hours", "Toutes les X h"],
            ["daily", "Chaque jour"],
            ["weekly", "Jours de semaine"],
            ["cron", "Cron avancé"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              emit({ mode: key });
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              mode === key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {mode === "minutes" && (
          <>
            Toutes les
            <input
              type="number"
              min={1}
              max={59}
              value={every}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setEvery(v);
                emit({ every: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            minutes
          </>
        )}
        {mode === "hours" && (
          <>
            Toutes les
            <input
              type="number"
              min={1}
              max={23}
              value={every}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setEvery(v);
                emit({ every: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            heures (à la minute 0)
          </>
        )}
        {mode === "daily" && <>Chaque jour {timeInputs}</>}
        {mode === "weekly" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d) => {
                const on = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => {
                      const next = on ? days.filter((x) => x !== d.v) : [...days, d.v];
                      setDays(next);
                      emit({ days: next });
                    }}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                      on
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:bg-card-hover"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
            <div>{timeInputs}</div>
          </div>
        )}
        {mode === "cron" && (
          <div className="w-full space-y-1">
            <input
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                onChange(e.target.value);
              }}
              placeholder="0 3 * * *"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
            <p className="text-[11px] text-muted-foreground">
              5 champs : minute heure jour-du-mois mois jour-semaine (0=dim).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
