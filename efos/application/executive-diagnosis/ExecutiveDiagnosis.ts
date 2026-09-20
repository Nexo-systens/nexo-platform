import type {
  DiagnosisBoundaries,
  ExecutiveConflictInterpretation,
  ExecutiveHypothesis,
  ExecutiveInterpretation,
  ExecutivePossibleAction,
  ExecutivePriority,
  ExecutiveQuestion,
  ExecutiveRiskAssessment,
  ExecutiveSummary,
  ExecutiveUncertainty,
} from "./ExecutiveDiagnosis.types";

/**
 * De onde este diagnóstico foi gerado — sempre rastreável até um
 * `ExecutiveFinancialContext` (D-058) real, nunca produzido "do nada".
 * `generatedAt` é `string` (ISO 8601), não `Date` — mesma convenção
 * já usada em todo o Domain (`AuditTrail.createdAt`, D-003) e
 * necessária para serialização estável (JSON não tem tipo `Date`
 * nativo); o texto conceitual da missão usa `Date` — divergência
 * deliberada, documentada aqui ("os nomes podem variar", Etapa 6).
 */
export interface ExecutiveDiagnosisBasedOn {
  readonly contextId?: string;
  readonly analysisId?: string;
  readonly generatedAt: string;
}

/**
 * `ExecutiveDiagnosis` (Mission 115 — Executive Diagnosis Contract).
 * Contrato canônico de saída de uma futura Executive AI — nunca a
 * própria IA, nunca integrado a nenhum provedor (OpenAI/Claude/etc.)
 * por esta missão. Consome um `ExecutiveFinancialContext` (D-058) e
 * produz **exclusivamente** interpretação estruturada:
 *
 * ```
 * ExecutiveFinancialContext (FACT/DERIVED FACT)
 *         ↓
 * ExecutiveDiagnosis (INTERPRETATION/HYPOTHESIS/RISK/PRIORITY/
 *                      POSSIBLE ACTION/QUESTION/UNCERTAINTY/
 *                      CONFLICT INTERPRETATION)
 *         ↓
 * Human Judgment → Decision → Execution → Outcome → Learning
 * ```
 *
 * **Nunca contém, e nunca pode conter, por construção de tipo**:
 * `Decision` (D-011 — decisão continua exclusivamente humana/
 * determinística), `Outcome` (referencia `decisionId`, estruturalmente
 * impossível de existir antes de uma Decision), `Financial Truth`
 * bruto reescrito (o diagnóstico nunca redeclara `Indicator.result`
 * como se fosse produção própria), nem nenhuma instrução de execução.
 * Cada campo do contrato é um dos 8 vocabulários permitidos (Etapa 5):
 * `executiveSummary`/`interpretations`/`hypotheses`/`risks`/
 * `priorities`/`possibleActions`/`questions`/`uncertainties`/
 * `conflictInterpretations` — mais `boundaries`, que torna essa
 * separação visível no próprio dado, não apenas em documentação.
 *
 * Auditoria confirmada (Mission 115, Etapa 4) — nenhum tipo existente
 * cumpre esta responsabilidade: `Recommendation`/`Decision` (Domain)
 * são sempre determinísticos (D-010/D-011, 3 templates fixos, nunca
 * confiança probabilística); `Outcome` exige uma Decision já existente;
 * `LearningRecord` observa Decisions/Recommendations já produzidas,
 * nunca gera interpretação nova. Nenhum tipo foi duplicado — este é o
 * primeiro do seu tipo no Domain/Application.
 *
 * Imutável (`readonly` em toda a árvore, Etapa 18) e execution-scoped
 * (Etapa 21, Cenário K/L): um `ExecutiveDiagnosis` corresponde a
 * uma única geração — dois diagnósticos (inclusive para a mesma
 * empresa/período) são sempre objetos distintos, nenhum sobrescreve o
 * outro; preservação histórica é responsabilidade de quem persiste
 * (fora do escopo desta missão — nenhuma tabela/migration criada).
 */
export interface ExecutiveDiagnosis {
  readonly id: string;
  readonly basedOn: ExecutiveDiagnosisBasedOn;
  readonly executiveSummary: ExecutiveSummary;
  readonly interpretations: readonly ExecutiveInterpretation[];
  readonly hypotheses: readonly ExecutiveHypothesis[];
  readonly risks: readonly ExecutiveRiskAssessment[];
  readonly priorities: readonly ExecutivePriority[];
  readonly possibleActions: readonly ExecutivePossibleAction[];
  readonly questions: readonly ExecutiveQuestion[];
  readonly uncertainties: readonly ExecutiveUncertainty[];
  readonly conflictInterpretations: readonly ExecutiveConflictInterpretation[];
  readonly boundaries: DiagnosisBoundaries;
}

/**
 * Único valor válido de `DiagnosisBoundaries` — o tipo é um literal
 * fechado (todo campo só pode ser `true`), então não há por que cada
 * consumidor reconstruir o mesmo objeto: usar esta constante garante
 * que a afirmação das 5 fronteiras nunca diverge por acidente de
 * digitação.
 */
export const DIAGNOSIS_BOUNDARIES: DiagnosisBoundaries = {
  doesNotChangeFinancialTruth: true,
  doesNotMakeDecisions: true,
  doesNotExecuteActions: true,
  containsInterpretations: true,
  containsHypotheses: true,
};
