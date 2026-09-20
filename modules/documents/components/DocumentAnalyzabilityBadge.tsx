import { Badge } from "@/components/ui/badge";
import { isAnalyzableDocumentName } from "@/modules/documents/utils/file";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 10/44. `documents.status` (`DocumentStatusBadge`)
 * nunca distinguia "arquivo tecnicamente incompatível com análise" de
 * "arquivo aguardando/já processado" — um XLSX/DOCX/imagem enviado
 * permanece `uploaded` ("Disponível") PARA SEMPRE, porque
 * `listAnalyzableDocumentsByCompany()` nunca o inclui em nenhuma
 * análise (apenas PDF/CSV têm parser real hoje) — sem este selo, o
 * usuário via um status neutro sem nenhuma explicação de por que o
 * documento nunca avança para "Processado". Só renderiza algo quando
 * o arquivo NÃO é analisável — nenhum selo extra/redundante para
 * PDF/CSV, que já usam `DocumentStatusBadge` normalmente.
 */
export function DocumentAnalyzabilityBadge({ nomeOriginal }: { nomeOriginal: string }) {
  if (isAnalyzableDocumentName(nomeOriginal)) return null;

  return (
    <Badge
      variant="outline"
      title="Este formato não é utilizado pela análise financeira hoje (apenas PDF e CSV) — o arquivo permanece armazenado para consulta."
      className="border-border bg-muted text-muted-foreground"
    >
      Não analisável
    </Badge>
  );
}
