"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
