import { NextResponse } from "next/server";

/**
 * Mission 200 Closure — Public Internal Error Boundary (D-129).
 *
 * Resposta única das rotas `app/api/efos/**` para uma falha INESPERADA
 * (exceção lançada: banco, Storage, provider, bug): HTTP 500 com um
 * corpo genérico e estável por operação. A mensagem original nunca vai
 * ao cliente — antes, os `catch` devolviam `error.message`, que podia
 * carregar texto do Postgres/Supabase/provider.
 *
 * Erros ESPERADOS de domínio não passam por aqui: identificador
 * malformado (400, D-128), empresa inexistente/não autorizada (404,
 * D-122) e falhas do pipeline (`ApplicationResult` com
 * `success: false`, HTTP 200) continuam com suas respostas específicas.
 *
 * O servidor registra só o necessário para diagnóstico: a operação, o
 * tipo e o código do erro e uma mensagem truncada — nunca stack no
 * corpo da resposta, nunca segredo (as rotas não manipulam senha,
 * token nem chave).
 */
export function internalErrorResponse(operation: string, publicMessage: string, error: unknown) {
  const detail =
    typeof error === "object" && error !== null
      ? (error as { name?: unknown; code?: unknown; message?: unknown })
      : { message: error };

  console.error(
    `[api:${operation}] falha interna inesperada (D-129)`,
    JSON.stringify({
      name: typeof detail.name === "string" ? detail.name : null,
      code: typeof detail.code === "string" ? detail.code : null,
      message: typeof detail.message === "string" ? detail.message.slice(0, 300) : null,
    })
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "unexpected",
        message: publicMessage,
      },
    },
    { status: 500 }
  );
}
