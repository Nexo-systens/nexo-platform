export type AuthActionStatus = "idle" | "error" | "success";

export type AuthActionState = {
  status: AuthActionStatus;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
