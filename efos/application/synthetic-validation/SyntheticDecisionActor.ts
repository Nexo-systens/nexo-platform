/**
 * Mission 159 — Synthetic Decision → Outcome → Learning → Knowledge Loop
 * (Etapa 3 — Decisão Humana Sintética).
 *
 * **Achado da auditoria obrigatória**: `createHumanDecision()`
 * (`efos/application/decision-lifecycle/`, Mission 124, D-063) é uma
 * função pura — `humanActorId` é apenas `string`, nunca validado contra
 * Supabase Auth/`auth.users` dentro da Application Layer (a checagem de
 * identidade real, quando existe, vive inteiramente fora do EFOS Core,
 * na Server Action que resolve `getCurrentUser()` antes de montar o
 * `CreateHumanDecisionCommand` — nunca dentro dele). Isso significa que
 * a Regra Fundamental da Etapa 3 ("não burlar identidade Supabase real")
 * nunca chega a ser um risco aqui: nenhuma chamada de rede, nenhuma
 * tabela `auth.users`/`public.profiles`, nenhuma sessão são tocadas por
 * esta constante ou por qualquer código deste diretório.
 *
 * Por isso, a Etapa 3 não exige um novo tipo `SyntheticDecisionActor` —
 * a arquitetura já representa "identidade humana" pelo tipo mais simples
 * possível (`string`), e introduzir uma interface nova só para isso
 * violaria "não duplicação" (a Regra 0 de toda missão desta série) sem
 * nenhum ganho estrutural real. `SYNTHETIC_DECISION_ACTOR_ID` é apenas
 * essa `string`, isolada aqui para que todo o código deste diretório a
 * referencie por um único ponto — nunca um UUID aleatório
 * (`crypto.randomUUID()`), nunca um usuário real do Supabase, nunca
 * persistida em `public.decisions`/`public.decision_execution_events`/
 * `public.outcomes` (esta missão é exclusivamente in-memory — ver
 * README.md, "SYNTHETIC CONTINUOUS LEARNING LOOP").
 */
export const SYNTHETIC_DECISION_ACTOR_ID = "synthetic-validation-decision-actor";
