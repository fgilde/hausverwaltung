"use client";

import { useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [, start] = useTransition();

  const open = (n: NotificationItem) => {
    start(async () => {
      if (!n.read) {
        const fd = new FormData();
        fd.set("id", n.id);
        await markNotificationRead(fd);
      }
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={t("title")} title={t("title")} />}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("title")}</span>
          {unread > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}
            >
              <CheckCheck className="size-3.5" /> {t("markAll")}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${n.read ? "opacity-60" : ""}`}
              >
                <div className="flex w-full items-center gap-2">
                  {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                  <span className="font-medium">{n.title}</span>
                </div>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[11px] text-muted-foreground">{n.createdAt}</span>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
