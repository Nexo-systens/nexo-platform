import type {
  FinancialEventType,
  ResourceType,
} from "@/efos/domain";
import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import {
  DATE_DMY_PATTERN,
  DATE_ISO_PATTERN,
  detectAmountAndCurrency,
} from "./detectMonetaryAmount";
import type { FinancialLineClassifier } from "./FinancialLineClassifier";

/**
 * Palavras-chave (português, minúsculas, sem acento) associadas a cada
 * `FinancialEventType` — a primeira que aparecer na linha vence.
 * Vocabulário básico e determinístico, não um parser de DRE/Balanço.
 *
 * Desde a Mission 075 (Financial Event Classification Precedence
 * Decision, D-040): `payment`/`receipt` foram movidos para o final da
 * tabela, depois de todos os demais tipos. `payment`/`receipt` são os
 * únicos dois `FinancialEventType` cujo vocabulário é puramente
 * genérico de direção de fluxo ("pago"/"recebido" — aplicável a
 * receber/pagar QUALQUER coisa), sem especificar a natureza da
 * operação; todos os demais tipos (`sale`/`purchase`/`hiring`/
 * `termination`/`financing`/`renegotiation`/`delinquency`/
 * `investment`) têm vocabulário que já nomeia a natureza específica da
 * operação (`"financiamento"`, `"investimento"`, `"contratacao"` etc.)
 * — a mesma distinção que já existe implicitamente em D-004/
 * Evidence Engine (`OPERATING_CASH_INFLOW_EVENT_TYPES`/`OUTFLOW`
 * sempre parear `sale`+`receipt` e `purchase`+`payment`: `receipt`/
 * `payment` funcionam como a contraparte genérica de direção de
 * `sale`/`purchase`, nunca como categorias mais específicas que um
 * tipo de natureza já nomeada). Colocar os dois por último garante que
 * um tipo de natureza específica (ex.: `financing`) sempre vença sobre
 * `payment`/`receipt` quando ambos aparecem na mesma linha (ex.:
 * `"financiamento recebido"` → `financing`, não `receipt`) — sem
 * alterar a prioridade relativa entre `sale`/`purchase` (que já
 * precediam `payment`/`receipt`, comportamento preservado) nem entre
 * quaisquer outros dois tipos de natureza específica.
 */
const EVENT_TYPE_KEYWORDS: ReadonlyArray<readonly [FinancialEventType, readonly string[]]> = [
  ["sale", ["venda", "vendas", "faturamento"]],
  ["purchase", ["compra", "compras", "aquisicao"]],
  ["hiring", ["contratacao", "admissao"]],
  ["termination", ["demissao", "rescisao", "desligamento"]],
  ["financing", ["financiamento"]],
  ["renegotiation", ["renegociacao"]],
  ["delinquency", ["inadimplencia", "atraso", "vencido"]],
  ["investment", ["investimento", "aporte"]],
  // Mission 111 — Interest Expense & Interest Coverage Intelligence,
  // D-057: vocabulário deliberadamente restrito a termos que só podem
  // significar juros — nunca "despesa financeira"/"encargos
  // financeiros"/"tarifas financeiras" (categorias contábeis mais
  // amplas, que também cobrem IOF/tarifas bancárias/outros encargos —
  // incluí-las arriscaria contar algo que não é juros como se fosse,
  // exatamente a invenção de precisão que a missão proíbe) e nunca
  // "emprestimo"/"financiamento"/"amortizacao"/"principal" (Etapa 4:
  // pagamento de empréstimo nunca é assumido como juros — continua
  // classificado como `payment`/`financing`, comportamento
  // preservado). Precede `payment`/`receipt` na tabela, mesmo
  // princípio de D-040: vocabulário de natureza específica sempre
  // vence sobre o vocabulário genérico de direção de fluxo.
  ["interest_expense", ["juros", "interest expense", "loan interest"]],
  ["payment", ["pagamento", "pago", "paga"]],
  ["receipt", ["recebimento", "recebido", "receita"]],
];

/**
 * Palavras-chave (português, minúsculas, sem acento) associadas a cada
 * `ResourceType` — a primeira que aparecer na linha vence.
 */
const RESOURCE_TYPE_KEYWORDS: ReadonlyArray<readonly [ResourceType, readonly string[]]> = [
  ["cash", ["caixa", "saldo em conta", "conta corrente"]],
  ["client", ["cliente", "clientes"]],
  ["employee", ["funcionario", "funcionarios", "colaborador", "colaboradores", "salario"]],
  ["supplier", ["fornecedor", "fornecedores"]],
  ["inventory", ["estoque"]],
  ["loan", ["emprestimo", "financiamento bancario"]],
  ["investment", ["investimento", "aplicacao financeira"]],
  ["contract", ["contrato"]],
  ["asset", ["ativo", "imobilizado"]],
  ["product", ["produto", "produtos"]],
  ["service", ["servico", "servicos"]],
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function findKeywordMatch<TValue extends string>(
  normalizedLabel: string,
  keywordTable: ReadonlyArray<readonly [TValue, readonly string[]]>
): TValue | undefined {
  for (const [value, keywords] of keywordTable) {
    if (keywords.some((keyword) => normalizedLabel.includes(keyword))) {
      return value;
    }
  }

  return undefined;
}

function detectDate(label: string): string | undefined {
  const isoMatch = DATE_ISO_PATTERN.exec(label);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dmyMatch = DATE_DMY_PATTERN.exec(label);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return undefined;
}

function classifyLine(line: RawFinancialLine): RawFinancialLine {
  const normalizedLabel = normalize(line.label);

  const eventTypeHint = findKeywordMatch(normalizedLabel, EVENT_TYPE_KEYWORDS);
  const resourceTypeHint = findKeywordMatch(
    normalizedLabel,
    RESOURCE_TYPE_KEYWORDS
  );

  // Uma linha que descreve uma transação (evento) é priorizada sobre
  // um recurso apenas mencionado dentro dela — uma linha de saldo
  // estático ("Caixa R$ 10.000,00") não menciona nenhum evento.
  const kindHint = eventTypeHint ? "event" : resourceTypeHint ? "resource" : undefined;

  const { amount, currency } = detectAmountAndCurrency(line.label);
  const date = detectDate(line.label);

  return {
    ...line,
    ...(amount !== undefined ? { amount } : {}),
    ...(currency ? { currency } : {}),
    ...(date ? { date } : {}),
    ...(kindHint ? { kindHint } : {}),
    ...(resourceTypeHint ? { resourceTypeHint } : {}),
    ...(eventTypeHint ? { eventTypeHint } : {}),
  };
}

/**
 * Primeira implementação concreta de `FinancialLineClassifier`
 * (Mission 046 — Financial Line Classification). Classificação
 * puramente sintática, linha a linha, baseada em palavras-chave
 * (português, sem acento) e padrões de valor/data — nenhuma IA, LLM
 * ou OCR; nenhuma regra financeira/contábil (isso continua
 * pertencendo exclusivamente aos Builders dos Engines).
 *
 * `classify()` nunca modifica `documentId`/`companyId`/`source`, nem
 * o texto original de `label` — apenas acrescenta campos já previstos
 * pelo contrato de `RawFinancialLine` quando detectáveis com certeza;
 * um campo permanece ausente quando a linha não permite uma
 * inferência inequívoca (nunca inventa dado).
 *
 * `period` (mencionado no objetivo da missão) não é um campo de
 * `RawFinancialLine` (`efos/engines/data/data.types.ts`) — o contrato
 * do Data Engine é imutável nesta missão ("Não alterar: Engines").
 * Quando uma linha menciona um período completo com dia explícito
 * (`dd/mm/yyyy`, `yyyy-mm-dd`), ele é normalizado para `date`; um
 * período sem dia (ex.: "Janeiro/2026") não é representável sem
 * inventar um dia, então permanece apenas no texto original de
 * `label`, nunca sintetizado em `date`.
 *
 * Desde a Mission 071 (BRL Currency Normalization Correction),
 * `R$`/`r$` (qualquer combinação de maiúscula/minúscula do `R`) são
 * reconhecidos como o mesmo símbolo de moeda, sempre normalizado para
 * `"BRL"` — corrige o bug em que `r$` minúsculo produzia `"USD"`
 * (descoberto na Mission 047, reconfirmado na Mission 070). Nenhuma
 * outra moeda (`US$`/`$`/`€`) teve seu reconhecimento alterado.
 */
export class DefaultFinancialLineClassifier implements FinancialLineClassifier {
  classify(document: RawFinancialDocument): RawFinancialDocument {
    return {
      ...document,
      lines: document.lines.map((line) => classifyLine(line)),
    };
  }
}
