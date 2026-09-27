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
    <div className="flex min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-(--content-max)">{children}</div>
        </main>
      </div>
    </div>
  );
}
