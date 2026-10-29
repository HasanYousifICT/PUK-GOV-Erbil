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

const MovesCtx = createContext<((from: string, to: string) => boolean) | null>(null);

/** Whether the signed-in user may move an application between two stages (everything when no provider). */
export function StageMovesProvider({ value, children }: { value: (from: string, to: string) => boolean; children: ReactNode }) {
  return <MovesCtx.Provider value={value}>{children}</MovesCtx.Provider>;
}

export function useCanMove(): (from: string, to: string) => boolean {
  return useContext(MovesCtx) ?? (() => true);
}

const ActionsCtx = createContext<((action: "schedule" | "feedback") => boolean) | null>(null);

export function InterviewActionsProvider({ value, children }: { value: (action: "schedule" | "feedback") => boolean; children: ReactNode }) {
  return <ActionsCtx.Provider value={value}>{children}</ActionsCtx.Provider>;
}

/** Whether the signed-in user may schedule interviews / give interview feedback. */
export function useCanInterview(action: "schedule" | "feedback"): boolean {
  const f = useContext(ActionsCtx);
  return f ? f(action) : true;
}
