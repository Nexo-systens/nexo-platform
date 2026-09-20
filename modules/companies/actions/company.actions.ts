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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
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
      message: isUniqueViolation(error)
        ? "Já existe uma empresa cadastrada com este CNPJ."
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
      message: isUniqueViolation(error)
        ? "Já existe uma empresa cadastrada com este CNPJ."
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
