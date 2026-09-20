"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompanyAction,
  updateCompanyAction,
} from "@/modules/companies/actions/company.actions";
import {
  COMPANY_SIZE_OPTIONS,
  TAX_REGIME_OPTIONS,
} from "@/modules/companies/constants";
import type { Company } from "@/modules/companies/services/company.service";
import {
  initialCompanyActionState,
  type CompanyActionState,
} from "@/modules/companies/types";
import {
  companyFormSchema,
  type CompanyFormInput,
} from "@/modules/companies/validators/company.schemas";

interface CompanyFormSheetProps {
  trigger: ReactElement;
  company?: Company;
}

export function CompanyFormSheet({ trigger, company }: CompanyFormSheetProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CompanyActionState>(
    initialCompanyActionState
  );
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(company);

  const action = company
    ? updateCompanyAction.bind(null, company.id)
    : createCompanyAction;

  const form = useForm<CompanyFormInput>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      razaoSocial: company?.razao_social ?? "",
      nomeFantasia: company?.nome_fantasia ?? "",
      cnpj: company?.cnpj ?? "",
      regimeTributario: company?.regime_tributario ?? undefined,
      cnae: company?.cnae ?? "",
      segmento: company?.segmento ?? "",
      porte: company?.porte ?? undefined,
      dataAbertura: company?.data_abertura ?? "",
      observacoes: company?.observacoes ?? "",
    },
  });

  function onSubmit(values: CompanyFormInput) {
    const formData = new FormData();
    formData.append("razaoSocial", values.razaoSocial);
    formData.append("nomeFantasia", values.nomeFantasia ?? "");
    formData.append("cnpj", values.cnpj);
    formData.append("regimeTributario", values.regimeTributario ?? "");
    formData.append("cnae", values.cnae ?? "");
    formData.append("segmento", values.segmento ?? "");
    formData.append("porte", values.porte ?? "");
    formData.append("dataAbertura", values.dataAbertura ?? "");
    formData.append("observacoes", values.observacoes ?? "");

    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        form.reset();
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setState(initialCompanyActionState);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Editar empresa" : "Nova empresa"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Atualize os dados cadastrais da empresa."
              : "Preencha os dados cadastrais da nova empresa."}
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          {state.status === "error" && state.message && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" {...form.register("razaoSocial")} />
            {form.formState.errors.razaoSocial && (
              <p className="text-sm text-destructive">
                {form.formState.errors.razaoSocial.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input id="nomeFantasia" {...form.register("nomeFantasia")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              {...form.register("cnpj")}
            />
            {form.formState.errors.cnpj && (
              <p className="text-sm text-destructive">
                {form.formState.errors.cnpj.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Regime tributário</Label>
              <Controller
                control={form.control}
                name="regimeTributario"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_REGIME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Porte</Label>
              <Controller
                control={form.control}
                name="porte"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cnae">CNAE</Label>
            <Input id="cnae" {...form.register("cnae")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segmento">Segmento</Label>
            <Input id="segmento" {...form.register("segmento")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dataAbertura">Data de abertura</Label>
            <Input
              id="dataAbertura"
              type="date"
              {...form.register("dataAbertura")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={3}
              {...form.register("observacoes")}
            />
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : "Criar empresa"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
