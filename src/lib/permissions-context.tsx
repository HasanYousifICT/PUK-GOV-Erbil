"use client";

import { createContext, ReactNode, useContext } from "react";
import { Area, can, Level, Permissions } from "@/lib/permissions";

const Ctx = createContext<Permissions | null>(null);

export function PermissionsProvider({ value, children }: { value: Permissions; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `useCan("candidates", "edit")` → whether the signed-in staff member may do that. */
export function useCan(area: Area, need: Level = "edit"): boolean {
  const p = useContext(Ctx);
  return p ? can(p, area, need) : true;
}
