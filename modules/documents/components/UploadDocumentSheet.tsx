"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactElement,
} from "react";
import { UploadCloud } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { createClient } from "@/lib/supabase/client";
import { createDocumentAction } from "@/modules/documents/actions/document.actions";
import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
  type DocumentCategory,
} from "@/modules/documents/constants";
import { initialDocumentActionState, type UploadStage } from "@/modules/documents/types";
import {
  computeSha256File,
  formatFileSize,
  isAllowedFileExtension,
  isAllowedFileSize,
  sanitizeFileName,
} from "@/modules/documents/utils/file";
import { buildDocumentStoragePath } from "@/modules/documents/utils/storage-path";

const STAGE_LABEL: Record<UploadStage, string> = {
  idle: "",
  hashing: "Calculando hash do arquivo...",
  uploading: "Enviando arquivo...",
  saving: "Registrando documento...",
  done: "Documento enviado.",
  error: "Falha no envio.",
};

const STAGE_PROGRESS: Record<UploadStage, number> = {
  idle: 0,
  hashing: 25,
  uploading: 65,
  saving: 90,
  done: 100,
  error: 0,
};

interface UploadDocumentSheetProps {
  companyId: string;
  trigger: ReactElement;
}

export function UploadDocumentSheet({
  companyId,
  trigger,
}: UploadDocumentSheetProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory | undefined>();
  const [stage, setStage] = useState<UploadStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  const busy = stage !== "idle" && stage !== "done" && stage !== "error";

  function resetForm() {
    setFile(null);
    setCategory(undefined);
    setStage("idle");
    setErrorMessage(undefined);
    setIsDraggingOver(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
    }
  }

  function validateAndSetFile(selected: File | undefined | null) {
    setErrorMessage(undefined);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!isAllowedFileExtension(selected.name)) {
      setErrorMessage("Tipo de arquivo não suportado.");
      setFile(null);
      return;
    }

    if (!isAllowedFileSize(selected.size)) {
      setErrorMessage(
        `Arquivo excede o tamanho máximo (${formatFileSize(MAX_FILE_SIZE_BYTES)}).`
      );
      setFile(null);
      return;
    }

    setFile(selected);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    validateAndSetFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) setIsDraggingOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (busy) return;
    validateAndSetFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!file || !category) {
      setErrorMessage("Selecione um arquivo e uma categoria.");
      return;
    }

    const selectedFile = file;
    const selectedCategory = category;

    startTransition(async () => {
      try {
        setStage("hashing");
        const hash = await computeSha256File(selectedFile);

        const documentId = crypto.randomUUID();
        const storedName = sanitizeFileName(selectedFile.name);
        const storagePath = buildDocumentStoragePath(
          companyId,
          documentId,
          storedName
        );

        setStage("uploading");
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, selectedFile, {
            contentType: selectedFile.type || "application/octet-stream",
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        setStage("saving");
        const formData = new FormData();
        formData.append("documentId", documentId);
        formData.append("categoria", selectedCategory);
        formData.append("nomeOriginal", selectedFile.name);
        formData.append("nomeArmazenado", storedName);
        formData.append(
          "tipoArquivo",
          selectedFile.type || "application/octet-stream"
        );
        formData.append("tamanhoBytes", String(selectedFile.size));
        formData.append("storagePath", storagePath);
        formData.append("hashArquivo", hash);

        const result = await createDocumentAction(
          companyId,
          initialDocumentActionState,
          formData
        );

        if (result.status !== "success") {
          throw new Error(
            result.message ?? "Não foi possível registrar o documento."
          );
        }

        setStage("done");
        setTimeout(() => setOpen(false), 600);
      } catch (error) {
        setStage("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao enviar o documento."
        );
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Enviar documento</SheetTitle>
          <SheetDescription>
            Envie um documento financeiro para esta empresa.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 px-4 pb-4"
        >
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={category ?? ""}
              onValueChange={(value) => setCategory(value as DocumentCategory)}
              disabled={busy}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">Arquivo</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors",
                isDraggingOver && "border-ring bg-muted/50",
                busy && "pointer-events-none opacity-50"
              )}
            >
              <UploadCloud
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-foreground">
                Arraste seu documento aqui
              </p>
              <p className="text-xs text-muted-foreground">ou</p>
              <Label
                htmlFor="file"
                className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Selecionar arquivo
              </Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                disabled={busy}
                className="sr-only"
              />
              <p className="text-xs text-muted-foreground">PDF ou CSV</p>
            </div>
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatFileSize(file.size)}
              </p>
            )}
          </div>

          {stage !== "idle" && (
            <div className="flex flex-col gap-1.5">
              <Progress value={STAGE_PROGRESS[stage]} />
              <p className="text-xs text-muted-foreground">
                {STAGE_LABEL[stage]}
              </p>
            </div>
          )}

          <SheetFooter className="mt-auto px-0">
            <Button
              type="submit"
              disabled={busy || isPending || !file || !category}
              className="w-full"
            >
              {busy ? "Enviando..." : "Enviar documento"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
