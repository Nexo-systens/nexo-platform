export type CompanyActionStatus = "idle" | "error" | "success";

export type CompanyActionState = {
  status: CompanyActionStatus;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialCompanyActionState: CompanyActionState = {
  status: "idle",
};
