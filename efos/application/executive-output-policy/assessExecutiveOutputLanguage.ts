import { EXECUTIVE_OUTPUT_PRESERVED_TERMS } from "./ExecutiveOutputPolicy";

/**
 * Mission 206 — verificação de idioma da saída de Executive AI (D-132).
 *
 * Por que existe em runtime (e não só no prompt): o diagnóstico é
 * PERSISTIDO. Sem esta checagem, uma resposta que o modelo decidisse
 * escrever em inglês seria salva e exibida para sempre. Rejeitar aqui
 * usa o caminho de falha que já existe (`VALIDATION_FAILED` → mensagem
 * executiva + nova tentativa), sem nada salvo.
 *
 * Por que não é um "detector de idioma": ela não tenta classificar
 * texto arbitrário. Só procura o padrão inequívoco de uma frase em
 * inglês — palavras funcionais inglesas dominando um campo longo — e é
 * conservadora de propósito:
 * - termos canônicos (`EXECUTIVE_OUTPUT_PRESERVED_TERMS`) e siglas em
 *   maiúsculas (EBITDA, DRE, CPV) são removidos antes da contagem;
 * - palavras que existem nas duas línguas ("a", "as", "do", "no", "for",
 *   "se") não contam para nenhum lado;
 * - campos curtos (menos de 6 palavras) nunca são julgados sozinhos;
 * - um campo só é rejeitado com pelo menos 3 palavras funcionais
 *   inglesas e mais que o dobro das portuguesas; o conjunto, com pelo
 *   menos 4 e mais inglesas que portuguesas.
 */

export interface ExecutiveOutputText {
  /** Caminho legível do campo (ex.: `interpretations[0].statement`). */
  readonly path: string;
  readonly text: string;
}

export interface ExecutiveOutputLanguageAssessment {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ENGLISH_MARKERS = new Set([
  "the", "and", "of", "with", "this", "that", "these", "those", "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had", "which", "would", "should", "could", "will", "can", "may", "might", "must", "not", "its",
  "their", "there", "from", "into", "than", "by", "an", "at", "or", "if", "in", "on", "it", "what", "when", "while",
  "whether", "does", "do", "did", "any", "same", "current", "period", "available", "indicates", "suggests",
]);

// "do" aparece nas duas línguas — removido dos marcadores ingleses abaixo.
ENGLISH_MARKERS.delete("do");

const PORTUGUESE_MARKERS = new Set([
  "de", "da", "das", "dos", "que", "não", "com", "para", "uma", "um", "em", "na", "nas", "nos", "os", "ao", "aos",
  "pelo", "pela", "pelos", "pelas", "mais", "já", "está", "estão", "são", "foi", "ser", "há", "entre", "sobre",
  "quando", "como", "mas", "ou", "também", "sua", "seu", "suas", "seus", "essa", "esse", "este", "esta", "isso",
  "nesta", "neste", "desta", "deste", "pode", "podem", "e", "é", "período", "empresa", "margem", "receita", "caixa",
]);

const MIN_WORDS_PER_FIELD = 6;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRESERVED_PATTERN = new RegExp(
  `\\b(?:${[...EXECUTIVE_OUTPUT_PRESERVED_TERMS].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})\\b`,
  "gi"
);

interface LanguageCounts {
  readonly words: number;
  readonly english: number;
  readonly portuguese: number;
}

export function countLanguageMarkers(text: string): LanguageCounts {
  const withoutPreserved = text.replace(PRESERVED_PATTERN, " ");
  const tokens = withoutPreserved.match(/[\p{L}][\p{L}'-]*/gu) ?? [];
  let words = 0;
  let english = 0;
  let portuguese = 0;
  for (const token of tokens) {
    // Siglas e identificadores (DRE, CPV, CONFIRMED_SIGNAL) não são língua.
    if (/^[\p{Lu}]{2,}$/u.test(token)) continue;
    const word = token.toLowerCase();
    words += 1;
    if (ENGLISH_MARKERS.has(word)) english += 1;
    else if (PORTUGUESE_MARKERS.has(word)) portuguese += 1;
  }
  return { words, english, portuguese };
}

export function assessExecutiveOutputLanguage(texts: readonly ExecutiveOutputText[]): ExecutiveOutputLanguageAssessment {
  const errors: string[] = [];
  let totalEnglish = 0;
  let totalPortuguese = 0;

  for (const { path, text } of texts) {
    const counts = countLanguageMarkers(text);
    totalEnglish += counts.english;
    totalPortuguese += counts.portuguese;
    if (counts.words >= MIN_WORDS_PER_FIELD && counts.english >= 3 && counts.english > counts.portuguese * 2) {
      errors.push(`${path} não está em português do Brasil (pt-BR).`);
    }
  }

  if (errors.length === 0 && totalEnglish >= 4 && totalEnglish > totalPortuguese) {
    errors.push("A resposta, no conjunto, não está em português do Brasil (pt-BR).");
  }

  return { valid: errors.length === 0, errors };
}
