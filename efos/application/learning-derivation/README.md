# EFOS Continuous Financial Intelligence & Learning Loop (Mission 140)

## Objetivo

Fechar o próximo elo da cadeia executiva, transformando decisões e seus resultados em conhecimento acumulativo:

```
Decision (Mission 137)
    ↓
DecisionExecutionEvent (Mission 138)
    ↓
Outcome humano (Mission 138, D-011)
    ↓
FinancialOutcomeObservation (Mission 139, D-071)
    ↓
LearningRecord (este módulo — ativa D-013)
    ↓
Knowledge (Domain, D-011 — preparado, NÃO auto-populado nesta missão)
```

## Auditoria (Etapa 2 da missão) — respostas explícitas

- **(A) O que `Knowledge` já representa?** Um fato permanente sobre uma empresa, derivado de `Outcome`s ao longo do tempo (`derivedFromOutcomeIds`) — Camada 9 da Ontologia, desde a Mission 003.
- **(B) `Knowledge` já foi persistido/consumido?** Não — confirmado por busca em todo o repositório, mesmo estado de `Outcome` antes da Mission 138.
- **(C) Existe relação atual entre Decision/Outcome/FinancialOutcomeObservation/Knowledge?** Só `Outcome.decisionId` (D-011) e `Knowledge.derivedFromOutcomeIds` (nunca populado) — nenhuma conexão real entre os 4 conceitos antes desta missão.
- **(D) `Hypothesis` já tem mecanismo de confirmação/enfraquecimento?** Sim, estruturalmente (`status: candidate|confirmed|refuted`, `supportingEvidenceIds`/`contradictingEvidenceIds`) — mas 0 consumidores em todo o repositório (confirmado por busca), um eixo diferente (evidência sobre Financial Truth, Camada 5), nunca usado por este módulo.
- **(E) `Evidence` já suporta aprendizado futuro?** `Evidence` (Camada 4) já é rica (`sources: EvidenceSource[]`, `confidence`/`severity`/`category`) mas é upstream de Reasoning/Recommendation — nunca referencia Decision/Outcome. Sem relação direta com este módulo.
- **(F) Existe conceito equivalente a Learning Record?** **Sim — `LearningRecord` já existe e já é ativamente produzido/persistido** (`efos/engines/learning/`, D-013, Mission 015), mas escopado a "observações estruturais dentro de UMA ÚNICA execução do pipeline" (`source: "execution"`), embutido em `ExecutionSnapshot.execution.learning`, nunca consultável independentemente entre execuções/decisões. Seu próprio vocabulário (`LEARNING_SOURCES`/`LEARNING_TYPES`) já reservava `"historical_pattern"`/`"user_feedback"`/`"observation"`/`"executive_insight"` desde a Mission 015 — nunca usados, antecipando exatamente esta extensão.
- **(G) Criar uma entidade nova seria duplicação?** Sim — `LearningRecord` já é a entidade correta. Esta missão **estende** `LearningRecord` (3 campos aditivos e opcionais), nunca cria `Learning`/`Insight`/`Lesson`/`Memory`.
- **(H) Menor mudança necessária?** 3 campos opcionais em `LearningRecord` (`outcomeIds?`, `financialObservationIds?`, `evidenceClassification?`), 1 enum novo (`LearningEvidenceClassification`, 4 valores), 1 campo opcional em `Knowledge` (`derivedFromLearningRecordIds?`, preparação de contrato apenas), 1 novo módulo Application (função pura de derivação), 1 nova tabela de persistência (mesmo padrão de `Outcome`/D-070/D-071 — o tipo já existia, faltava ativação).

## Por que `LearningRecord` continua um único tipo, com 2 caminhos de construção?

Mesmo precedente de `Decision` (D-063): o `LearningEngine` determinístico (`efos/engines/learning/`) **nunca** preenche `outcomeIds`/`financialObservationIds`/`evidenceClassification` — todo `LearningRecord` que ele produz continua, byte a byte, o mesmo registro de sempre. Estes 3 campos só existem para o segundo caminho: `buildLearningRecord()`, acionado por um humano, derivado de dados já persistidos.

## Classificação de evidência — nunca interpreta direção financeira

`deriveEvidenceClassification()` deriva `EVIDENCE_FAVORABLE`/`EVIDENCE_CONTRARY`/`INCONCLUSIVE` **exclusivamente** do julgamento humano já existente (`Outcome.status`) — nunca de uma interpretação nova sobre se um indicador "subiu" ou "desceu" é bom ou ruim (nenhum lugar do domínio codifica essa semântica; inventá-la seria exatamente a causalidade não comprovada que esta missão proíbe). `TEMPORAL_ASSOCIATION` cobre o caso em que só há dado financeiro, sem julgamento humano ainda. `INSUFFICIENT_EVIDENCE` nunca é persistido — mesma convenção de `DecisionExecutionStatus.NOT_STARTED`/`DiagnosisReviewStatus.PENDING`.

## Persistência — imutável, mesmo padrão de D-070/D-071

Ver `docs/DECISIONS.md`, D-072: um `LearningRecord` derivado é persistido como registro imutável (`public.learning_records`) — nunca atualizado silenciosamente.

## `Knowledge` — deliberadamente NÃO auto-populado nesta missão

Com apenas 1 `Decision` real em produção, qualquer construção automática de `Knowledge` seria um padrão fabricado a partir de uma amostra de 1. `Knowledge.derivedFromLearningRecordIds?` prepara o contrato; uma missão futura, com volume real de `LearningRecord`s, deve decidir explicitamente o critério de consolidação.

## O que este módulo NÃO faz

- Não afirma causalidade — `LearningEvidenceClassification` nunca contém um valor causal (mesma garantia estrutural de `FinancialCorrelationClassification`, D-071).
- Não interpola/estima/inventa evidência ausente — `INSUFFICIENT_EVIDENCE` é sempre o resultado honesto.
- Não é calculado pela IA — nenhum import de `efos/infrastructure/executive-ai/` em nenhum arquivo deste módulo.
- Não altera `Decision`/`Outcome`/`FinancialOutcomeObservation`/Financial Truth — apenas lê e referencia por ID.
- Não popula `Knowledge` automaticamente — fronteira documentada, deliberadamente não implementada.

Ver `docs/DECISIONS.md`, D-072, e `docs/ENGINEERING_LOG.md`, Mission 140, para a auditoria completa e os cenários testados.

## Mission 186 — terceiro caminho de construção (Expected vs Observed)

`buildLearningRecord()` ganhou um sexto parâmetro opcional, `expectedActualContext?: ExpectedActualLearningContext` (`efos/application/expected-actual-learning/`), mesmo precedente exato de `outcomeIds?`/`financialObservationIds?`/`evidenceClassification?` acima — nunca calculado aqui, sempre pré-computado por `deriveExpectedActualLearningEligibility()` a partir da camada `formal` (nunca `live`) já produzida por `resolveExpectedActualComparison()` (Mission 185/185 Closure). Quando presente, é serializado em `supportingData.expectedActualContext` — nunca um novo campo do Domain, nunca uma segunda entidade Learning. Nunca muda `classification`/`confidence`/`type`/`source`/`title`/`description`, que continuam vindo exclusivamente de `deriveEvidenceClassification()` (`Outcome.status`, inalterado) — o fato financeiro determinístico permanece estruturalmente separado da conclusão de aprendizado. Ver `docs/DECISIONS.md`, D-099, e `efos/application/expected-actual-learning/README.md`, para o racional completo.

## Mission 186 Closure — `humanStatement`, a camada de conclusão genuína

D-099 conectou o contexto financeiro (`expectedActualContext`) ao Learning, mas nunca produzia uma CONCLUSÃO distinta dele — `title`/`description` continuavam o mesmo template por `evidenceClassification`, idêntico para qualquer distância financeira (prova do gap: duas Decisions com a mesma `evidenceClassification` e distâncias opostas, -20 e +40, produziam `description` byte-idêntica). `buildLearningRecord()` ganhou um sétimo parâmetro opcional, `humanStatement?: string` (mesmo precedente de nomenclatura/semântica de `DiagnosisReviewModification.humanStatement`, `efos/application/diagnosis-review/`) — texto livre que o executivo escreve, nunca calculado, nunca reformulado. **Obrigatório apenas quando `expectedActualContext` está presente** (`HUMAN_STATEMENT_REQUIRED` caso contrário, verificado ANTES de `deriveEvidenceClassification()`) — nenhum aprendizado que reivindique contexto Esperado vs. Observado formal é persistido apoiado só no template genérico. Para o caminho sem `expectedActualContext` (Decisions comuns), `humanStatement` permanece inteiramente opcional — comportamento inalterado. `title`/`description`/`evidenceClassification` nunca são tocados por esta extensão — a distinção genuína entre dois resultados financeiros opostos agora vive exclusivamente em `humanStatement`. Ver `docs/DECISIONS.md`, D-100, para o racional completo, a prova do gap e a prova de fechamento (resultado oposto).
