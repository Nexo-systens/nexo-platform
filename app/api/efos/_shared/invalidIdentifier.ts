import { NextResponse } from "next/server";

/**
 * Mission 200 — Canonical External Identifier Validation (D-128).
 *
 * Resposta única das rotas `app/api/efos/**` para um identificador que
 * não é sintaticamente um UUID (`isUuid()`, `lib/identifiers.ts`):
 * `400`, sem consultar o banco, sem stack trace. Distinta de propósito
 * do `404` de "empresa não encontrada ou não autorizada" — a
 * malformação é decidível pelo próprio chamador a partir do texto que
 * enviou, então separar os dois casos nunca revela se um recurso
 * existe; já "inexistente" e "não autorizado" continuam idênticos.
 */
export function invalidIdentifierResponse() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "invalid_identifier",
        message: "Identificador inválido.",
      },
    },
    { status: 400 }
  );
}
