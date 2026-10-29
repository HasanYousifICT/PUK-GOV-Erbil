"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useJobTitle } from "@/components/job-title-text";
import { apiClient, NotificationItem, NotificationList } from "@/lib/client";
import { fmtDateTime, fmtDate, time12 } from "@/lib/datetime";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type T = (s: string, v?: Record<string, string | number>) => string;

/** The sentence for one notification, translated. */
export function notificationText(n: Pick<NotificationItem, "type" | "params">, t: T, jt: (s: string | null | undefined, ckb?: string) => string): string {
  const p = n.params;
  const job = jt(String(p.job ?? ""));
  const candidate = String(p.candidate ?? "");
  const when = p.date ? t("{date} at {time}", { date: fmtDate(String(p.date)), time: time12(String(p.time ?? "")) }) : "";
  switch (n.type) {
    case "app_added":
      return t("You were added to the job “{job}”", { job });
    case "app_stage":
      return t("Your application for “{job}” moved to {stage}", { job, stage: t(String(p.stage ?? "")) });
    case "iv_scheduled":
      return t("An interview for “{job}” was scheduled on {when}", { job, when });
    case "iv_changed":
      return t("Your interview for “{job}” was moved to {when}", { job, when });
    case "iv_cancelled":
      return t("Your interview for “{job}” was cancelled", { job });
    case "pw_reset":
      return t("Your password was reset by an administrator");
    case "login_changed":
      return t("Your login details were updated by staff");
    case "perm_changed":
      return t("Your role or permissions were changed by an administrator");
    case "acct_disabled":
      return t("Your account was disabled by an administrator");
    case "profile_changed":
      return t("Your account details were updated by an administrator");
    case "iv_assigned":
      return t("You were assigned to interview {candidate} for “{job}” on {when}", { candidate, job, when });
    case "iv_cancelled_staff":
      return t("The interview with {candidate} for “{job}” was cancelled", { candidate, job });
    case "iv_changed_staff":
      return t("The interview with {candidate} for “{job}” was moved to {when}", { candidate, job, when });
    case "portal_profile":
      return t("{candidate} submitted a profile from the candidate portal", { candidate });
    case "portal_applied":
      return t("{candidate} applied for “{job}” from the candidate portal", { candidate, job });
    case "iv_completed":
      return t("The interview with {candidate} for “{job}” is completed: all evaluations are in", { candidate, job });
    default:
      return n.type;
  }
}

export type BellSource = {
  load: () => Promise<NotificationList>;
  markRead: (p: { ids?: string[]; all?: boolean }) => Promise<unknown>;
};

export const staffBell: BellSource = {
  load: () => apiClient.notifications(),
  markRead: (p) => apiClient.markNotificationsRead(p),
};
export const candidateBell: BellSource = {
  load: () => apiClient.candidateNotifications(),
  markRead: (p) => apiClient.candidateMarkNotificationsRead(p),
};

/** The bell with an unread count. `onOpenLink` receives the notification's link (where it leads). */
export function NotificationBell({
  source,
  onOpenLink,
  onOpenAction,
  className,
}: {
  source: BellSource;
  onOpenLink: (link: Record<string, unknown>) => void;
  onOpenAction?: () => void;
  className?: string;
}) {
  const { t, dir } = useI18n();
  const jt = useJobTitle();
  const [data, setData] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const d = await source.load();
      if (alive.current) setData(d);
    } catch {
      /* the bell stays quiet when the server is unreachable */
    }
  }, [source]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      alive.current = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const actions = data?.actions ?? [];
  const count = (data?.unread ?? 0) + actions.length;

  async function readAll() {
    await source.markRead({ all: true }).catch(() => undefined);
    refresh();
  }
  async function openItem(n: NotificationItem) {
    if (!n.read) await source.markRead({ ids: [n.id] }).catch(() => undefined);
    setOpen(false);
    if (n.link) onOpenLink(n.link);
    refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={t("Notifications")}>
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={dir === "rtl" ? "start" : "end"} className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("Notifications")}</p>
          {(data?.unread ?? 0) > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={readAll}>
              <CheckCheck className="me-1 h-3.5 w-3.5" /> {t("Mark all as read")}
            </Button>
          )}
        </div>
        <div className="thin-scrollbar max-h-96 overflow-y-auto">
          {actions.length > 0 && (
            <div className="border-b bg-amber-50/60">
              <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{t("Action required")}</p>
              {actions.map((a) => (
                <button
                  key={a.id}
                  className="flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-amber-100/60"
                  onClick={() => {
                    setOpen(false);
                    onOpenAction?.();
                  }}
                >
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    {t("Evaluation needed: interview with {candidate} for “{job}” on {when}", {
                      candidate: a.candidate,
                      job: jt(a.job),
                      when: t("{date} at {time}", { date: fmtDate(a.date), time: time12(a.time) }),
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
          {(data?.items ?? []).length === 0 && actions.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("No notifications yet.")}</p>
          ) : (
            (data?.items ?? []).map((n) => (
              <button
                key={n.id}
                className={cn("flex w-full items-start gap-2 border-b px-3 py-2.5 text-start text-sm last:border-0 hover:bg-muted/50", !n.read && "bg-primary/5")}
                onClick={() => openItem(n)}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0">
                  <span className="block">{notificationText(n, t, jt)}</span>
                  <span className="block text-xs text-muted-foreground" dir="ltr">
                    {fmtDateTime(n.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
