import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SitePage from "@/app/(site)/page";
import { CONVERSATION_ANCHOR, resolveContactChannel, resolveSiteUrl } from "@/modules/site/lib/site-config";
import { buildSiteMetadata, SITE_OG_IMAGE } from "@/modules/site/lib/site-metadata";

/**
 * Mission 205 — página institucional e comercial em `/`.
 *
 * Fixa: rota pública e estática (sem leitura de sessão), CTAs reais
 * (login e canal comercial configurável, nunca um contato inventado),
 * âncoras que existem, metadata segura antes do domínio definitivo e o
 * "truth test" — nenhum selo, estatística, cliente, preço ou dado real.
 * As decisões de rota do proxy (`/` público, autenticado → `/dashboard`)
 * estão em `session-cookie-redirects.test.ts`.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function renderSite(env: Record<string, string | undefined> = {}) {
  const keys = ["NEXT_PUBLIC_NEXO_CONTACT_URL", "NEXT_PUBLIC_SITE_URL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return renderToStaticMarkup(createElement(SitePage));
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

/** Texto visível aproximado: sem tags, sem o conteúdo dos quadros de produto. */
function textOutsideFrames(html: string) {
  return html
    .replace(/<figure[\s\S]*?<\/figure>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
}

describe("Mission 205 — rota pública", () => {
  test("`/` é a página institucional do grupo (site); a raiz antiga que redirecionava não existe mais", () => {
    assert.ok(existsSync(join(process.cwd(), "app/(site)/page.tsx")));
    assert.ok(!existsSync(join(process.cwd(), "app/page.tsx")), "nenhuma segunda página em /");
  });

  test("a página é estática: não lê sessão, cookies nem cabeçalhos — nenhum redirect de auth nasce dela", () => {
    const page = read("app/(site)/page.tsx");
    assert.doesNotMatch(page, /getCurrentUser|cookies\(|headers\(|redirect\(|supabase/i);
    assert.doesNotMatch(page, /export const dynamic/);
  });

  test("Server Components de ponta a ponta: a única ilha client é o menu móvel", () => {
    const dir = join(process.cwd(), "modules/site/components");
    const clients = readdirSync(dir).filter((file) => /^"use client"/.test(readFileSync(join(dir, file), "utf8")));
    assert.deepEqual(clients, ["SiteMobileNav.tsx"]);
    assert.doesNotMatch(read("app/(site)/page.tsx"), /^"use client"/);
  });

  test("CSS e fonte do site ficam no grupo (site) — o produto não carrega nada da landing", () => {
    assert.match(read("app/(site)/layout.tsx"), /import "\.\/site\.css"/);
    assert.doesNotMatch(read("app/layout.tsx"), /site\.css|Newsreader/);
    assert.doesNotMatch(read("app/globals.css"), /site\.css/);
  });

  test("movimento respeita prefers-reduced-motion e não usa JavaScript", () => {
    const css = read("app/(site)/site.css");
    const reveal = css.indexOf(".site-reveal");
    assert.ok(reveal > css.indexOf("@media (prefers-reduced-motion: no-preference)"), "revelação só sem redução de movimento");
    assert.match(css, /animation-timeline: view\(\)/);
  });
});

describe("Mission 205 — conteúdo renderizado", () => {
  const html = renderSite();

  test("um único h1 com a tese canônica e a categoria explicada", () => {
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
    assert.match(html, /<h1[^>]*>Inteligência financeira para administrar empresas\.<\/h1>/);
    assert.match(html, /Executive Financial Operating System/);
    assert.match(html, /A NEXO é o\s+sistema que a implementa/, "EFOS é a categoria; NEXO é o produto (REGRA 14)");
  });

  test("landmarks e pular para o conteúdo", () => {
    assert.match(html, /<header[\s>]/);
    assert.match(html, /<main id="conteudo"/);
    assert.match(html, /<footer[\s>]/);
    assert.match(html, /href="#conteudo"[^>]*>Pular para o conteúdo/);
  });

  test("toda âncora interna aponta para um id existente", () => {
    const anchors = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]))];
    assert.ok(anchors.length >= 10);
    const missing = anchors.filter((id) => !html.includes(`id="${id}"`));
    assert.deepEqual(missing, []);
  });

  test("links de saída da página: só o login e a própria raiz", () => {
    const outbound = [...new Set([...html.matchAll(/href="([^"#][^"]*)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(outbound, ["/", "/login"]);
  });

  test("sem canal configurado, o CTA comercial leva à seção de conversa e nenhum contato é exibido", () => {
    assert.match(html, new RegExp(`href="${CONVERSATION_ANCHOR}"[^>]*>Conversar sobre a NEXO`));
    assert.match(html, /Nesta fase, a NEXO conversa diretamente com as empresas convidadas/);
    assert.doesNotMatch(html, /href="(mailto:|https?:)/, "nenhum destino de contato inventado");
  });

  test("com canal configurado, os CTAs abrem o canal; link externo em nova aba com rel seguro", () => {
    const withMail = renderSite({ NEXT_PUBLIC_NEXO_CONTACT_URL: "mailto:contato@example.test" });
    assert.match(withMail, /href="mailto:contato@example\.test"[^>]*>Conversar sobre a NEXO/);
    assert.match(withMail, /href="mailto:contato@example\.test"[^>]*>Quero conhecer o programa/);

    const withLink = renderSite({ NEXT_PUBLIC_NEXO_CONTACT_URL: "https://agenda.example.test/nexo" });
    assert.match(withLink, /href="https:\/\/agenda\.example\.test\/nexo"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });

  test("todo quadro de produto se declara com dados fictícios e tem legenda acessível", () => {
    const figures = html.match(/<figure[\s\S]*?<\/figure>/g) ?? [];
    assert.ok(figures.length >= 7);
    for (const figure of figures) {
      assert.match(figure, /Dados fictícios/);
      assert.match(figure, /<figcaption class="sr-only">[^<]*Exemplo com dados fictícios\.<\/figcaption>/);
      assert.doesNotMatch(figure, /<(a|button|input)[\s>]/, "nada dentro do quadro é focável");
    }
  });

  test("menu móvel acessível: botão com aria-expanded/aria-controls ligado ao painel", () => {
    const button = html.match(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"/);
    assert.ok(button, "botão do menu");
    assert.match(html, new RegExp(`id="${button[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" hidden=""`));
  });
});

describe("Mission 205 — truth test", () => {
  const html = renderSite();
  const text = textOutsideFrames(html);

  test("nenhum selo, certificação ou superlativo de segurança", () => {
    assert.doesNotMatch(html, /bank[- ]grade|military|militar|100% segur|LGPD|ISO ?27001|SOC ?2|certificad[oa] (de|em) segurança|criptografia de ponta/i);
  });

  test("nenhum buzzword proibido pela missão", () => {
    assert.doesNotMatch(html, /revolucion|disrupt|game.?changer|poder da IA|transforme (seu|o seu) negócio|para sempre/i);
  });

  test("nenhuma prova social, preço, plano ou teste grátis inventados", () => {
    assert.doesNotMatch(html, /depoimento|clientes satisfeitos|empresas confiam|investidores|prêmio|NPS|ROI de|economia de R\$|\/mês|por mês|teste grátis|free trial|assinatura|checkout|preço|planos?\b/i);
  });

  test("fora dos quadros e exemplos rotulados, nenhum número de mercado ou estatística", () => {
    const percents = text.match(/-?\d+(?:,\d+)?\s?%/g) ?? [];
    assert.deepEqual(percents, ["-4,26%"], "só o exemplo fictício rotulado da seção de análise");
    assert.doesNotMatch(text, /\d+\s?(mil|milhões|bilhões)\b/i);
  });

  test("nenhuma promessa de integração automática, previsão ou execução automática", () => {
    assert.doesNotMatch(html, /integra(ção|-se) automátic|conecta (automaticamente|ao seu ERP|ao seu banco)|open finance|prevê o futuro|previsão precisa|executa (as )?decisões automaticamente/i);
    assert.match(html, /nunca previsões|não é uma previsão/);
    assert.match(html, /Nenhuma decisão financeira é tomada ou executada automaticamente/);
    assert.match(html, /em PDF ou CSV/, "o que a NEXO lê hoje está declarado");
  });

  test("nenhum dado real: sem UUID, CNPJ, e-mail, localhost ou nome de empresa real", () => {
    assert.doesNotMatch(html, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    assert.doesNotMatch(html, /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    assert.doesNotMatch(html, /[\w.+-]+@[\w-]+\.[\w.]+/);
    assert.doesNotMatch(html, /localhost|127\.0\.0\.1|AUREA|ORION|NEXUS|Sintétic/i);
    const companies = [...html.matchAll(/(Distribuidora|Serviços|Participações) Exemplo/g)];
    assert.ok(companies.length > 0, "empresas dos quadros são genéricas e explícitas");
  });

  test("rodapé sem endereço, CNPJ, telefone ou política inexistente", () => {
    const footer = html.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? "";
    assert.doesNotMatch(footer, /CNPJ|Rua |Avenida|\(\d{2}\)|telefone|termos de uso|política de privacidade/i);
  });
});

describe("Mission 205 — configuração e metadata", () => {
  test("canal comercial: só mailto válido ou https; qualquer outra coisa cai na seção de conversa", () => {
    assert.deepEqual(resolveContactChannel({}), { href: CONVERSATION_ANCHOR, configured: false, external: false });
    assert.equal(resolveContactChannel({ NEXT_PUBLIC_NEXO_CONTACT_URL: "mailto:a@example.test" }).href, "mailto:a@example.test");
    assert.equal(resolveContactChannel({ NEXT_PUBLIC_NEXO_CONTACT_URL: "https://agenda.example.test/x" }).external, true);
    for (const unsafe of ["http://agenda.example.test", "javascript:alert(1)", "mailto:sem-arroba", "agenda.example.test", "  "]) {
      assert.equal(resolveContactChannel({ NEXT_PUBLIC_NEXO_CONTACT_URL: unsafe }).configured, false, unsafe);
    }
  });

  test("URL pública: só origem https sem caminho", () => {
    assert.equal(resolveSiteUrl({}), undefined);
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://nexoefos.com.br" })?.toString(), "https://nexoefos.com.br/");
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://nexoefos.com.br" }), undefined);
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://nexoefos.com.br/landing" }), undefined);
  });

  test("sem domínio definido, a metadata não publica canonical, URL nem imagem (nenhuma origem errada)", () => {
    const metadata = buildSiteMetadata({});
    assert.equal(metadata.metadataBase, undefined);
    assert.equal(metadata.alternates, undefined);
    assert.equal((metadata.openGraph as { images?: unknown }).images, undefined);
    assert.equal((metadata.title as { absolute: string }).absolute, "NEXO — Inteligência financeira para administrar empresas");
    assert.match(String(metadata.description), /Executive Financial Operating System/);
  });

  test("com o domínio definido, canonical e imagem de compartilhamento ficam prontos para nexoefos.com.br", () => {
    const metadata = buildSiteMetadata({ NEXT_PUBLIC_SITE_URL: "https://nexoefos.com.br" });
    assert.equal(metadata.metadataBase?.toString(), "https://nexoefos.com.br/");
    assert.deepEqual(metadata.alternates, { canonical: "/" });
    assert.ok(existsSync(join(process.cwd(), "public", SITE_OG_IMAGE)), "imagem de compartilhamento existe em public/");
  });

  test("ícone do app é o monograma NEXO, não o padrão do create-next-app", () => {
    assert.ok(existsSync(join(process.cwd(), "app/icon.svg")));
    assert.ok(!existsSync(join(process.cwd(), "app/favicon.ico")));
  });
});
