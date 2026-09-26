"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import {
  createCompany,
  setCompanyStatus,
  softDeleteCompany,
  updateCompany,
  type CompanyMutationInput,
} from "@/modules/companies/services/company.service";
import type { CompanyActionState } from "@/modules/companies/types";
import {
  isTenantScopedCnpjViolation,
  OWN_DUPLICATE_CNPJ_MESSAGE,
} from "@/modules/companies/utils/cnpj-uniqueness";
import {
  companyFormSchema,
  type CompanyFormInput,
} from "@/modules/companies/validators/company.schemas";

function toMutationInput(data: CompanyFormInput): CompanyMutationInput {
  return {
    razaoSocial: data.razaoSocial,
    nomeFantasia: data.nomeFantasia || null,
    cnpj: data.cnpj,
    regimeTributario: data.regimeTributario ?? null,
    cnae: data.cnae || null,
    segmento: data.segmento || null,
    porte: data.porte ?? null,
    dataAbertura: data.dataAbertura || null,
    observacoes: data.observacoes || null,
  };
}

export async function createCompanyAction(
  _prevState: CompanyActionState,
  formData: FormData
): Promise<CompanyActionState> {
  const parsed = companyFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      message: "Sessão expirada. Faça login novamente.",
    };
  }

  try {
    await createCompany(user.id, toMutationInput(parsed.data));
  } catch (error) {
    return {
      status: "error",
      message: isTenantScopedCnpjViolation(error)
        ? OWN_DUPLICATE_CNPJ_MESSAGE
        : "Não foi possível criar a empresa. Tente novamente.",
    };
  }

  revalidatePath("/companies");
  return { status: "success", message: "Empresa criada com sucesso." };
}

export async function updateCompanyAction(
  id: string,
  _prevState: CompanyActionState,
  formData: FormData
): Promise<CompanyActionState> {
  const parsed = companyFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCompany(id, toMutationInput(parsed.data));
  } catch (error) {
    return {
      status: "error",
      message: isTenantScopedCnpjViolation(error)
        ? OWN_DUPLICATE_CNPJ_MESSAGE
        : "Não foi possível salvar as alterações.",
    };
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return { status: "success", message: "Empresa atualizada com sucesso." };
}

export async function archiveCompanyAction(id: string): Promise<void> {
  await setCompanyStatus(id, "archived");
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function unarchiveCompanyAction(id: string): Promise<void> {
  await setCompanyStatus(id, "active");
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function deleteCompanyAction(id: string): Promise<void> {
  await softDeleteCompany(id);
  revalidatePath("/companies");
  redirect("/companies");
}
