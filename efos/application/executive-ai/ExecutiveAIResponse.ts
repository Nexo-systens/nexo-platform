/**
 * Resposta bruta de um `ExecutiveAIProvider` (Mission 116) —
 * **UNTRUSTED** por construção: `output: unknown`, nunca `unknown as
 * ExecutiveDiagnosis`. Nenhum código de produção deve ler `output`
 * diretamente como um `ExecutiveDiagnosis` confiável — a única rota
 * legítima é `executeExecutiveAnalysis()` (`executeExecutiveAnalysis.ts`),
 * que sempre passa `output` por `validateExecutiveDiagnosis()` (D-059)
 * antes de produzir um `ExecutiveDiagnosis` confiável.
 *
 * `External AI Output ≠ Trusted EFOS Diagnosis` — este tipo existe
 * exatamente para tornar essa fronteira visível no próprio dado: um
 * provider nunca pode retornar `ExecutiveDiagnosis` diretamente,
 * porque essa não é a forma do seu tipo de retorno.
 */
export interface ExecutiveAIResponse {
  readonly providerName: string;
  readonly model?: string;
  readonly output: unknown;
  readonly receivedAt: string;
  /**
   * Motivo bruto de parada reportado pelo provider (ex.: `"tool_use"`,
   * `"max_tokens"`, `"end_turn"`) — Mission 130, campo puramente
   * diagnóstico, nunca usado para decidir se `output` é confiável (essa
   * decisão continua exclusiva de `looksLikeExecutiveDiagnosis()` +
   * `validateExecutiveDiagnosis()`). Existe só para tornar uma falha de
   * extração autoexplicável sem exigir uma nova chamada ao provider
   * para diagnosticar.
   */
  readonly stopReason?: string;
}
