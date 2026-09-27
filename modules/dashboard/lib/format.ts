/**
 * Datas executivas sempre no fuso de São Paulo (independente do fuso do
 * servidor), no formato curto brasileiro.
 */
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "data indisponível" : DATE_TIME.format(date).replace(/\./g, "");
}
