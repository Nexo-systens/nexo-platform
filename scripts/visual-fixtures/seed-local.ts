/**
 * Mission 204 — fixtures visuais LOCAIS e SINTÉTICAS.
 *
 * Cria, numa conta de teste do Supabase LOCAL, três empresas fictícias
 * com documentos no mesmo formato que a ingestão real aceita (texto em
 * português, valores brasileiros, período/data-base). Nada aqui é
 * resultado pronto: a análise, as evidências, o diagnóstico e as decisões
 * são produzidos depois pelo app, pelo caminho de produção (a IA, em modo
 * local, pelos stand-ins determinísticos — ver
 * `lib/ai/executive-ai-providers.ts`).
 *
 * - GAMA Distribuição Sintética: margens em queda por 4 meses, prejuízo
 *   no último, liquidez < 1, endividamento alto, caixa operacional
 *   negativo no extrato — conteúdo rico para análise e decisões.
 * - DELTA Serviços Sintéticos: margens melhorando, balanço saudável.
 * - ÔMEGA Participações Sintética: sem documentos (estado inicial).
 *
 * Cadência mensal: `FIXTURE_THROUGH=2026-05` envia só os documentos até
 * maio; execute a análise no app; repita com 2026-06, 2026-07 e 2026-08.
 * Assim o histórico de análises (trajetória, comparação, deterioração
 * sustentada) nasce como nasceria em produção. Sem a variável, envia tudo.
 *
 * Uso (somente com o Supabase local no ar):
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon local> \
 *   FIXTURE_EMAIL=<conta local> FIXTURE_PASSWORD=<senha local> \
 *   npx tsx scripts/visual-fixtures/seed-local.ts
 *
 * Recusa qualquer host que não seja 127.0.0.1/localhost. Nunca use contra
 * o NEXO Pilot. Idempotente por CNPJ (empresa existente é reaproveitada;
 * documento com o mesmo nome não é reenviado).
 */
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];

interface FixtureDocument {
  readonly name: string;
  /** Mês de referência (AAAA-MM) — o estágio sobe um mês por vez, como na vida real. */
  readonly month: string;
  readonly categoria: "dre" | "balanco_patrimonial" | "extrato_bancario";
  readonly lines: readonly string[];
}

interface FixtureCompany {
  readonly company: Omit<CompanyInsert, "user_id" | "cnpj">;
  readonly cnpjBase: string;
  readonly documents: readonly FixtureDocument[];
}

/** CNPJ sintético com dígitos verificadores válidos (base de 12 dígitos). */
export function syntheticCnpj(base12: string): string {
  const digits = base12.split("").map(Number);
  const dv = (weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  digits.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  digits.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return digits.join("");
}

function dre(month: string, lastDay: string, rows: readonly string[]): readonly string[] {
  return ["Demonstração do Resultado do Exercício", `Período: 01/${month}/2026 a ${lastDay}/${month}/2026`, ...rows];
}

export const VISUAL_FIXTURES: readonly FixtureCompany[] = [
  {
    cnpjBase: "482716530001",
    company: {
      razao_social: "GAMA Distribuição Sintética Ltda.",
      nome_fantasia: "Gama Sintética",
      segmento: "Distribuição atacadista",
      regime_tributario: "lucro_real",
      porte: "media",
      observacoes: "Empresa fictícia — fixture visual local (Mission 204).",
    },
    documents: [
      {
        name: "dre-maio-2026-gama.csv",
        month: "2026-05",
        categoria: "dre",
        lines: dre("05", "31", [
          "Receita Bruta de Vendas R$ 1.000.000,00",
          "Impostos sobre Vendas (R$ 90.000,00)",
          "Receita Líquida de Vendas R$ 910.000,00",
          "Custo dos Produtos Vendidos (R$ 560.000,00)",
          "Lucro Bruto R$ 350.000,00",
          "Despesas com Vendas (R$ 110.000,00)",
          "Despesas Administrativas (R$ 90.000,00)",
          "Total de Despesas Operacionais (R$ 200.000,00)",
          "Receitas Financeiras R$ 5.000,00",
          "Despesas Financeiras (R$ 40.000,00)",
          "IRPJ (R$ 20.000,00)",
          "CSLL (R$ 12.000,00)",
          "Lucro Líquido do Exercício R$ 83.000,00",
        ]),
      },
      {
        name: "dre-junho-2026-gama.csv",
        month: "2026-06",
        categoria: "dre",
        lines: dre("06", "30", [
          "Receita Bruta de Vendas R$ 1.080.000,00",
          "Impostos sobre Vendas (R$ 97.200,00)",
          "Receita Líquida de Vendas R$ 982.800,00",
          "Custo dos Produtos Vendidos (R$ 640.000,00)",
          "Lucro Bruto R$ 342.800,00",
          "Despesas com Vendas (R$ 125.000,00)",
          "Despesas Administrativas (R$ 95.000,00)",
          "Total de Despesas Operacionais (R$ 220.000,00)",
          "Receitas Financeiras R$ 4.000,00",
          "Despesas Financeiras (R$ 52.000,00)",
          "IRPJ (R$ 12.000,00)",
          "CSLL (R$ 7.000,00)",
          "Lucro Líquido do Exercício R$ 55.800,00",
        ]),
      },
      {
        name: "dre-julho-2026-gama.csv",
        month: "2026-07",
        categoria: "dre",
        lines: dre("07", "31", [
          "Receita Bruta de Vendas R$ 1.150.000,00",
          "Impostos sobre Vendas (R$ 103.500,00)",
          "Receita Líquida de Vendas R$ 1.046.500,00",
          "Custo dos Produtos Vendidos (R$ 720.000,00)",
          "Lucro Bruto R$ 326.500,00",
          "Despesas com Vendas (R$ 140.000,00)",
          "Despesas Administrativas (R$ 102.000,00)",
          "Total de Despesas Operacionais (R$ 242.000,00)",
          "Receitas Financeiras R$ 3.000,00",
          "Despesas Financeiras (R$ 66.000,00)",
          "IRPJ (R$ 4.000,00)",
          "CSLL (R$ 2.500,00)",
          "Lucro Líquido do Exercício R$ 15.000,00",
        ]),
      },
      {
        name: "dre-agosto-2026-gama.csv",
        month: "2026-08",
        categoria: "dre",
        lines: dre("08", "31", [
          "Receita Bruta de Vendas R$ 1.210.000,00",
          "Impostos sobre Vendas (R$ 108.900,00)",
          "Receita Líquida de Vendas R$ 1.101.100,00",
          "Custo dos Produtos Vendidos (R$ 800.000,00)",
          "Lucro Bruto R$ 301.100,00",
          "Despesas com Vendas (R$ 158.000,00)",
          "Despesas Administrativas (R$ 110.000,00)",
          "Total de Despesas Operacionais (R$ 268.000,00)",
          "Receitas Financeiras R$ 2.000,00",
          "Despesas Financeiras (R$ 82.000,00)",
          "Lucro Líquido do Exercício (R$ 46.900,00)",
        ]),
      },
      {
        name: "balanco-julho-2026-gama.csv",
        month: "2026-07",
        categoria: "balanco_patrimonial",
        lines: [
          "Balanço Patrimonial",
          "Data-base: 31/07/2026",
          "Caixa e Equivalentes de Caixa R$ 95.000,00",
          "Clientes R$ 540.000,00",
          "Estoques R$ 300.000,00",
          "Imobilizado R$ 600.000,00",
          "Fornecedores R$ 470.000,00",
          "Empréstimos R$ 600.000,00",
          "Patrimônio Líquido R$ 465.000,00",
        ],
      },
      {
        name: "balanco-agosto-2026-gama.csv",
        month: "2026-08",
        categoria: "balanco_patrimonial",
        lines: [
          "Balanço Patrimonial",
          "Data-base: 31/08/2026",
          "Caixa e Equivalentes de Caixa R$ 48.000,00",
          "Clientes R$ 610.000,00",
          "Estoques R$ 342.000,00",
          "Imobilizado R$ 600.000,00",
          "Fornecedores R$ 540.000,00",
          "Empréstimos R$ 680.000,00",
          "Patrimônio Líquido R$ 380.000,00",
        ],
      },
      {
        name: "extrato-agosto-2026-gama.csv",
        month: "2026-08",
        categoria: "extrato_bancario",
        lines: [
          "Extrato Bancário — Conta Corrente",
          "05/08/2026 Recebimento de Cliente R$ 210.000,00",
          "08/08/2026 Pagamento a Fornecedor R$ 265.000,00",
          "19/08/2026 Recebimento de Cliente R$ 180.000,00",
          "22/08/2026 Pagamento a Fornecedor R$ 240.000,00",
          "28/08/2026 Pagamento de Juros de Empréstimo R$ 41.000,00",
        ],
      },
    ],
  },
  {
    cnpjBase: "317904260001",
    company: {
      razao_social: "DELTA Serviços Sintéticos S.A.",
      nome_fantasia: "Delta Sintética",
      segmento: "Serviços B2B",
      regime_tributario: "lucro_presumido",
      porte: "pequena",
      observacoes: "Empresa fictícia — fixture visual local (Mission 204).",
    },
    documents: [
      {
        name: "dre-junho-2026-delta.csv",
        month: "2026-06",
        categoria: "dre",
        lines: dre("06", "30", [
          "Receita Bruta de Vendas R$ 420.000,00",
          "Impostos sobre Vendas (R$ 37.800,00)",
          "Receita Líquida de Vendas R$ 382.200,00",
          "Custo dos Serviços Prestados (R$ 190.000,00)",
          "Lucro Bruto R$ 192.200,00",
          "Despesas Administrativas (R$ 95.000,00)",
          "Total de Despesas Operacionais (R$ 95.000,00)",
          "Lucro Líquido do Exercício R$ 97.200,00",
        ]),
      },
      {
        name: "dre-julho-2026-delta.csv",
        month: "2026-07",
        categoria: "dre",
        lines: dre("07", "31", [
          "Receita Bruta de Vendas R$ 455.000,00",
          "Impostos sobre Vendas (R$ 40.950,00)",
          "Receita Líquida de Vendas R$ 414.050,00",
          "Custo dos Serviços Prestados (R$ 196.000,00)",
          "Lucro Bruto R$ 218.050,00",
          "Despesas Administrativas (R$ 97.000,00)",
          "Total de Despesas Operacionais (R$ 97.000,00)",
          "Lucro Líquido do Exercício R$ 121.050,00",
        ]),
      },
      {
        name: "dre-agosto-2026-delta.csv",
        month: "2026-08",
        categoria: "dre",
        lines: dre("08", "31", [
          "Receita Bruta de Vendas R$ 490.000,00",
          "Impostos sobre Vendas (R$ 44.100,00)",
          "Receita Líquida de Vendas R$ 445.900,00",
          "Custo dos Serviços Prestados (R$ 201.000,00)",
          "Lucro Bruto R$ 244.900,00",
          "Despesas Administrativas (R$ 99.000,00)",
          "Total de Despesas Operacionais (R$ 99.000,00)",
          "Lucro Líquido do Exercício R$ 145.900,00",
        ]),
      },
      {
        name: "balanco-agosto-2026-delta.csv",
        month: "2026-08",
        categoria: "balanco_patrimonial",
        lines: [
          "Balanço Patrimonial",
          "Data-base: 31/08/2026",
          "Caixa e Equivalentes de Caixa R$ 380.000,00",
          "Clientes R$ 260.000,00",
          "Estoques R$ 20.000,00",
          "Fornecedores R$ 110.000,00",
          "Empréstimos R$ 90.000,00",
          "Patrimônio Líquido R$ 460.000,00",
        ],
      },
    ],
  },
  {
    cnpjBase: "605218940001",
    company: {
      razao_social: "ÔMEGA Participações Sintética Ltda.",
      nome_fantasia: "Ômega Sintética",
      segmento: "Holding",
      regime_tributario: "lucro_presumido",
      porte: "pequena",
      observacoes: "Empresa fictícia — fixture visual local (Mission 204). Sem documentos de propósito.",
    },
    documents: [],
  },
];

function requireLocal(url: string | undefined): string {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL é obrigatório.");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Recusado: fixtures visuais só rodam contra o Supabase local (host atual: ${host}).`);
  }
  return url;
}

async function main() {
  const url = requireLocal(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.FIXTURE_EMAIL;
  const password = process.env.FIXTURE_PASSWORD;
  if (!anonKey || !email || !password) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_ANON_KEY, FIXTURE_EMAIL e FIXTURE_PASSWORD (conta de teste LOCAL).");
  }

  const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !auth.user) throw authError ?? new Error("Falha ao autenticar a conta local.");

  for (const fixture of VISUAL_FIXTURES) {
    const cnpj = syntheticCnpj(fixture.cnpjBase);
    const { data: existing, error: findError } = await supabase
      .from("companies")
      .select("id")
      .eq("cnpj", cnpj)
      .is("deleted_at", null)
      .maybeSingle();
    if (findError) throw findError;

    let companyId = existing?.id;
    if (!companyId) {
      const { data: created, error } = await supabase
        .from("companies")
        .insert({ ...fixture.company, cnpj, user_id: auth.user.id })
        .select("id")
        .single();
      if (error) throw error;
      companyId = created.id;
    }

    const { data: present, error: presentError } = await supabase
      .from("documents")
      .select("nome_original")
      .eq("company_id", companyId)
      .is("deleted_at", null);
    if (presentError) throw presentError;
    const presentNames = new Set((present ?? []).map((row) => row.nome_original));

    const through = process.env.FIXTURE_THROUGH;
    const staged = fixture.documents.filter((document) => !through || document.month <= through);
    for (const document of staged) {
      if (presentNames.has(document.name)) continue;
      const content = `${document.lines.join("\n")}\n`;
      const documentId = randomUUID();
      const storagePath = `company/${companyId}/${documentId}/${document.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, new Blob([content], { type: "text/csv" }), { contentType: "text/csv" });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("documents").insert({
        id: documentId,
        company_id: companyId,
        nome_original: document.name,
        nome_armazenado: document.name,
        categoria: document.categoria,
        tipo_arquivo: "csv",
        tamanho_bytes: Buffer.byteLength(content),
        storage_path: storagePath,
        hash_arquivo: createHash("sha256").update(content).digest("hex"),
      });
      if (insertError) throw insertError;
    }
    console.log(`${fixture.company.razao_social}: ${staged.length} de ${fixture.documents.length} documento(s) sintético(s) enviados até ${through ?? "o fim"}.`);
  }

  console.log("Pronto. Execute a análise de cada empresa pelo app (Análise → Executar análise).");
}

if (process.argv[1] && /seed-local\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
