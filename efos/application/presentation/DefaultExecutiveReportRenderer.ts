import type { Indicator } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

import type { ExecutiveReport } from "../report";
import type { ExecutiveReportSection } from "../report";

import type { ExecutiveReportRenderer } from "./ExecutiveReportRenderer";

/**
 * Escapa uma célula de tabela Markdown — troca `|` (que fecharia a
 * coluna prematuramente) por `\|`, e qualquer quebra de linha por um
 * espaço (uma célula de tabela Markdown não pode conter linha nova).
 * Não é sanitização de segurança (Markdown não executa como código);
 * é apenas o mínimo necessário para a tabela permanecer bem formada
 * mesmo que um `label`/`title`/`description` já existente contenha
 * esses caracteres. Nenhum dado é alterado — apenas a representação
 * textual dentro da tabela.
 */
function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatOptional(value: string | undefined): string {
  return value !== undefined ? escapeMarkdownCell(value) : "—";
}

function formatMoney(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined) {
    return "—";
  }
  return currency ? `${amount} ${currency}` : `${amount}`;
}

function renderIndicatorsTable(indicators: readonly Indicator[]): string {
  if (indicators.length === 0) {
    return "_Nenhum indicador nesta seção._";
  }

  const header = "| Nome | Categoria | Valor | Unidade | Fórmula |\n|---|---|---|---|---|";
  const rows = indicators.map((indicator) => {
    const value =
      indicator.result.status === "available"
        ? indicator.result.value
        : "Não disponível";
    return `| ${escapeMarkdownCell(indicator.name)} | ${escapeMarkdownCell(indicator.category)} | ${value} | ${escapeMarkdownCell(indicator.unit)} | ${escapeMarkdownCell(indicator.formula)} |`;
  });

  return [header, ...rows].join("\n");
}

function renderRecordsTable(records: readonly NormalizedFinancialRecord[]): string {
  if (records.length === 0) {
    return "_Nenhum registro nesta seção._";
  }

  const header =
    "| Registro | Valor | Data | Tipo |\n|---|---|---|---|";
  const rows = records.map((record) => {
    const type = record.resourceType ?? record.eventType ?? "—";
    return `| ${escapeMarkdownCell(record.label)} | ${formatMoney(record.amount, record.currency)} | ${formatOptional(record.occurredAt)} | ${escapeMarkdownCell(type)} |`;
  });

  return [header, ...rows].join("\n");
}

function renderSection(section: ExecutiveReportSection): string {
  const heading = `## ${section.title}`;

  switch (section.type) {
    case "financialHealth":
      return `${heading}\n\n${renderIndicatorsTable(section.financialHealth)}`;
    case "financialRisk":
      return `${heading}\n\n${renderIndicatorsTable(section.financialRisk)}`;
    case "kpi":
      return `${heading}\n\n${renderIndicatorsTable(section.kpi)}`;
    case "balanceSheet":
      return `${heading}\n\n${renderRecordsTable(section.balanceSheet)}`;
    case "incomeStatement":
      return `${heading}\n\n${renderRecordsTable(section.incomeStatement)}`;
    case "cashFlow":
      return `${heading}\n\n${renderRecordsTable(section.cashFlow)}`;
    case "indicators":
      return `${heading}\n\n${renderIndicatorsTable(section.indicators.indicators)}`;
    case "evidence": {
      const evidences = section.evidence.evidences;
      if (evidences.length === 0) {
        return `${heading}\n\n_Nenhuma evidência nesta seção._`;
      }
      const header = "| Título | Severidade | Confiança | Descrição |\n|---|---|---|---|";
      const rows = evidences.map(
        (evidence) =>
          `| ${escapeMarkdownCell(evidence.title)} | ${escapeMarkdownCell(evidence.severity)} | ${escapeMarkdownCell(evidence.confidence)} | ${escapeMarkdownCell(evidence.description)} |`
      );
      return `${heading}\n\n${[header, ...rows].join("\n")}`;
    }
    case "context": {
      const contexts = section.context.contexts;
      if (contexts.length === 0) {
        return `${heading}\n\n_Nenhum contexto nesta seção._`;
      }
      const header = "| Título | Severidade | Confiança | Descrição |\n|---|---|---|---|";
      const rows = contexts.map(
        (context) =>
          `| ${escapeMarkdownCell(context.title)} | ${escapeMarkdownCell(context.severity)} | ${escapeMarkdownCell(context.confidence)} | ${escapeMarkdownCell(context.description)} |`
      );
      return `${heading}\n\n${[header, ...rows].join("\n")}`;
    }
    case "reasoning": {
      const reasonings = section.reasoning.reasonings;
      if (reasonings.length === 0) {
        return `${heading}\n\n_Nenhum raciocínio nesta seção._`;
      }
      const header = "| Título | Confiança | Descrição |\n|---|---|---|";
      const rows = reasonings.map(
        (reasoning) =>
          `| ${escapeMarkdownCell(reasoning.title)} | ${escapeMarkdownCell(reasoning.confidence)} | ${escapeMarkdownCell(reasoning.description)} |`
      );
      return `${heading}\n\n${[header, ...rows].join("\n")}`;
    }
    case "recommendation": {
      const recommendations = section.recommendation.recommendations;
      if (recommendations.length === 0) {
        return `${heading}\n\n_Nenhuma recomendação nesta seção._`;
      }
      const header =
        "| Título | Prioridade | Confiança | Descrição | Impacto Esperado |\n|---|---|---|---|---|";
      const rows = recommendations.map(
        (recommendation) =>
          `| ${escapeMarkdownCell(recommendation.title)} | ${escapeMarkdownCell(recommendation.priority)} | ${escapeMarkdownCell(recommendation.confidence)} | ${escapeMarkdownCell(recommendation.description)} | ${escapeMarkdownCell(recommendation.expectedImpact)} |`
      );
      return `${heading}\n\n${[header, ...rows].join("\n")}`;
    }
    case "decision": {
      const decisions = section.decision.decisions;
      if (decisions.length === 0) {
        return `${heading}\n\n_Nenhuma decisão nesta seção._`;
      }
      const header =
        "| Título | Prioridade | Confiança | Descrição | Racional |\n|---|---|---|---|---|";
      const rows = decisions.map(
        (decision) =>
          `| ${escapeMarkdownCell(decision.title)} | ${escapeMarkdownCell(decision.priority)} | ${escapeMarkdownCell(decision.confidence)} | ${escapeMarkdownCell(decision.description)} | ${escapeMarkdownCell(decision.rationale)} |`
      );
      return `${heading}\n\n${[header, ...rows].join("\n")}`;
    }
  }
}

/**
 * Primeira implementação concreta de `ExecutiveReportRenderer`
 * (Mission 078 — Executive Report Presentation Layer). Produz
 * Markdown — puro, síncrono, determinístico. Nunca modifica o
 * `ExecutiveReport` recebido (cada valor lido é apenas formatado como
 * texto, nunca copiado/mutado); nenhuma seção é inventada — `render()`
 * itera exatamente `report.sections`, na ordem em que já chegam
 * (a ordem executiva determinística da Mission 065), nunca reordena,
 * nunca insere uma seção que não esteja presente.
 */
export class DefaultExecutiveReportRenderer implements ExecutiveReportRenderer {
  render(report: ExecutiveReport): string {
    const lines: string[] = [];

    lines.push(`# Relatório Executivo — ${report.metadata.companyId}`);
    lines.push("");
    lines.push(`**Execução:** ${report.metadata.executionId}`);
    lines.push(`**Modelo Financeiro:** ${formatOptional(report.metadata.financialModelId)}`);
    lines.push(`**Gerado em:** ${report.metadata.generatedAt}`);
    lines.push("");
    lines.push("## Resumo");
    lines.push("");
    lines.push(`- Indicadores: ${report.summary.indicatorsCount}`);
    lines.push(`- Evidências: ${report.summary.evidenceCount}`);
    lines.push(`- Contextos: ${report.summary.contextCount}`);
    lines.push(`- Raciocínios: ${report.summary.reasoningCount}`);
    lines.push(`- Recomendações: ${report.summary.recommendationCount}`);
    lines.push(`- Decisões: ${report.summary.decisionCount}`);

    for (const section of report.sections) {
      lines.push("");
      lines.push(renderSection(section));
    }

    return lines.join("\n");
  }
}
