"use client";

import { useState } from "react";
import { LogOut, KeyRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name?: string | null;
  email?: string | null;
  role: string;
}) {
  const t = useTranslations();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="relative size-9 rounded-full p-0" />}
      >
        <Avatar className="size-9">
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="grid">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
            <span className="mt-1 text-xs font-normal text-muted-foreground">{t(`userRole.${role}`)}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setPwOpen(true)}>
          <KeyRound className="size-4" />
          {t("account.changePassword")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-4" />
          {t("common.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}
