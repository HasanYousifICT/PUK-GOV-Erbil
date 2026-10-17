// Drop-in replacement for `toast` from "sonner" that translates plain-string
// messages (including server error messages) into the active language.

import { toast as sonner, type ExternalToast } from "sonner";
import { translate } from "@/lib/i18n-core";

type Message = Parameters<typeof sonner>[0];

const tr = (m: Message): Message => (typeof m === "string" ? translate(m) : m);
const opts = (d?: ExternalToast): ExternalToast | undefined =>
  d && typeof d.description === "string" ? { ...d, description: translate(d.description) } : d;

export const toast = Object.assign(
  (message: Message, data?: ExternalToast) => sonner(tr(message), opts(data)),
  {
    success: (message: Message, data?: ExternalToast) => sonner.success(tr(message), opts(data)),
    error: (message: Message, data?: ExternalToast) => sonner.error(tr(message), opts(data)),
    info: (message: Message, data?: ExternalToast) => sonner.info(tr(message), opts(data)),
    warning: (message: Message, data?: ExternalToast) => sonner.warning(tr(message), opts(data)),
    message: (message: Message, data?: ExternalToast) => sonner.message(tr(message), opts(data)),
    dismiss: sonner.dismiss,
  }
);
