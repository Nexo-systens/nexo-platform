import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { companyFormDataToInput } from "@/modules/companies/utils/company-form-data";
import { companyFormSchema } from "@/modules/companies/validators/company.schemas";

/**
 * Mission 201 — Founding Company Final Go-Live Gate.
 *
 * Achado no smoke test ao vivo: criar uma empresa sem escolher
 * "Regime tributário"/"Porte" (selects opcionais) falhava em silêncio.
 * `CompanyFormSheet` envia "" para selects não escolhidos, o schema
 * aceita esses campos só como ausentes, e a Server Action devolvia
 * `fieldErrors` que o formulário não exibe. É o passo 1 do onboarding.
 */

/** Exatamente o que `CompanyFormSheet.onSubmit()` monta. */
function formDataLikeCompanyFormSheet(overrides: Record<string, string> = {}): FormData {
  const values: Record<string, string> = {
    razaoSocial: "Empresa Sintética LTDA",
    nomeFantasia: "",
    cnpj: "11222333000181",
    regimeTributario: "",
    cnae: "",
    segmento: "",
    porte: "",
    dataAbertura: "",
    observacoes: "",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  return formData;
}

describe("Mission 201 — empresa pode ser criada sem os selects opcionais", () => {
  test("Regime tributário e Porte vazios são aceitos como 'não informado'", () => {
    const parsed = companyFormSchema.safeParse(companyFormDataToInput(formDataLikeCompanyFormSheet()));
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.flatten().fieldErrors));
    if (!parsed.success) return;
    assert.equal(parsed.data.regimeTributario, undefined);
    assert.equal(parsed.data.porte, undefined);
  });

  test("valores escolhidos continuam preservados", () => {
    const parsed = companyFormSchema.safeParse(
      companyFormDataToInput(formDataLikeCompanyFormSheet({ regimeTributario: "lucro_real", porte: "media" }))
    );
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.regimeTributario, "lucro_real");
    assert.equal(parsed.data.porte, "media");
  });

  test("valor fora da lista continua rejeitado", () => {
    const parsed = companyFormSchema.safeParse(
      companyFormDataToInput(formDataLikeCompanyFormSheet({ regimeTributario: "inventado" }))
    );
    assert.equal(parsed.success, false);
  });

  test("campos obrigatórios não são afetados: razão social vazia continua com a mensagem própria", () => {
    const parsed = companyFormSchema.safeParse(companyFormDataToInput(formDataLikeCompanyFormSheet({ razaoSocial: "" })));
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.deepEqual(parsed.error.flatten().fieldErrors.razaoSocial, ["Informe a razão social."]);
  });

  test("criação e edição usam a mesma normalização", () => {
    const actions = readFileSync(join(__dirname, "..", "..", "modules", "companies", "actions", "company.actions.ts"), "utf-8");
    assert.equal(actions.match(/companyFormSchema\.safeParse\(companyFormDataToInput\(formData\)\)/g)?.length, 2);
    assert.doesNotMatch(actions, /safeParse\(Object\.fromEntries\(formData\)\)/);
  });
});
