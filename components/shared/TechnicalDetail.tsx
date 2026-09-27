/**
 * Mission 203 — detalhe técnico recolhido. A mensagem principal é
 * executiva; o texto técnico original continua acessível para o suporte
 * da sessão operada, sem dominar a tela e sem ser descartado.
 */
export function TechnicalDetail({ detail }: { detail?: string }) {
  if (!detail) return null;
  return (
    <details className="type-meta rounded-md px-1">
      <summary className="cursor-pointer select-none">Detalhe técnico para o suporte</summary>
      <p className="mt-1 font-mono break-words">{detail}</p>
    </details>
  );
}
