"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MobileSidebarTrigger } from "@/modules/workspace/components/AppSidebar";
import { UserMenu } from "@/modules/workspace/components/UserMenu";
import { findActiveNavItem } from "@/modules/workspace/config/navigation";

export function AppHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const currentItem = findActiveNavItem(pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      <MobileSidebarTrigger />

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/dashboard" />}>
              Workspace
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentItem?.label ?? "Workspace"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <UserMenu user={user} />
    </header>
  );
}
