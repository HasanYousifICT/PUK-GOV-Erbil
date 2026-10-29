import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"
import { dmyToIso, isoToDmy } from "@/lib/datetime"

const BASE =
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

/** What a handler written for a normal <input> expects: `e.target.value`. */
const asEvent = (value: string) => ({ target: { value }, currentTarget: { value } }) as unknown as React.ChangeEvent<HTMLInputElement>

/** A date typed or picked as dd-mm-yyyy; the value it reports is yyyy-mm-dd. */
function DateBox({ className, value, onChange, ...props }: React.ComponentProps<"input">) {
  const iso = typeof value === "string" ? value : ""
  const [text, setText] = React.useState(isoToDmy(iso))
  const picker = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    // follow the value from outside, but never overwrite what is being typed
    if (dmyToIso(text) !== iso) setText(iso ? isoToDmy(iso) : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso])
  function type(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8)
    const shown = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("-")
    setText(shown)
    if (!digits) return onChange?.(asEvent(""))
    const v = dmyToIso(shown)
    if (v) onChange?.(asEvent(v))
  }
  return (
    <div className="relative w-full">
      <input
        {...props}
        type="text"
        inputMode="numeric"
        dir="ltr"
        placeholder="dd-mm-yyyy"
        maxLength={10}
        value={text}
        onChange={(e) => type(e.target.value)}
        data-slot="input"
        className={cn(BASE, "pe-9", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Calendar"
        disabled={props.disabled}
        className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => {
          const el = picker.current
          if (!el) return
          el.value = iso
          try {
            el.showPicker()
          } catch {
            el.focus()
          }
        }}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute end-0 top-full h-0 w-0 opacity-0"
        onChange={(e) => {
          if (e.target.value) {
            setText(isoToDmy(e.target.value))
            onChange?.(asEvent(e.target.value))
          }
        }}
      />
    </div>
  )
}

const SEL =
  "border-input h-9 rounded-md border bg-transparent px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 md:text-sm dark:bg-input/30"

/** A time chosen on a 12-hour clock (hour, minute, AM/PM); the value it reports is HH:mm (24-hour). */
function TimeBox({ className, value, onChange, disabled, id, required }: React.ComponentProps<"input">) {
  const v = typeof value === "string" ? value : ""
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  const h24 = m ? Number(m[1]) : null
  const [hour, setHour] = React.useState(h24 === null ? "" : String(h24 % 12 === 0 ? 12 : h24 % 12))
  const [minute, setMinute] = React.useState(m ? m[2] : "")
  const [ampm, setAmpm] = React.useState<"AM" | "PM" | "">(h24 === null ? "" : h24 < 12 ? "AM" : "PM")
  React.useEffect(() => {
    if (!v) return
    const mm = /^(\d{1,2}):(\d{2})/.exec(v)
    if (!mm) return
    const h = Number(mm[1])
    setHour(String(h % 12 === 0 ? 12 : h % 12))
    setMinute(mm[2])
    setAmpm(h < 12 ? "AM" : "PM")
  }, [v])
  function commit(h: string, mi: string, ap: "AM" | "PM" | "") {
    if (!h || !mi || !ap) return onChange?.(asEvent(""))
    const base = Number(h) % 12
    const hh = ap === "PM" ? base + 12 : base
    onChange?.(asEvent(`${String(hh).padStart(2, "0")}:${mi}`))
  }
  return (
    <div className={cn("flex w-full items-center gap-1.5", className)} dir="ltr" id={id} role="group" aria-required={required}>
      <select
        aria-label="Hour"
        disabled={disabled}
        className={cn(SEL, "flex-1")}
        value={hour}
        onChange={(e) => {
          setHour(e.target.value)
          commit(e.target.value, minute, ampm)
        }}
      >
        <option value="">--</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
          <option key={n} value={n}>
            {n.padStart(2, "0")}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        aria-label="Minute"
        disabled={disabled}
        className={cn(SEL, "flex-1")}
        value={minute}
        onChange={(e) => {
          setMinute(e.target.value)
          commit(hour, e.target.value, ampm)
        }}
      >
        <option value="">--</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        aria-label="AM/PM"
        disabled={disabled}
        className={cn(SEL, "flex-1")}
        value={ampm}
        onChange={(e) => {
          const ap = e.target.value as "AM" | "PM" | ""
          setAmpm(ap)
          commit(hour, minute, ap)
        }}
      >
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "date") return <DateBox className={className} {...props} />
  if (type === "time") return <TimeBox className={className} {...props} />
  return <input type={type} data-slot="input" className={cn(BASE, className)} {...props} />
}

export { Input }
