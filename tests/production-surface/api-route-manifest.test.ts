import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Mission 197 — Production Surface & Deployment Closure Gate, Seção 17.
 *
 * Manifesto determinístico da superfície HTTP de API intencionalmente
 * exposta pela NEXO — não um teste de UI, não uma varredura de todas as
 * rotas Next.js (páginas nunca entram aqui, só `app/api/**`). Existe
 * para tornar VISÍVEL a reintrodução acidental de um endpoint
 * financeiro legado/duplicado: se um novo `route.ts` aparecer sob
 * `app/api/` sem entrar nesta lista, o teste falha; se um route.ts
 * canônico desaparecer, o teste também falha — qualquer mudança de
 * superfície precisa passar por uma edição deliberada deste arquivo,
 * nunca silenciosa.
 *
 * Mission 197 removeu `POST /api/efos/upload` e `POST /api/efos/
 * analyze/[companyId]` (sem contexto executivo) — confirmados sem
 * nenhum consumidor real (busca em todo o código-fonte por chamadas
 * client-side) e com garantias mais fracas que o endpoint canônico
 * (Seção 4 da missão). `POST /api/efos/analyze/[companyId]/executive`
 * é agora a ÚNICA porta de entrada HTTP de análise financeira.
 */

const API_ROOT = join(__dirname, "..", "..", "app", "api");

/**
 * Cada entrada é o caminho do `route.ts`, relativo a `app/api/`, com a
 * mesma grafia de pasta dinâmica do Next.js (`[companyId]`) — nunca o
 * caminho de URL resolvido, que este teste não precisa reconstruir.
 */
const CANONICAL_API_ROUTES = [
  "efos/analyze/[companyId]/executive/route.ts",
  "efos/history/[companyId]/route.ts",
] as const;

function findRouteFiles(dir: string, base = ""): string[] {
  const entries = readdirSync(dir);
  const routes: string[] = [];

  for (const entry of entries) {
    if (entry === "_shared") continue; // helpers, nunca uma rota HTTP.

    const fullPath = join(dir, entry);
    const relativePath = base ? `${base}/${entry}` : entry;

    if (statSync(fullPath).isDirectory()) {
      routes.push(...findRouteFiles(fullPath, relativePath));
    } else if (entry === "route.ts") {
      routes.push(relativePath);
    }
  }

  return routes;
}

describe("Mission 197 — Manifesto de rotas de API (app/api/**)", () => {
  test("toda rota route.ts existente no disco está no manifesto canônico, e vice-versa", () => {
    assert.ok(existsSync(API_ROOT), "app/api deve existir");

    const actualRoutes = findRouteFiles(API_ROOT).sort();
    const expectedRoutes = [...CANONICAL_API_ROUTES].sort();

    assert.deepEqual(
      actualRoutes,
      expectedRoutes,
      "Superfície de API divergiu do manifesto canônico — uma rota nova apareceu sem atualização deliberada deste teste, ou uma rota canônica desapareceu inesperadamente. Ver Mission 197, Seção 4/17/18."
    );
  });

  test("nenhuma rota de análise/upload legada (pré-Mission 197) foi reintroduzida", () => {
    const actualRoutes = findRouteFiles(API_ROOT);

    assert.ok(
      !actualRoutes.includes("efos/upload/route.ts"),
      "POST /api/efos/upload foi removido na Mission 197 (sem consumidor real, garantias mais fracas que o endpoint canônico) — nunca deve reaparecer"
    );
    assert.ok(
      !actualRoutes.includes("efos/analyze/[companyId]/route.ts"),
      "POST /api/efos/analyze/[companyId] (sem contexto executivo) foi removido na Mission 197 — nunca deve reaparecer como caminho paralelo ao endpoint canônico `.../executive`"
    );
  });
});
