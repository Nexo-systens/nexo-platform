import type {
  Context,
  Evidence,
  Indicator,
  Period,
  Reasoning,
  Recommendation,
} from "@/efos/domain";
import type { ExecutionComparison } from "@/efos/application/history";
import type { FinancialEpisodeStateResult } from "@/efos/application/financial-episodes";

/**
 * Razão pela qual um `Indicator` está `unavailable` (Mission 113,
 * Etapa 7 — auditoria "Unknowns como objeto de primeira classe").
 * Confirmado por essa auditoria: `IndicatorResult` (D-052) tem
 * exatamente 2 estados e **nunca carrega a razão como campo
 * estruturado** — o motivo real (denominador zero, evento ausente
 * etc.) só existe implicitamente no código de cada fórmula, nunca no
 * dado. `UnknownReason` é o vocabulário conceitual proposto pela
 * missão para essa razão; `"UNKNOWN_CAUSE"` é usado por
 * `buildExecutiveFinancialContext()` para **todo** `Unknown` hoje —
 * não porque a causa seja genuinamente desconhecida no código-fonte,
 * mas porque o dado persistido (`Indicator`) não distingue as demais
 * categorias entre si, e inventar uma distinção que o dado não
 * carrega seria fabricar precisão que não existe (mesmo princípio já
 * aplicado a `SourceDetails`, Mission 109, e a `sourceRecordIds`,
 * Mission 110/111). Reclassificar `Unknown`s por razão específica
 * exigiria estender `IndicatorResult`/`CalculatedIndicator` para
 * carregar a razão — decisão arquitetural própria, fora do escopo
 * desta missão.
 */
export type UnknownReason =
  | "MISSING_DATA"
  | "INSUFFICIENT_DATA"
  | "NOT_APPLICABLE"
  | "UNSUPPORTED_INPUT"
  | "UNKNOWN_CAUSE";

/**
 * Um único fato que a Executive AI **não pode concluir** nesta
 * execução (Mission 114, Etapa 7). Existe para que uma futura
 * Executive AI receba explicitamente o que não sabe, nunca apenas o
 * que sabe — nenhum `Unknown` é inventado: cada um corresponde
 * exatamente a um `Indicator` com `result.status === "unavailable"`
 * já produzido pelo Indicators Engine.
 */
export interface ExecutiveUnknown {
  readonly subject: string;
  readonly reason: UnknownReason;
  readonly impact: string;
}

/**
 * Um conflito financeiro preservado (Mission 113, Etapa 6; Mission
 * 114, Etapa 8) — **nunca** significa erro ou dado inconsistente:
 * significa que múltiplos sinais financeiros válidos coexistem e
 * exigem interpretação conjunta, que o Engine determinístico nunca
 * tenta resolver sozinho. `status` é sempre `"preserved"` — o Engine
 * nunca cancela/resolve um conflito silenciosamente (Mission 113,
 * Etapa 8: "AI_OUTPUT ≠ FINANCIAL_TRUTH", nenhuma camada resolve
 * conflito silenciosamente). Nenhuma detecção automática de conflito é
 * implementada por esta missão — isso exigiria uma nova regra
 * determinística (Context Rule), explicitamente proibida pelo escopo
 * da Mission 114 ("Não alterar Context Rules"); `conflicts` é sempre
 * `[]` em `buildExecutiveFinancialContext()` hoje. Ver
 * `docs/ENGINEERING_LOG.md`, Mission 113, Etapa 6, para os 5 casos já
 * mapeados conceitualmente (Cash+/Patrimônio−, Liquidez+/Endividamento
 * elevado, EBITDA+/Fluxo−, Crescimento/deterioração de margem,
 * ROE+/Patrimônio−) — candidatos para uma futura missão de detecção,
 * não implementados aqui.
 */
export interface ExecutiveConflict {
  readonly signals: readonly string[];
  readonly relationship: string;
  readonly status: "preserved";
  readonly requiresAdditionalData: boolean;
}

/**
 * Resumo de rastreabilidade de origem do contexto inteiro (Mission
 * 114, Etapa 10) — apenas `id`s de registros reais (`Indicator.
 * sourceRecordIds`, D-056), nunca uma URL/caminho de Storage, nunca um
 * componente de download, nunca nenhum detalhe de apresentação. Uma
 * futura Executive AI recebe "esta afirmação é sustentada por estes
 * registros", nunca depende de como um consumidor de UI os exibiria.
 * `sourceRecordIds` é a união (sem duplicatas) de todo `Indicator.
 * sourceRecordIds` presente em `financialTruth.indicators` — nenhum
 * campo novo é somado/recalculado, apenas reagrupado.
 */
export interface SourceTraceabilitySummary {
  readonly sourceRecordIds: readonly string[];
}

/**
 * Bloco `financialTruth` (Mission 114, Etapa 5) — contém
 * exclusivamente CONFIRMED FACT/DERIVED FACT (taxonomia oficial,
 * Mission 113): a lista completa de `Indicator`s já calculados pelo
 * Indicators Engine, sem nenhuma seleção/filtro (`available` e
 * `unavailable` ambos presentes — `unavailable` é, ele mesmo, um FACT
 * sobre o que não pôde ser calculado, refletido também em
 * `ExecutiveFinancialContext.unknowns`). **Nunca** contém
 * interpretation/hypothesis/recommendation/decision — por construção
 * de tipo, `FinancialTruth` só pode carregar `Indicator[]`.
 */
export interface FinancialTruth {
  readonly indicators: readonly Indicator[];
}

/**
 * Bloco `deterministicIntelligence` (Mission 114, Etapa 6) — Context,
 * Reasoning e Recommendation já produzidos pelos respectivos Engines
 * determinísticos. `Evidence` é deliberadamente **um campo irmão**
 * (`ExecutiveFinancialContext.evidence`), não duplicado aqui — a
 * missão descreve Evidence tanto como parte da "inteligência
 * determinística" (Etapa 6) quanto como campo próprio no contrato
 * mínimo (Etapa 4); esta implementação resolve a sobreposição mantendo
 * Evidence em exatamente um lugar, evitando duplicação de dado (Etapa
 * 12). Cada item preserva sua própria natureza — `Recommendation`
 * nunca é tratado como FACT, é sempre uma proposta determinística
 * (mesmo template fixo, nunca uma afirmação sobre a realidade).
 * `Decision` é deliberadamente **ausente** deste contrato — Etapa 4
 * não a lista entre os 9 campos do contrato mínimo; `Decision` (D-011)
 * é uma priorização que depende de julgamento humano subsequente, não
 * um insumo que a Executive AI deveria receber como entrada.
 */
export interface DeterministicIntelligence {
  readonly contexts: readonly Context[];
  readonly reasoning: readonly Reasoning[];
  readonly recommendations: readonly Recommendation[];
}

/**
 * Bloco `historicalIntelligence` (Mission 114, Etapa 9) — a
 * `ExecutionComparison` (D-045/D-046) já produzida por
 * `compareExecutions()`, sem nenhuma transformação. **Nunca** carrega
 * `causalExplanation` — confirmado, por construção, que
 * `ExecutionComparison`/`MetricComparison` não têm esse campo (Mission
 * 113, Cenário F/H) — apenas `direction` (mudança observada). Ausente
 * (`undefined`) quando não há execução anterior para comparar — nunca
 * uma comparação fabricada.
 */
export interface HistoricalIntelligence {
  readonly comparison: ExecutionComparison;
}

/**
 * `ExecutiveFinancialContext` (Mission 114 — Executive Financial
 * Context Model). Objeto canônico que consolida tudo que o EFOS já
 * sabe sobre uma empresa, numa única execução, pronto para ser
 * entregue a uma futura Executive AI — nunca a própria IA, nunca um
 * "Executive Diagnosis" (fora de escopo, proibido explicitamente).
 *
 * Confirmado por auditoria (Etapa 3) que `ExecutiveReport`
 * (`efos/application/report/`) **não** cumpre essa responsabilidade:
 * `ExecutiveReportSection` carrega `title: string` (rótulo de UI) em
 * toda variante, é uma união discriminada organizada como array
 * ordenado (pensado para renderização sequencial, Mission 065),
 * nunca inclui `ExecutionComparison` (histórico é uma resposta HTTP
 * inteiramente separada, `GET /api/efos/history/:companyId`) e não
 * tem nenhuma representação de `unknowns`/`conflicts`. `
 * ExecutiveFinancialContext` é deliberadamente independente de:
 * labels de interface, componentes React, formatação, idioma de
 * apresentação — cada campo é nomeado e tipado para consumo
 * programático, nunca para renderização direta.
 *
 * Imutável e específico de uma execução (Etapa 11): construído sempre
 * a partir dos agregados de **uma única execução** — duas chamadas de
 * `buildExecutiveFinancialContext()` para execuções diferentes nunca
 * compartilham nenhuma referência de objeto (confirmado por teste).
 * Nenhuma execução pode alterar o contexto de outra.
 */
export interface ExecutiveFinancialContext {
  readonly identity: { readonly companyId: string };
  readonly period: Period;
  readonly financialTruth: FinancialTruth;
  readonly evidence: readonly Evidence[];
  readonly deterministicIntelligence: DeterministicIntelligence;
  readonly historicalIntelligence?: HistoricalIntelligence;
  readonly sourceTraceability: SourceTraceabilitySummary;
  readonly unknowns: readonly ExecutiveUnknown[];
  readonly conflicts: readonly ExecutiveConflict[];
  /**
   * Bloco `financialEpisodes` (Mission 172 — Integrate Financial
   * Episode Intelligence into ExecutiveFinancialContext). Um
   * `FinancialEpisodeStateResult` (Mission 171/171 Fix,
   * `efos/application/financial-episodes/`) por métrica suportada por
   * D-087 — nunca recalculado aqui, apenas incluído por referência
   * direta, mesmo princípio de `historicalIntelligence` acima. Ausente
   * (`undefined`) quando `buildExecutiveFinancialContext()` não recebe
   * `executions` — nunca um array vazio fabricado, nunca uma
   * derivação forçada sem histórico real. Quando presente, SEMPRE
   * contém exatamente uma entrada por métrica suportada (nunca um
   * subconjunto arbitrário) — incluindo entradas `NOT_DETERMINABLE`,
   * que permanecem informação executiva genuína, nunca filtradas por
   * conveniência (Requisito 9 da missão). `SUSTAINED_IMPROVEMENT`
   * nunca implica recuperação; `NOT_DETERMINABLE` nunca implica saúde
   * financeira (D-088) — ver constraints correspondentes em
   * `ExecutiveAIInstruction`.
   */
  readonly financialEpisodes?: readonly FinancialEpisodeStateResult[];
}
