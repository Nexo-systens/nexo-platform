"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company } from "@/modules/companies/services/company.service";

interface DocumentsCompanySelectProps {
  companies: Pick<Company, "id" | "razao_social">[];
  companyId?: string;
}

// Escopo de leitura do modulo Documentos (Mission 091): a pagina
// /documents exige uma empresa selecionada antes de listar/enviar
// documentos (secao 5 da missao — "todo documento precisa estar
// associado a uma empresa"). Este seletor apenas navega para
// /documents?companyId=... — a listagem em si continua vindo de
// DocumentsSection (Mission 5/82), reaproveitada sem alteracao de
// contrato.
export function DocumentsCompanySelect({
  companies,
  companyId,
}: DocumentsCompanySelectProps) {
  const router = useRouter();

  return (
    <Select
      value={companyId ?? ""}
      onValueChange={(value) => router.push(`/documents?companyId=${value}`)}
    >
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue placeholder="Selecione uma empresa" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.razao_social}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
