# executive-output-policy

Mission 206 — Executive AI Output Governance & pt-BR (D-132).

Política canônica de **saída** de toda capability de Executive AI da NEXO. É regra de produto, acima de qualquer provider: um adapter renderiza a política no formato do seu SDK, mas nunca decide idioma, tom ou como um número é citado.

## O que define

- `EXECUTIVE_OUTPUT_LANGUAGE = "pt-BR"` — idioma obrigatório de todo texto destinado ao usuário final. Exceções: nomes canônicos do produto, siglas, nomes próprios e os enums/ids exigidos pelo schema (`EXECUTIVE_OUTPUT_PRESERVED_TERMS`).
- `EXECUTIVE_OUTPUT_POLICY_CODES` — sete invariantes comuns: idioma, tom executivo, terminologia financeira brasileira, citar números canônicos sem calcular, indisponível nunca vira número, hipótese como possibilidade, ação como sugestão. As descrições existem só aqui.
- `describeExecutiveOutputLanguage()` e `EXECUTIVE_OUTPUT_TOOL_LANGUAGE_NOTE` — o mesmo texto para os prompts e as descrições de tool de todos os adapters.

## Como cada capability herda

1. `outputLanguage` estrutural na instrução (`ExecutiveAIInstruction`, `ExecutiveChatInstruction`), exigido pelo validator da instrução.
2. Os códigos comuns entram no mesmo vocabulário fechado de constraints (o Chat os reaproveita pelo código, como os demais).
3. A composição (`executeExecutiveAnalysis`, `executeExecutiveChatAnalysis`) chama `validateExecutiveOutputGovernance()` depois do schema e das referências, antes de persistir ou exibir.

## Garantia em runtime

- **Idioma** (`assessExecutiveOutputLanguage`): rejeita um campo longo dominado por palavras funcionais inglesas, ou o conjunto. Ignora termos preservados, siglas e campos curtos. Não é um detector de idioma genérico; existe porque o diagnóstico é persistido.
- **Números** (`assessExecutiveFigureFidelity`): toda figura com unidade (R$, %, p.p.) ou casas decimais precisa existir no contexto (tolerância de uma unidade na última casa exibida); sinal não pode ser trocado junto ao nome do indicador; indicador indisponível nunca aparece com número. No Chat, a pergunta, o histórico e os parâmetros estruturados das ações também são fontes permitidas.

Uma rejeição usa o caminho de falha existente (`VALIDATION_FAILED` → mensagem executiva, detalhe recolhido, nova tentativa pelo usuário; nenhuma chamada automática a mais). `countExecutiveOutputViolations()` alimenta um log com contagens por categoria, nunca conteúdo.

## Fora daqui

Schema estrito das tools (inalterado — limite de gramática, D-068/D-069), lógica de proveniência (validators de referência), ações governadas do Chat (D-104/D-105) e a confiança (`low`/`medium`/`high`, autoavaliação categórica do modelo, sem percentual).
