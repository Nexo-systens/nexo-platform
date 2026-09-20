import { createClient } from "@/lib/supabase/server";
import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis";
import type { Database } from "@/types/database";

export type ExecutiveDiagnosisRow = Database["public"]["Tables"]["executive_diagnoses"]["Row"];

export interface PersistedExecutiveDiagnosis {
  readonly id: string;
  readonly companyId: string;
  readonly executionId: string | null;
  readonly diagnosis: ExecutiveDiagnosis;
  readonly providerName: string | null;
  readonly createdAt: string;
}

/**
 * Mission 179 Closure — Persisted Diagnosis Identity Compatibility.
 *
 * **Identidade canônica de um `ExecutiveDiagnosis` persistido**: o id
 * da LINHA (`executive_diagnoses.id`) — nunca o id embutido no objeto
 * `diagnosis` (jsonb). Prova: `DiagnosisReview.diagnosisId`
 * (`submitDiagnosisReviewAction()`) e `Decision.basedOnDiagnosisId`
 * (`createHumanDecisionAction()`) SEMPRE guardam o valor de
 * `input.diagnosisId`, que é sempre verificado contra
 * `getExecutiveDiagnosisById()`/`verifyDiagnosisBelongsToCompany()` —
 * ambos consultam `executive_diagnoses` pelo id DA LINHA. Isso nunca
 * mudou, nem antes nem depois da correção da Mission 179 no lado da
 * escrita — o id da linha sempre foi o único id que qualquer
 * Review/Decision realmente referencia.
 *
 * A Mission 179 corrigiu `saveExecutiveDiagnosis()` para gravar
 * `id: diagnosis.id` (alinhando as duas identidades para toda escrita
 * NOVA), mas isso sozinho não repara diagnósticos que já poderiam ter
 * sido persistidos ANTES dessa correção, onde `row.id !==
 * diagnosis.id` (o Postgres teria gerado um id de linha aleatório,
 * diferente do id embutido pela IA). Um `Decision`/`DiagnosisReview`
 * legado, criado contra esse diagnóstico legado, já teria gravado
 * corretamente o id DA LINHA (nunca o id embutido — ver acima) — o que
 * estava genuinamente quebrado era `deriveRecommendationGovernanceState()`
 * (Mission 154) receber o objeto `ExecutiveDiagnosis` de volta com um
 * `.id` embutido que NUNCA bateria com o que a Review/Decision
 * realmente referenciam.
 *
 * **Correção mínima e definitiva, no único limite canônico onde uma
 * linha do banco vira um objeto de aplicação**: `toPersisted()` sempre
 * normaliza `diagnosis.id` para IGUALAR `row.id` — nunca confiando no
 * id que porventura esteja embutido no jsonb. Para uma linha NOVA
 * (pós-correção da escrita), isso é um no-op determinístico (`row.id`
 * já é `diagnosis.id`). Para uma linha LEGADA (hipotética, pré-
 * correção), isso torna `diagnosis.id`, a partir de agora, sempre igual
 * ao id da linha — exatamente o id que qualquer Review/Decision já
 * associada a ela sempre referenciou. Nenhuma migration necessária:
 * nenhum dado armazenado é alterado, apenas como ele é exposto à
 * aplicação a partir daqui em diante — e nenhuma segunda identidade
 * "legada" passa a existir: a partir deste ponto, para qualquer
 * consumidor, só existe UMA identidade de diagnóstico, sempre a da
 * linha.
 */
export function toPersisted(row: ExecutiveDiagnosisRow): PersistedExecutiveDiagnosis {
  const diagnosis = row.diagnosis as unknown as ExecutiveDiagnosis;
  return {
    id: row.id,
    companyId: row.company_id,
    executionId: row.execution_id,
    diagnosis: diagnosis.id === row.id ? diagnosis : { ...diagnosis, id: row.id },
    providerName: row.provider_name,
    createdAt: row.created_at,
  };
}

/**
 * Repositório canônico de `ExecutiveDiagnosis` (Mission 126 —
 * Executive Decision Persistence Architecture, D-066). Camada de
 * persistência atrás de Application/Infrastructure boundaries —
 * componentes de UI nunca acessam `public.executive_diagnoses`
 * diretamente, sempre por estas funções.
 *
 * Isolamento por empresa garantido pelo RLS de
 * `public.executive_diagnoses` (subquery em `companies`, mesmo padrão
 * de `public.documents`/`public.executions`) — nunca por filtro manual
 * aqui. `diagnosis` é armazenado como o objeto completo (`jsonb`), sem
 * normalização — `ExecutiveDiagnosis` não é um `DomainEntity`, a
 * Application Layer permanece a única fonte de verdade de sua forma
 * interna (mesmo precedente de `ExecutionSnapshot`, D-023).
 *
 * **Imutável após persistido** — nenhuma função de update/delete
 * existe aqui, mesma regra da tabela (sem policy de update/delete).
 */
export async function saveExecutiveDiagnosis(
  companyId: string,
  diagnosis: ExecutiveDiagnosis,
  options: { readonly executionId?: string; readonly providerName?: string } = {}
): Promise<PersistedExecutiveDiagnosis> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("executive_diagnoses")
    .insert({
      // Mission 179 — Executive Decision Center (defeito real
      // encontrado e corrigido). Antes desta correção, `id` era omitido
      // e o Postgres gerava um UUID novo (`gen_random_uuid()`, coluna
      // default) — DIFERENTE de `diagnosis.id` (o id embutido no
      // próprio `ExecutiveDiagnosis`, atribuído por
      // `AnthropicExecutiveAIProvider` via `randomUUID()`). Como
      // `deriveRecommendationGovernanceState()` (Mission 154) compara
      // `decision.basedOnDiagnosisId === diagnosis.id` (o id EMBUTIDO,
      // nunca o id da linha), e `createHumanDecisionAction()` sempre
      // grava `basedOnDiagnosisId` a partir do id da LINHA persistida
      // (`PersistedExecutiveDiagnosis.id`, resolvido via
      // `getExecutiveDiagnosisById()`), os dois nunca coincidiam —
      // nenhuma `Decision` real jamais era encontrada pela governança,
      // mesmo quando genuinamente vinculada. Mesmo padrão já usado por
      // `saveHumanDecision()`/`saveDiagnosisReview()`/`saveKnowledge()`/
      // `saveLearningRecord()` (todos gravam `id` explicitamente a
      // partir do id do próprio objeto de domínio) — `executive_diagnoses`
      // era a única exceção. Corrigido: o id da linha agora É
      // `diagnosis.id`, sempre.
      id: diagnosis.id,
      company_id: companyId,
      execution_id: options.executionId ?? null,
      diagnosis: diagnosis as unknown as Database["public"]["Tables"]["executive_diagnoses"]["Insert"]["diagnosis"],
      provider_name: options.providerName ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toPersisted(data);
}

export async function getExecutiveDiagnosisById(
  id: string
): Promise<PersistedExecutiveDiagnosis | undefined> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("executive_diagnoses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toPersisted(data) : undefined;
}

export async function getExecutiveDiagnosesByCompany(
  companyId: string
): Promise<readonly PersistedExecutiveDiagnosis[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("executive_diagnoses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toPersisted);
}
