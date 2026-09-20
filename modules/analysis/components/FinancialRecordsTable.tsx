import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import { STATEMENT_CATEGORY_LABELS } from "@/modules/analysis/lib/statementCategoryLabels";

interface FinancialRecordsTableProps {
  records: readonly NormalizedFinancialRecord[];
}

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 20/45. Antes desta missão, `${amount} ${currency}`
 * concatenava o número bruto do JavaScript (sem separador de milhar,
 * ponto em vez de vírgula decimal) com o CÓDIGO ISO da moeda (`"80000.5
 * BRL"`) — nunca a formatação `pt-BR` já usada em todo o resto do
 * produto (`lib/format-indicator.ts`, `SourceDetailsSheet.tsx`).
 * `style: "currency"` já devolve o símbolo correto (`R$`) a partir do
 * código ISO do próprio registro — nunca hardcoded, ao contrário de
 * `formatIndicatorValue()` (que sempre assume `R$` porque `Indicator`
 * não carrega `currency` por linha).
 */
function formatMoney(amount: number | undefined, currency: string | undefined) {
  if (amount === undefined) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(amount);
}

/**
 * Mission 194, Seção 33/45. `record.occurredAt` só existe para
 * `kind === "event"` (uma transação datada) — um `Resource` (Balanço)
 * usa `asOfDate` (D-111) e uma `StatementLine` (DRE) usa `period`
 * (D-106); nenhum dos dois é `occurredAt`, então a coluna "Quando"
 * mostrava "—" para toda linha de Balanço/DRE antes desta correção,
 * como se a data fosse genuinamente desconhecida em vez de
 * simplesmente representada por um campo diferente.
 */
function formatWhen(record: NormalizedFinancialRecord): string {
  if (record.occurredAt) return record.occurredAt;
  if (record.asOfDate) return `Data-base: ${record.asOfDate}`;
  if (record.period) return `Período: ${record.period.startDate} a ${record.period.endDate}`;
  return "—";
}

/**
 * Mission 194, Seção 20/45. `record.resourceType`/`record.eventType`
 * nunca existem para `kind === "statement_line"` (o campo próprio é
 * `statementCategory`) — a coluna "Tipo" mostrava "—" para toda linha
 * de DRE antes desta correção, tornando invisível se uma linha era
 * Receita, Custo, Despesa etc. `STATEMENT_CATEGORY_LABELS` traduz o
 * vocabulário técnico fechado (`StatementCategory`) para rótulo
 * executivo — mesmo princípio de `DOCUMENT_GOVERNANCE_LABELS`
 * (`documentGovernance.ts`), nunca o nome literal do enum.
 */
function formatType(record: NormalizedFinancialRecord): string {
  if (record.resourceType) return record.resourceType;
  if (record.eventType) return record.eventType;
  if (record.statementCategory) return STATEMENT_CATEGORY_LABELS[record.statementCategory];
  return "—";
}

// Tabela de registros financeiros — apresenta exatamente os campos
// de `NormalizedFinancialRecord` (Data Engine), nenhum somatorio,
// media ou reclassificacao feita aqui. `isTotalLine` (D-106, Seção 32
// da Mission 192) apenas recebe destaque visual (negrito) quando o
// próprio documento já declarou a linha como um total/subtotal —
// nenhum total é calculado ou inferido aqui (Mission 194, Seção 10:
// nunca apresentar um valor derivado como se fosse a mesma coisa que
// um valor bruto, e vice-versa — aqui o sinal já vem pronto do
// documento de origem, apenas destacado).
export function FinancialRecordsTable({ records }: FinancialRecordsTableProps) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum registro nesta seção.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Registro</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead>Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.recordId}>
              <TableCell className={cn(record.isTotalLine && "font-semibold")}>
                {record.label}
                {record.isTotalLine && (
                  <Badge variant="outline" className="ml-2 align-middle text-xs font-normal">
                    Total do documento
                  </Badge>
                )}
              </TableCell>
              <TableCell className={cn(record.isTotalLine && "font-semibold")}>
                {formatMoney(record.amount, record.currency)}
              </TableCell>
              <TableCell>{formatWhen(record)}</TableCell>
              <TableCell>{formatType(record)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
