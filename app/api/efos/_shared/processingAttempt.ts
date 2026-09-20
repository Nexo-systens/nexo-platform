import { randomUUID } from "node:crypto";

import { acquireProcessingAttemptRevision } from "@/modules/documents/services/document.service";

/**
 * Mission 193 Closure B — Database-Authoritative Processing Attempt
 * Ordering.
 *
 * Mission 193 Closure introduziu `attemptId`/`startedAt` (ambos gerados
 * pela aplicação) como autoridade de ordem entre tentativas de
 * processamento concorrentes. Isso se provou insuficiente (Seção 1/3
 * desta missão de fechamento): comparar `startedAt` em TypeScript, e só
 * depois escrever, é sempre um ciclo ler → decidir → escrever em passos
 * separados — uma tentativa "mais antiga" cuja escrita física é
 * atrasada (I/O, agendamento do runtime serverless) pode nunca ter
 * sabido que uma tentativa "mais nova" já havia escrito, e sobrescrevê-la
 * de qualquer forma. Nenhuma comparação em TypeScript resolve isso: o
 * problema é a ausência de uma única instrução atômica no próprio banco.
 *
 * `revision` (novo — `supabase/migrations/20260918120000_document_processing_authority.sql`)
 * é a ÚNICA autoridade de ordem permitida por esta missão: um
 * `bigint` obtido de uma sequence do Postgres (`nextval()`, atômico e
 * estritamente crescente sob qualquer concorrência, por definição do
 * próprio banco) via a RPC `acquire_processing_attempt_revision()`.
 * Obtido UMA VEZ, no início do handler da rota, ANTES de qualquer I/O
 * (download/parse/pipeline) — exatamente como `attemptId`/`startedAt`
 * já eram gerados na Mission 193 Closure. Como a revisão é fixada ANTES
 * do atraso, uma tentativa mais antiga nunca pode obter uma revisão
 * maior que uma criada depois dela, não importa quando sua escrita
 * física aos documentos aconteça — a condição do próprio `UPDATE`
 * (`document.service.ts`) rejeita a escrita atrasada.
 *
 * `attemptId`/`startedAt` permanecem apenas como METADADO DE
 * DIAGNÓSTICO (correlação em logs, inspeção humana da linha) — nunca
 * mais comparados por nenhuma escrita condicional (Seção 3: "attemptStartedAt
 * may remain diagnostic metadata. It must not be the canonical
 * distributed ordering primitive").
 */
export interface ProcessingAttempt {
  readonly attemptId: string;
  readonly startedAt: string;
  readonly revision: number;
}

/**
 * Nova tentativa de processamento — chamada UMA VEZ por requisição, no
 * início do handler da rota, antes de qualquer I/O. `revision` é obtida
 * do banco (única chamada de rede desta função) antes de qualquer
 * download/parse/pipeline subsequente — é essa ordem de OBTENÇÃO,
 * nunca a ordem em que a posse é fisicamente escrita depois, que define
 * "mais nova" (Seção 1 da missão de fechamento).
 */
export async function beginProcessingAttempt(): Promise<ProcessingAttempt> {
  const revision = await acquireProcessingAttemptRevision();
  return { attemptId: randomUUID(), startedAt: new Date().toISOString(), revision };
}

/**
 * Verifica se `myRevision` ainda é EXATAMENTE a revisão ativa — usada
 * para decidir se esta chamada pode finalizar (`processed`/`failed`) o
 * status técnico do documento. Pura — a leitura do valor atual e a
 * comparação real acontecem no próprio filtro do `UPDATE`
 * (`document.service.ts`, `.eq("processing_revision", ...)`, atômico no
 * Postgres); esta função existe para que a MESMA regra seja testável
 * isoladamente (Seção 29 da missão de fechamento).
 */
export function isRevisionCurrent(currentRevision: number, myRevision: number): boolean {
  return currentRevision === myRevision;
}

/**
 * Verifica se uma revisão RECEBIDA (`incomingRevision`) é obsoleta em
 * relação à já persistida (`currentRevision`, `null` quando nenhuma
 * ainda existe) — usada tanto para a posse técnica (Seção 7: uma nova
 * tentativa só avança `processing_revision` se sua revisão for maior)
 * quanto para a governança (Seção 10/11: `governance_revision` segue a
 * mesma regra). `true` significa "não escrever" — a revisão recebida é
 * menor ou igual à já persistida.
 */
export function isRevisionStale(
  currentRevision: number | null,
  incomingRevision: number
): boolean {
  if (currentRevision === null) return false;
  return currentRevision >= incomingRevision;
}
