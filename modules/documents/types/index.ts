export type DocumentActionStatus = "idle" | "error" | "success";

export type DocumentActionState = {
  status: DocumentActionStatus;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialDocumentActionState: DocumentActionState = {
  status: "idle",
};

export type UploadStage =
  | "idle"
  | "hashing"
  | "uploading"
  | "saving"
  | "done"
  | "error";
