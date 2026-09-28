/**
 * Mission 204 — apresentação pt-BR do texto gerado pelos Engines.
 *
 * Os Engines escrevem descrições com carimbos ISO
 * ("de 2026-05-01T00:00:00.000Z a 2026-08-31T23:59:59.000Z") e números
 * com ponto decimal ("(505000.00)", "(-4.26%)"). A redação é do Engine e
 * não muda; só a FORMA de dois padrões é traduzida para leitura
 * executiva: carimbo ISO → dd/mm/aaaa; número com exatamente duas casas
 * decimais separadas por ponto → formato brasileiro. Nenhum valor é
 * recalculado, arredondado ou reinterpretado.
 */

const ISO_TIMESTAMP = /\b(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g;
const DOT_DECIMAL = /(?<![\d.,])(-?)(\d+)\.(\d{2})(?!\d)/g;

const INTEGER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatEngineText(text: string): string {
  return text
    .replace(ISO_TIMESTAMP, (_match, year: string, month: string, day: string) => `${day}/${month}/${year}`)
    .replace(DOT_DECIMAL, (_match, sign: string, integer: string, decimals: string) => {
      return `${sign}${INTEGER.format(Number(integer))},${decimals}`;
    });
}
