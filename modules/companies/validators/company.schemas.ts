import { z } from "zod";

import { isValidCnpj, sanitizeCnpj } from "@/modules/companies/utils/cnpj";

const TAX_REGIME_VALUES = [
  "mei",
  "simples_nacional",
  "lucro_presumido",
  "lucro_real",
] as const;

const COMPANY_SIZE_VALUES = [
  "mei",
  "micro",
  "pequena",
  "media",
  "grande",
] as const;

export const companyFormSchema = z.object({
  razaoSocial: z.string().trim().min(2, { error: "Informe a razão social." }),
  nomeFantasia: z.string().trim().optional().or(z.literal("")),
  cnpj: z
    .string()
    .trim()
    .transform(sanitizeCnpj)
    .refine(isValidCnpj, { error: "CNPJ inválido." }),
  regimeTributario: z.enum(TAX_REGIME_VALUES).optional(),
  cnae: z.string().trim().optional().or(z.literal("")),
  segmento: z.string().trim().optional().or(z.literal("")),
  porte: z.enum(COMPANY_SIZE_VALUES).optional(),
  dataAbertura: z.string().trim().optional().or(z.literal("")),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

export type CompanyFormInput = z.infer<typeof companyFormSchema>;

export const companyListFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["all", "active", "archived"]).default("all"),
  sort: z.enum(["razao_social", "created_at", "cnpj"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
});

export type CompanyListFilters = z.infer<typeof companyListFiltersSchema>;
