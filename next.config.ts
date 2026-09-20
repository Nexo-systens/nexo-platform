import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist resolvem pdf.worker.mjs em runtime via um
  // caminho relativo ao proprio pacote em node_modules (pdfjs-dist,
  // GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs" quando
  // isNodeJS). O bundling/trace padrao do Next.js para rotas server
  // (Turbopack) nao preserva essa resolucao relativa, causando
  // "Setting up fake worker failed: Cannot find module ...
  // pdf.worker.mjs" em runtime (Mission 092). serverExternalPackages
  // faz o Next.js tratar esses dois pacotes como externos as rotas
  // server — usa o `require`/`import` nativo do Node contra
  // node_modules como instalado, igual ao comportamento fora do
  // Next.js (confirmado via reproducao isolada com tsx).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
