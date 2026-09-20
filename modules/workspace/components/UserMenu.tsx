"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/modules/auth/actions/auth.actions";

function getInitials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "U";
}

export function UserMenu({ user }: { user: User | null }) {
  const email = user?.email ?? "";
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Avatar>
          <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
        </Avatar>
        <span className="sr-only">Abrir menu do usuário</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="text-sm font-medium text-foreground">
              {fullName || "Usuário"}
            </span>
            {email && (
              <span className="text-xs text-muted-foreground">{email}</span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logout();
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
