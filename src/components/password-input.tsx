"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A password field that is hidden by default (with a show/hide button) and never auto-filled by the browser. */
export function PasswordInput({
  value,
  onChange,
  id,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex-1">
      <Input
        id={id}
        type={show ? "text" : "password"}
        dir="ltr"
        autoComplete="new-password"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pe-10", className)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("Hide password") : t("Show password")}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Administrator view of a forgotten password: hidden until the eye is clicked, with a copy button. */
export function ShowPasswordDialog({
  open,
  title,
  subtitle,
  load,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  load: () => Promise<{ password: string | null }>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "none" | "error" | { password: string }>("loading");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState("loading");
    setShow(false);
    load()
      .then((r) => !cancelled && setState(r.password ? { password: r.password } : "none"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const password = typeof state === "object" ? state.password : "";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription dir="auto">{subtitle}</DialogDescription>}
        </DialogHeader>
        {state === "loading" && <p className="text-sm text-muted-foreground">{t("Loading…")}</p>}
        {state === "error" && <p className="text-sm text-red-600">{t("Could not load the password")}</p>}
        {state === "none" && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm">
            {t("This password was set before this feature existed, so it cannot be shown. Use “Reset password” once; after that it can be shown here.")}
          </p>
        )}
        {typeof state === "object" && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center rounded-md border bg-muted/30 px-3 font-mono text-sm" dir="ltr">
              {show ? password : "•".repeat(Math.min(password.length, 16))}
            </div>
            <Button type="button" variant="outline" size="icon" aria-label={show ? t("Hide password") : t("Show password")} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("Copy")}
              onClick={() => navigator.clipboard?.writeText(password).then(() => toast.success("Copied"))}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
