import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  classifyPasswordResetError,
  classifySignupError,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PUBLIC_AUTH_MIN_DURATION_MS,
  safeInternalRedirectPath,
  SIGNUP_NEUTRAL_MESSAGE,
  withMinimumDuration,
} from "@/modules/auth/lib/public-auth-responses";

/**
 * Mission 200 — Non-Enumerating Public Auth Responses (D-127).
 *
 * Antes: `signup()` respondia "Já existe uma conta com este e-mail."
 * para `user_already_exists` OU qualquer 422 — revelando a existência de
 * uma conta (e rotulando errado senha fraca/e-mail inválido). Estas
 * provas travam o contrato: todo desfecho que pode depender da
 * existência da conta produz exatamente a mesma resposta do caminho
 * feliz; só erros que dependem apenas do que o próprio usuário enviou,
 * ou de algo global/por IP, são exibidos.
 */

const ACTIONS_PATH = join(__dirname, "..", "..", "modules", "auth", "actions", "auth.actions.ts");

// Desfechos que o Supabase Auth pode produzir de forma diferente para
// um e-mail com conta e sem conta.
const EXISTENCE_DEPENDENT = [
  { code: "user_already_exists", status: 422 },
  { code: "email_exists", status: 422 },
  { code: "identity_already_exists", status: 422 },
  { code: "over_email_send_rate_limit", status: 429 },
  { code: "unexpected_failure", status: 500 },
  { status: 422 },
  { status: 500 },
];

describe("Mission 200 — signup nunca revela se o e-mail já tem conta (D-127)", () => {
  test("e-mail novo (sem erro) e todo desfecho dependente de existência produzem a MESMA resposta neutra", () => {
    const happy = classifySignupError(null);
    assert.deepEqual(happy, { kind: "neutral" });
    for (const error of EXISTENCE_DEPENDENT) {
      assert.deepEqual(classifySignupError(error), happy, `signup: ${JSON.stringify(error)} deve ser indistinguível do caminho feliz`);
    }
  });

  test("só erros que independem da existência da conta são acionáveis", () => {
    for (const code of ["weak_password", "email_address_invalid", "signup_disabled", "over_request_rate_limit"]) {
      assert.equal(classifySignupError({ code, status: 400 }).kind, "actionable", code);
    }
    assert.equal(classifySignupError({ name: "AuthRetryableFetchError", status: 0 }).kind, "actionable");
  });

  test("senha fraca nunca mais é rotulada como conta existente (antes: todo 422 virava 'Já existe')", () => {
    const outcome = classifySignupError({ code: "weak_password", status: 422 });
    assert.equal(outcome.kind, "actionable");
    if (outcome.kind === "actionable") assert.doesNotMatch(outcome.message, /já existe|conta/i);
  });
});

describe("Mission 200 — recuperação de senha nunca revela se o e-mail tem conta (D-127)", () => {
  test("conta inexistente (sem erro), cooldown por usuário e falha de envio produzem a MESMA resposta neutra", () => {
    const happy = classifyPasswordResetError(null);
    assert.deepEqual(happy, { kind: "neutral" });
    for (const error of EXISTENCE_DEPENDENT) {
      assert.deepEqual(classifyPasswordResetError(error), happy, `reset: ${JSON.stringify(error)}`);
    }
  });

  test("limite por IP, e-mail malformado e serviço inalcançável continuam acionáveis", () => {
    assert.equal(classifyPasswordResetError({ code: "over_request_rate_limit", status: 429 }).kind, "actionable");
    assert.equal(classifyPasswordResetError({ code: "email_address_invalid", status: 400 }).kind, "actionable");
    assert.equal(classifyPasswordResetError({ name: "AuthRetryableFetchError", status: 0 }).kind, "actionable");
  });
});

describe("Mission 200 — as mensagens neutras nunca afirmam o que não sabem", () => {
  test("nenhuma mensagem neutra afirma conta criada, e-mail enviado ou conta existente", () => {
    for (const message of [SIGNUP_NEUTRAL_MESSAGE, PASSWORD_RESET_NEUTRAL_MESSAGE]) {
      assert.match(message, /^Se este e-mail/);
      assert.doesNotMatch(message, /conta criada|enviamos|já existe uma conta|não existe/i);
      assert.match(message, /Não recebeu nada\?/, "sempre orienta o que fazer se nada chegar (falha suprimida nunca vira falso sucesso)");
    }
  });
});

describe("Mission 200 — piso de duração das actions públicas", () => {
  test("uma operação rápida só responde depois do piso, e o resultado é preservado", async () => {
    const startedAt = Date.now();
    const value = await withMinimumDuration(80, async () => "ok");
    assert.equal(value, "ok");
    assert.ok(Date.now() - startedAt >= 75, "a resposta rápida (sem envio de e-mail) não pode ser distinguida pelo tempo");
  });

  test("uma falha também respeita o piso e é propagada", async () => {
    const startedAt = Date.now();
    await assert.rejects(withMinimumDuration(80, async () => { throw new Error("boom"); }), /boom/);
    assert.ok(Date.now() - startedAt >= 75);
  });

  test("o piso das actions públicas é de pelo menos 1s", () => {
    assert.ok(PUBLIC_AUTH_MIN_DURATION_MS >= 1000);
  });
});

describe("Mission 200 — /auth/confirm só redireciona para caminhos internos", () => {
  test("caminhos internos são preservados", () => {
    assert.equal(safeInternalRedirectPath("/dashboard"), "/dashboard");
    assert.equal(safeInternalRedirectPath("/reset-password"), "/reset-password");
    assert.equal(safeInternalRedirectPath("/companies?status=active#x"), "/companies?status=active#x");
  });

  test("qualquer destino que resolveria para outro host cai no padrão", () => {
    for (const next of ["@evil.example", ".evil.example/x", "//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "", null, undefined]) {
      assert.equal(safeInternalRedirectPath(next), "/dashboard", String(next));
    }
  });
});

describe("Mission 200 — as actions usam o contrato (prova de código)", () => {
  const source = readFileSync(ACTIONS_PATH, "utf-8");

  test("a mensagem de conta existente e o mapeamento amplo de 422 não existem mais", () => {
    assert.doesNotMatch(source, /Já existe uma conta/);
    assert.doesNotMatch(source, /status\s*===\s*422/);
    assert.doesNotMatch(source, /user_already_exists/);
  });

  test("signup e recuperação classificam o erro pelo contrato e respeitam o piso de duração", () => {
    assert.match(source, /classifySignupError\(error\)/);
    assert.match(source, /classifyPasswordResetError\(error\)/);
    assert.equal(source.match(/withMinimumDuration\(PUBLIC_AUTH_MIN_DURATION_MS/g)?.length, 2);
    assert.match(source, /SIGNUP_NEUTRAL_MESSAGE/);
    assert.match(source, /PASSWORD_RESET_NEUTRAL_MESSAGE/);
  });

  test("login continua com uma única mensagem genérica para qualquer falha de credencial", () => {
    assert.match(source, /"E-mail ou senha incorretos\."/);
  });

  test("a rota de confirmação usa o redirecionamento interno seguro", () => {
    const confirm = readFileSync(join(__dirname, "..", "..", "app", "auth", "confirm", "route.ts"), "utf-8");
    assert.match(confirm, /safeInternalRedirectPath\(searchParams\.get\("next"\)\)/);
  });
});
