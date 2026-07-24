/**
 * Cron minimal, sans dépendance. Expression 5 champs, style crontab :
 *   minute(0-59) heure(0-23) jour-du-mois(1-31) mois(1-12) jour-semaine(0-6, 0=dim)
 * Chaque champ accepte étoile, pas (étoile-slash-n), valeur, plage a-b, liste
 * a,b, ou une combinaison (ex. 1,15,30-45).
 * L'évaluation se fait dans un fuseau donné (par défaut Europe/Paris) pour que
 * « chaque jour à 3h » veuille dire 3h locales, changement d'heure inclus.
 */

export const DEFAULT_TZ = "Europe/Paris";

type Fields = [Set<number>, Set<number>, Set<number>, Set<number>, Set<number>];

const RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // heure
  [1, 31], // jour du mois
  [1, 12], // mois
  [0, 6], // jour de la semaine
];

function parseField(raw: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step < 1) throw new Error("pas invalide");
    let lo = min;
    let hi = max;
    if (rangePart !== "*") {
      const bounds = rangePart.split("-");
      lo = Number.parseInt(bounds[0], 10);
      hi = bounds[1] !== undefined ? Number.parseInt(bounds[1], 10) : lo;
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new Error("valeur invalide");
      }
    }
    for (let v = lo; v <= hi; v += step) {
      if (v < min || v > max) throw new Error("hors bornes");
      out.add(v);
    }
  }
  return out;
}

/** Analyse une expression cron ; lève si invalide. */
export function parseCron(expr: string): Fields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Le cron doit avoir 5 champs (min heure jour mois jour-semaine).");
  }
  return parts.map((p, i) => parseField(p, RANGES[i][0], RANGES[i][1])) as Fields;
}

/** Valide une expression cron (true si correcte). */
export function isValidCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}

/** Champs date/heure d'un instant dans un fuseau donné. */
function partsInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekdays: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    minute: Number(map.minute),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    dom: Number(map.day),
    month: Number(map.month),
    dow: weekdays[map.weekday] ?? 0,
  };
}

/** L'instant `date` correspond-il au cron (à la minute près), dans le fuseau ? */
export function cronMatches(expr: string, date: Date, tz = DEFAULT_TZ): boolean {
  const [min, hour, dom, month, dow] = parseCron(expr);
  const p = partsInTz(date, tz);
  // Convention crontab : si jour-du-mois ET jour-semaine sont tous deux
  // restreints, l'un OU l'autre suffit ; sinon comportement normal (ET).
  const domRestricted = dom.size !== 31;
  const dowRestricted = dow.size !== 7;
  const dayOk =
    domRestricted && dowRestricted
      ? dom.has(p.dom) || dow.has(p.dow)
      : dom.has(p.dom) && dow.has(p.dow);
  return min.has(p.minute) && hour.has(p.hour) && month.has(p.month) && dayOk;
}

/**
 * Prochaine exécution après `from` (exclu), en balayant minute par minute
 * jusqu'à un an. Renvoie null si aucune correspondance (cron impossible).
 */
export function nextRun(expr: string, from: Date, tz = DEFAULT_TZ): Date | null {
  if (!isValidCron(expr)) return null;
  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const limit = 366 * 24 * 60; // minutes dans une année
  const cursor = new Date(start.getTime());
  for (let i = 0; i < limit; i++) {
    if (cronMatches(expr, cursor, tz)) return new Date(cursor.getTime());
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

/** Décrit un cron simple en français (sinon renvoie l'expression brute). */
export function describeCron(expr: string): string {
  try {
    const parts = expr.trim().split(/\s+/);
    const [m, h, dom, mon, dow] = parts;
    if (mon !== "*" || dom !== "*") return `cron : ${expr}`;
    const at = (hh: string, mm: string) =>
      `${hh.padStart(2, "0")}h${mm.padStart(2, "0")}`;
    if (dow === "*" && /^\*\/\d+$/.test(h) && m !== "*" && !m.includes("/")) {
      return `toutes les ${h.slice(2)} h (à la minute ${m})`;
    }
    if (dow === "*" && /^\*\/\d+$/.test(m)) {
      return `toutes les ${m.slice(2)} min`;
    }
    if (dow === "*" && !h.includes("*") && !m.includes("*")) {
      return `chaque jour à ${at(h, m)}`;
    }
    if (dow !== "*" && !h.includes("*") && !m.includes("*")) {
      const names = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
      const days = dow
        .split(",")
        .map((d) => names[Number(d)] ?? d)
        .join(", ");
      return `${days} à ${at(h, m)}`;
    }
    return `cron : ${expr}`;
  } catch {
    return `cron : ${expr}`;
  }
}
