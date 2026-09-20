"use client";

import { useState } from "react";

import { HistoricalAnalysisPanel } from "@/modules/history/components/HistoricalAnalysisPanel";

import { ExecutiveAnalysisPanel } from "./ExecutiveAnalysisPanel";

interface AnalysisAndHistorySectionProps {
  companyId: string;
  hasDocuments: boolean;
}

/**
 * Coordena `ExecutiveAnalysisPanel`/`HistoricalAnalysisPanel` — os
 * dois componentes viviam lado a lado em `page.tsx` (Server Component,
 * sem estado) sem nenhuma comunicação entre si; `HistoricalAnalysisPanel`
 * buscava o histórico apenas uma vez, ao montar, e nunca sabia que uma
 * nova análise havia sido concluída na mesma sessão de página — causa
 * raiz confirmada da discrepância de datas observada na validação real
 * da Mission 098 (Mission 099, Etapa 6, Correção D). Este wrapper é o
 * único novo estado: `historyRefreshKey`, incrementado por
 * `onAnalysisComplete`, repassado como `refreshKey` para forçar o
 * recarregamento. Nenhum cálculo, nenhuma lógica de negócio.
 */
export function AnalysisAndHistorySection({
  companyId,
  hasDocuments,
}: AnalysisAndHistorySectionProps) {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  return (
    <>
      <ExecutiveAnalysisPanel
        companyId={companyId}
        hasDocuments={hasDocuments}
        onAnalysisComplete={() =>
          setHistoryRefreshKey((currentKey) => currentKey + 1)
        }
      />

      <HistoricalAnalysisPanel companyId={companyId} refreshKey={historyRefreshKey} />
    </>
  );
}
