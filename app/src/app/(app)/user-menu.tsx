"use client";

import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { logout } from "../(auth)/actions";

type UserMenuProps = { fullName: string; email: string; avatarUrl: string | null; compact?: boolean; side?: "top" | "bottom" };

export function UserMenu({ fullName, email, avatarUrl, compact = false, side }: UserMenuProps) {
  const logoutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={logoutForm} action={logout} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size={compact ? "icon" : "default"}
              className={compact ? "rounded-full" : "h-14 w-full justify-start gap-3 px-2"}
              aria-label={compact ? `Menu da conta de ${fullName}` : undefined}
            />
          }
        >
          <UserAvatar name={fullName} src={avatarUrl} />
          {!compact && (
            <>
              <span className="grid min-w-0 flex-1 text-left">
                <span className="truncate text-sm font-medium">{fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </span>
              <ChevronsUpDown className="text-muted-foreground" aria-hidden />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact && side !== "top" ? "end" : "start"} side={side ?? (compact ? "bottom" : "top")} className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="grid gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">{fullName}</span>
              <span className="truncate font-normal">{email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-10" render={<Link href="/settings" />}>
            <Settings aria-hidden />
            Configurações
          </DropdownMenuItem>
          <DropdownMenuItem className="h-10" variant="destructive" onClick={() => logoutForm.current?.requestSubmit()}>
            <LogOut aria-hidden />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
