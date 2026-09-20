import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// A partir do Next.js 16, o antigo `middleware.ts` foi descontinuado e
// renomeado para `proxy.ts` (função exportada `proxy`, não `middleware`).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
