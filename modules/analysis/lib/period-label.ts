import type { Period } from "@/efos/domain";

/** Mission 204 — rótulo curto e longo de um período analisado ("ago/2026", "agosto de 2026"). */
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export interface PeriodLabel {
  /** "agosto de 2026" ou "01/08/2026 – 15/08/2026". */
  readonly long: string;
  /** "ago/2026" ou "01/08–15/08/2026". */
  readonly short: string;
}

function utcParts(iso: string) {
  const date = new Date(iso);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatPeriodLabel(period: Period): PeriodLabel {
  const start = utcParts(period.startDate);
  const end = utcParts(period.endDate);
  const lastDay = new Date(Date.UTC(end.year, end.month + 1, 0)).getUTCDate();
  if (start.year === end.year && start.month === end.month && start.day === 1 && end.day === lastDay) {
    return { long: `${MONTHS[start.month]} de ${start.year}`, short: `${MONTHS[start.month].slice(0, 3)}/${start.year}` };
  }
  const startText = `${pad(start.day)}/${pad(start.month + 1)}`;
  const endText = `${pad(end.day)}/${pad(end.month + 1)}/${end.year}`;
  return { long: `${startText}/${start.year} – ${endText}`, short: `${startText}–${endText}` };
}
