import { redirect } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/services/auth.service";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
