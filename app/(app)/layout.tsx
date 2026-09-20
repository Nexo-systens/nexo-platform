import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { AppHeader } from "@/modules/workspace/components/AppHeader";
import { AppSidebar } from "@/modules/workspace/components/AppSidebar";

// A protecao de autenticacao ja e garantida pelo proxy.ts (raiz) para toda
// rota fora de PUBLIC_ROUTES. Este layout apenas resolve o usuario para
// exibicao na UI (Header/UserMenu), nao repete a decisao de redirect.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
