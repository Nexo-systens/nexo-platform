import {
  DefaultBalanceSheetBuilder,
  DefaultCashFlowBuilder,
  DefaultFinancialHealthBuilder,
  DefaultFinancialRiskBuilder,
  DefaultIncomeStatementBuilder,
  DefaultKPIBuilder,
} from "@/efos/engines/financial-model/builders";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

import type { PipelineExecution } from "../orchestrators";
import type {
  ExecutiveReport,
  ExecutiveReportMetadata,
  ExecutiveReportSection,
  ExecutiveReportSummary,
} from "../report";

import type { ReportService } from "./ReportService";

/**
 * Primeira implementação concreta de `ReportService` (Mission 022 —
 * Executive Report Service). Transforma um `PipelineExecution` já
 * concluído em um `ExecutiveReport` estruturado — nenhum Engine é
 * executado, nenhum Aggregate recebido é alterado, somente leitura
 * dos campos já preenchidos por `EFOSPipelineRuntime` (D-017).
 * Nenhuma regra financeira, nenhum cálculo, nenhuma inferência — a
 * transformação é puramente estrutural (D-019).
 *
 * Desde a Mission 062 (Report Layer Builder Integration, D-035/D-036),
 * `buildSections()` também organiza `execution.indicators.indicators`
 * usando `KPIBuilder`/`FinancialHealthBuilder`/`FinancialRiskBuilder`
 * (`efos/engines/financial-model/builders/`, Missions 057–059).
 *
 * Desde a Mission 064 (Financial Statement Builders Integration,
 * D-037), `buildSections()` também organiza `execution.data`
 * (`readonly NormalizedFinancialRecord[]`, produzido pelo Data Engine
 * e preservado em `PipelineExecution.data` desde a Mission 020B) com
 * `BalanceSheetBuilder`/`IncomeStatementBuilder`/`CashFlowBuilder` —
 * cada Builder aplicado **independentemente**, nunca encadeados: a
 * ordenação de uma demonstração nunca contamina outra.
 * `FinancialStatementBuilder` continua sem seção correspondente —
 * exige `CandidateFinancialRecord[]` (Data Engine, forma
 * pré-normalização), que nunca é preservado em lugar algum (D-033).
 * Nenhum Builder é chamado por nenhum Engine — só por esta camada,
 * que já importava `FinancialModelEngine` diretamente
 * (`EFOSPipelineRuntime.ts`) antes da Mission 062.
 *
 * Desde a Mission 194 (Production Executive Report Truth &
 * Presentation Audit, D-118), cada Builder recebe um SUBCONJUNTO de
 * `execution.data` pré-filtrado por `kind` — não mais a coleção
 * inteira e idêntica para os três — evitando que Resources/
 * StatementLines/Events de OUTRAS demonstrações apareçam misturados no
 * grupo residual de cada uma (`buildFinancialSections()`, abaixo, tem
 * o racional completo por seção).
 *
 * Desde a Mission 065 (Executive Financial Report Assembly),
 * `buildSections()` monta as seis seções financeiras (Financial
 * Health, Financial Risk, KPI, Balance Sheet, Income Statement, Cash
 * Flow) em uma ordem executiva determinística fixa, em vez da ordem
 * incidental de construção — apenas reorganização de posição no
 * array; nenhum dado de nenhuma seção é alterado. As demais seções
 * (`indicators`, `evidence`, `context`, `reasoning`, `recommendation`,
 * `decision`) permanecem na mesma ordem relativa de antes, ao final.
 * Uma seção ausente (dado correspondente não presente em `execution`)
 * é simplesmente omitida — nunca criada artificialmente.
 */
export class DefaultReportService implements ReportService {
  readonly name = "ReportService";

  async generateReport(execution: PipelineExecution): Promise<ExecutiveReport> {
    return {
      metadata: this.buildMetadata(execution),
      summary: this.buildSummary(execution),
      sections: this.buildSections(execution),
    };
  }

  private buildMetadata(execution: PipelineExecution): ExecutiveReportMetadata {
    return {
      companyId: execution.pipelineContext.companyId,
      executionId: execution.pipelineContext.executionId,
      financialModelId: execution.financialModel?.root.id,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildSummary(execution: PipelineExecution): ExecutiveReportSummary {
    return {
      indicatorsCount: execution.indicators?.indicators.length ?? 0,
      evidenceCount: execution.evidence?.evidences.length ?? 0,
      contextCount: execution.context?.contexts.length ?? 0,
      reasoningCount: execution.reasoning?.reasonings.length ?? 0,
      recommendationCount: execution.recommendation?.recommendations.length ?? 0,
      decisionCount: execution.decision?.decisions.length ?? 0,
    };
  }

  /**
   * As seis seções financeiras, em ordem executiva determinística fixa
   * (Mission 065): Financial Health → Financial Risk → KPI → Balance
   * Sheet → Income Statement → Cash Flow. Cada uma é computada de
   * forma independente (mesmos Builders/dados das Missions 062/064,
   * nenhuma lógica nova) e omitida, sem substituto, quando o dado de
   * origem não está presente em `execution` — nunca uma seção fictícia.
   */
  private buildFinancialSections(
    execution: PipelineExecution
  ): readonly ExecutiveReportSection[] {
    const sections: ExecutiveReportSection[] = [];

    if (execution.indicators) {
      sections.push({
        type: "financialHealth",
        title: "Saúde Financeira",
        financialHealth: new DefaultFinancialHealthBuilder().build(
          execution.indicators.indicators
        ),
      });

      sections.push({
        type: "financialRisk",
        title: "Risco Financeiro",
        financialRisk: new DefaultFinancialRiskBuilder().build(
          execution.indicators.indicators
        ),
      });

      sections.push({
        type: "kpi",
        title: "KPIs",
        kpi: new DefaultKPIBuilder().build(execution.indicators.indicators),
      });
    }

    if (execution.data) {
      // Mission 194 — Production Executive Report Truth & Presentation
      // Audit, Seção 7/42/43 (D-118). Até esta missão, os três
      // Builders recebiam `execution.data` INTEIRO e sem filtro — cada
      // demonstração acabava mostrando os MESMOS registros (Resources,
      // Events e StatementLines misturados), apenas reordenados de
      // forma diferente; o grupo "residual"/"não classificado" de cada
      // Builder virava um despejo genérico de tudo que pertencia às
      // OUTRAS demonstrações, nunca um sinal confiável de "dado
      // genuinamente não coberto por convenção". Os Builders em si
      // permanecem inalterados nesse sentido (nunca filtram/removem o
      // que recebem — README.md, "jamais criar/remover registros") —
      // o filtro é aplicado AQUI, na fronteira de qual dado pertence a
      // qual demonstração, por autoridade canônica de domínio (Seção 7
      // da missão): `kind === "resource"` pertence exclusivamente ao
      // Balanço Patrimonial; `kind === "statement_line"` pertence
      // exclusivamente à DRE (D-106: `StatementType` é fechado a
      // `"income_statement"`, nenhuma StatementLine jamais representa
      // Balancete); `kind === "event"` pode legitimamente alimentar
      // TANTO a DRE (fallback D-004 quando não há DRE declarada) QUANTO
      // o Fluxo de Caixa (mesma convenção de direção de caixa já usada
      // pelo Evidence Engine) — nenhuma duplicação de autoridade, é o
      // mesmo evento aparecendo em duas leituras complementares e já
      // estabelecidas.
      //
      // `record.amount !== undefined` (achado da Mission 194, Seção
      // 29/34): confirmado por reprodução real que uma linha de
      // CABEÇALHO de documento (ex.: "Extrato Bancário — Conta
      // Corrente", sem nenhum valor monetário) pode ser classificada
      // como um Resource `cash` SEM VALOR (`value: undefined` —
      // permitido pelo próprio contrato de domínio, `Resource.value?`)
      // — nunca um número fabricado (a UI já mostra "—" corretamente
      // para isso, `FinancialRecordsTable`), mas sua simples PRESENÇA
      // na tabela do Balanço faz uma análise sem nenhum documento de
      // Balanço real "parecer" ter dado patrimonial (Seção 34: "must
      // not look artificially complete"). Um registro sem `amount` não
      // carrega nenhuma informação financeira para nenhuma das três
      // demonstrações — filtrado aqui, na mesma fronteira de
      // apresentação, nunca na classificação/Financial Model (que
      // permanecem intocados; `Indicator`s continuam calculados a
      // partir de `FinancialModelAggregate.resources/events/statementLines`,
      // uma coleção INTEIRAMENTE SEPARADA de `execution.data` — este
      // filtro nunca afeta nenhum valor calculado, apenas o que é
      // exibido nas três tabelas).
      const hasAmount = (record: NormalizedFinancialRecord) => record.amount !== undefined;
      const balanceSheetInput = execution.data.filter(
        (record) => record.kind === "resource" && hasAmount(record)
      );
      const incomeStatementInput = execution.data.filter(
        (record) => record.kind !== "resource" && hasAmount(record)
      );
      const cashFlowInput = execution.data.filter(
        (record) => record.kind === "event" && hasAmount(record)
      );

      sections.push({
        type: "balanceSheet",
        title: "Balanço Patrimonial",
        balanceSheet: new DefaultBalanceSheetBuilder().build(balanceSheetInput),
      });

      sections.push({
        type: "incomeStatement",
        title: "Demonstração do Resultado",
        incomeStatement: new DefaultIncomeStatementBuilder().build(incomeStatementInput),
      });

      sections.push({
        // Mission 194, Seção 16/52.2 (D-118): mantido `type: "cashFlow"`
        // (contrato `ExecutiveReportSection` inalterado) mas o TÍTULO
        // deixa de afirmar "Fluxo de Caixa" (que, em português,
        // implica a Demonstração de Fluxo de Caixa formal — método
        // direto/indireto, com saldo inicial/final e seções de
        // Investimento/Financiamento) quando o conteúdo real é uma
        // agregação de transações bancárias por direção operacional
        // (Entrada/Saída), sem essas três propriedades — nenhuma delas
        // é uma correção de STOP (Seção 52.2): não exige nenhum modelo
        // de domínio de Fluxo de Caixa novo, apenas um rótulo honesto
        // sobre o que já existe. Ver `docs/DECISIONS.md`, D-118.
        type: "cashFlow",
        title: "Movimentações de Caixa (Entradas e Saídas Operacionais)",
        cashFlow: new DefaultCashFlowBuilder().build(cashFlowInput),
      });
    }

    return sections;
  }

  private buildSections(
    execution: PipelineExecution
  ): readonly ExecutiveReportSection[] {
    const sections: ExecutiveReportSection[] = [
      ...this.buildFinancialSections(execution),
    ];

    if (execution.indicators) {
      sections.push({
        type: "indicators",
        title: "Indicadores",
        indicators: execution.indicators,
      });
    }

    if (execution.evidence) {
      sections.push({
        type: "evidence",
        title: "Evidências",
        evidence: execution.evidence,
      });
    }

    if (execution.context) {
      sections.push({
        type: "context",
        title: "Contextos",
        context: execution.context,
      });
    }

    if (execution.reasoning) {
      sections.push({
        type: "reasoning",
        title: "Raciocínios",
        reasoning: execution.reasoning,
      });
    }

    if (execution.recommendation) {
      sections.push({
        type: "recommendation",
        title: "Recomendações",
        recommendation: execution.recommendation,
      });
    }

    if (execution.decision) {
      sections.push({
        type: "decision",
        title: "Decisões",
        decision: execution.decision,
      });
    }

    return sections;
  }
}
