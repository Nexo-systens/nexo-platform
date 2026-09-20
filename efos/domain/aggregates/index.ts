import type {
  Company,
  Context,
  Decision,
  Evidence,
  FinancialEvent,
  FinancialModel,
  Hypothesis,
  Indicator,
  Integration,
  Knowledge,
  LearningRecord,
  Reasoning,
  Recommendation,
  Resource,
  Scenario,
  StatementLine,
  User,
} from "../entities";
import type { GraphEdge, GraphNode, StatementConflict } from "../value-objects";

/**
 * Agregados do dominio EFOS. Cada agregado tem uma raiz e uma fronteira
 * de consistencia propria; agregados referenciam uns aos outros sempre
 * por ID (ver campos `*Id`/`*Ids` nas entidades), nunca por composicao
 * direta de objeto — mantem cada fronteira pequena e evita acoplamento
 * entre agregados distintos.
 */

/** Empresa + usuarios + integracoes que ela possui. */
export interface CompanyAggregate {
  readonly root: Company;
  readonly users: readonly User[];
  readonly integrations: readonly Integration[];
}

/**
 * Modelo Financeiro + recursos, eventos, linhas de demonstrativo e
 * indicadores que ele agrega.
 *
 * `statementLines` (Mission 192 — Canonical Financial Statement
 * Ingestion & Period Semantics, D-106): campo ADITIVO e opcional —
 * todo `FinancialModelAggregate` construido antes desta missao
 * (sintetico ou persistido) continua valido byte a byte, sem esse
 * campo. Carrega valores agregados por periodo (DRE) — uma terceira
 * forma economica, estruturalmente distinta de `resources` (saldo
 * pontual) e `events` (transacao datada); nunca fundida com nenhuma
 * das duas.
 *
 * `statementConflicts` (Mission 192 Closure B — Deterministic
 * Statement Conflict Governance, D-113): campo ADITIVO e opcional,
 * mesmo principio de `statementLines` — ausente/vazio para todo
 * `FinancialModelAggregate` sem nenhum conflito detectado na ingestao
 * (o caso comum, byte a byte igual a antes desta missao). Quando
 * presente, registra que um demonstrativo (DRE) ou saldo pontual
 * (Balancete) do MESMO periodo/data foi declarado de forma
 * materialmente conflitante por mais de uma fonte no mesmo lote — as
 * fontes conflitantes ja foram excluidas ANTES de chegar aqui
 * (`app/api/efos/_shared/prepareFinancialDocuments.ts`, D-113), entao
 * nenhuma `StatementLine`/`Resource` conflitante existe neste
 * agregado. Este campo e o UNICO sinal que distingue "nenhum
 * demonstrativo jamais existiu" (ausencia genuina) de "um
 * demonstrativo existiu mas seu conflito nunca foi resolvido"
 * (ausencia por conflito) — `extractFinancialStatementInputs()`
 * (efos/engines/indicators/) consulta este campo exatamente por isso:
 * sem ele, um conflito de DRE reabriria o fallback para soma de
 * eventos (D-109) como se a empresa nunca tivesse enviado DRE algum.
 */
export interface FinancialModelAggregate {
  readonly root: FinancialModel;
  readonly resources: readonly Resource[];
  readonly events: readonly FinancialEvent[];
  readonly statementLines?: readonly StatementLine[];
  readonly statementConflicts?: readonly StatementConflict[];
  readonly indicators: readonly Indicator[];
}

/** Raizes de agregado unitario — referenciam outros agregados por ID, nao por composicao. */
export interface HypothesisAggregate {
  readonly root: Hypothesis;
}

export interface ScenarioAggregate {
  readonly root: Scenario;
}

export interface KnowledgeAggregate {
  readonly root: Knowledge;
}

/**
 * Indicadores financeiros calculados de uma empresa/Financial Model
 * (Mission 007 — Indicators Engine). Sem raiz unica (`root`) porque um
 * Indicator individual ja e uma entidade completa por si so — o
 * agregado aqui e apenas a colecao com fronteira propria (todos os
 * indicadores calculados na mesma execucao, para o mesmo Financial
 * Model).
 */
export interface IndicatorsAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly indicators: readonly Indicator[];
}

/**
 * Grafo de conhecimento financeiro de uma empresa (Mission 008 —
 * Financial Knowledge Graph Engine): nos e arestas tipados derivados do
 * FinancialModelAggregate e do IndicatorsAggregate. Contem apenas
 * estrutura de conhecimento — nenhuma interpretacao, hipotese ou
 * recomendacao (isso pertence a Reasoning/Recommendation, estagios
 * posteriores do pipeline).
 */
export interface FinancialKnowledgeGraphAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/**
 * Evidencias financeiras identificadas de uma empresa/Financial Model
 * (Mission 009 — Evidence Engine): fatos objetivos derivados do
 * FinancialModelAggregate, do IndicatorsAggregate e do
 * FinancialKnowledgeGraphAggregate. Mesmo padrao de agregado de colecao
 * de IndicatorsAggregate/FinancialKnowledgeGraphAggregate (sem `root`
 * unico — cada Evidence ja e uma entidade completa por si so; o
 * agregado e a colecao com fronteira propria de uma mesma execucao).
 * Substitui a definicao anterior de `EvidenceAggregate` (Mission 003,
 * raiz unitaria `{ root: Evidence }`, nunca consumida por nenhum
 * Engine ate esta missao) — ver docs/DECISIONS.md D-007.
 */
export interface EvidenceAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly evidences: readonly Evidence[];
}

/**
 * Contextos financeiros de uma empresa/Financial Model (Mission 010 —
 * Context Engine): situacoes compostas derivadas do agrupamento de
 * Evidencias relacionadas do EvidenceAggregate. Mesmo padrao de
 * agregado de colecao de IndicatorsAggregate/EvidenceAggregate (sem
 * `root` unico).
 */
export interface ContextAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly contexts: readonly Context[];
}

/**
 * Conclusoes executivas de uma empresa/Financial Model (Mission 011 —
 * Reasoning Engine): inferencias deterministicas derivadas da
 * combinacao de Contexts relacionados do ContextAggregate. Mesmo
 * padrao de agregado de colecao de IndicatorsAggregate/
 * EvidenceAggregate/ContextAggregate (sem `root` unico).
 */
export interface ReasoningAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly reasonings: readonly Reasoning[];
}

/**
 * Recomendacoes executivas de uma empresa/Financial Model (Mission 012
 * — Recommendation Engine): acoes propostas derivadas de um ou mais
 * Reasonings do ReasoningAggregate. Mesmo padrao de agregado de
 * colecao de IndicatorsAggregate/EvidenceAggregate/ContextAggregate/
 * ReasoningAggregate (sem `root` unico). Substitui a definicao
 * anterior de `RecommendationAggregate` (Mission 003, raiz unitaria
 * `{ root: Recommendation }`, nunca consumida por nenhum Engine ate
 * esta missao) — ver docs/DECISIONS.md D-010.
 */
export interface RecommendationAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly recommendations: readonly Recommendation[];
}

/**
 * Decisoes executivas (priorizacoes estruturadas) de uma empresa/
 * Financial Model (Mission 013 — Decision Engine): organizacoes/
 * ordenacoes deterministicas derivadas de uma ou mais Recommendations
 * do RecommendationAggregate. Mesmo padrao de agregado de colecao de
 * IndicatorsAggregate/EvidenceAggregate/ContextAggregate/
 * ReasoningAggregate/RecommendationAggregate (sem `root` unico).
 * Substitui a definicao anterior de `DecisionAggregate` (Mission 003,
 * raiz unitaria `{ root: Decision, outcome?: Outcome }`, nunca
 * consumida por nenhum Engine ate esta missao) — ver
 * docs/DECISIONS.md D-011. `Outcome` (efos/domain/entities/Outcome.ts)
 * deixa de ser composto neste agregado; continua referenciando uma
 * Decision por ID (`Outcome.decisionId`), agora desacoplado — vinculo
 * a ser resolvido pelo futuro Learning Engine, fora do escopo desta
 * missao.
 */
export interface DecisionAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly decisions: readonly Decision[];
}

/**
 * Conhecimento consolidado durante a operacao do sistema, de uma
 * empresa/Financial Model (Mission 015 — Learning Engine): registros
 * estruturais derivados de Decisions/Recommendations/Reasonings/
 * Contexts/Evidences ja produzidos na mesma execucao. Mesmo padrao de
 * agregado de colecao dos demais agregados pos-Evidence (sem `root`
 * unico). Nunca altera nenhum dos agregados que consome — apenas
 * observa e registra.
 */
export interface LearningAggregate {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly learnings: readonly LearningRecord[];
}
