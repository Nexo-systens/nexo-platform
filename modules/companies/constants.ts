import type { CompanySize, CompanyTaxRegime } from "@/types/database";

// Fonte unica dos rotulos de regime tributario e porte: usada tanto pelos
// <Select> do formulario (precisam do par value/label) quanto pelas
// listagens (precisam so do lookup value -> label). Antes da Missao 4.1
// esses rotulos estavam duplicados em CompanyFormSheet, CompaniesTable e
// [id]/page.tsx.

export const TAX_REGIME_OPTIONS: { value: CompanyTaxRegime; label: string }[] =
  [
    { value: "mei", label: "MEI" },
    { value: "simples_nacional", label: "Simples Nacional" },
    { value: "lucro_presumido", label: "Lucro Presumido" },
    { value: "lucro_real", label: "Lucro Real" },
  ];

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "mei", label: "MEI" },
  { value: "micro", label: "Microempresa" },
  { value: "pequena", label: "Pequena" },
  { value: "media", label: "Média" },
  { value: "grande", label: "Grande" },
];

export const TAX_REGIME_LABELS = Object.fromEntries(
  TAX_REGIME_OPTIONS.map((option) => [option.value, option.label])
) as Record<CompanyTaxRegime, string>;

export const COMPANY_SIZE_LABELS = Object.fromEntries(
  COMPANY_SIZE_OPTIONS.map((option) => [option.value, option.label])
) as Record<CompanySize, string>;
