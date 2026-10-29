import { parseActions } from "@/lib/interview-actions";
import { parseMoves } from "@/lib/stage-moves";
import { notifyCandidate, notifyUsers, usersWith } from "@/lib/notify-server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { cleanPhone, isValidPhone, phoneKey } from "@/lib/phone";
import { ROLE_PRESETS, sanitizePermissions } from "@/lib/permissions";
import { assertNameFree, assertUserPhoneFree, toManaged, userSelect } from "../route";

type Params = { params: Promise<{ id: string }> };

async function otherActiveAdmins(id: string) {
  return db.user.count({ where: { role: "admin", active: true, NOT: { id } } });
}

/** PUT /api/users/:id — change details, role, permissions, status or reset the password. */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin(req);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");

    const data: {
      name?: string;
      role?: string;
      password?: string;
      phone?: string;
      phoneKey?: string;
      title?: string;
      permissions?: string;
      stageMoves?: string;
      interviewActions?: string;
      active?: boolean;
    } = {};
    if ("name" in body) {
      const name = str(body.name).trim().replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 100) throw new ApiError(400, "Please enter the full name (2–100 characters)");
      await assertNameFree(name, id);
      data.name = name;
    }
    if ("phone" in body) {
      const raw = str(body.phone);
      if (!raw.trim() && existing.phoneKey) throw new ApiError(400, "Phone number is required");
      if (raw.trim()) {
        if (!isValidPhone(raw)) throw new ApiError(400, "Please enter a valid phone number");
        await assertUserPhoneFree(phoneKey(raw), id);
        data.phone = cleanPhone(raw);
        data.phoneKey = phoneKey(raw);
      }
    }
    if ("title" in body) data.title = str(body.title).trim().slice(0, 150);

    const nextRole = "role" in body ? (body.role === "admin" ? "admin" : "recruiter") : existing.role;
    if (nextRole !== existing.role) {
      if (existing.role === "admin" && (id === me.id || (await otherActiveAdmins(id)) === 0)) {
        throw new ApiError(400, "There must be at least one administrator");
      }
      data.role = nextRole;
    }
    if ("permissions" in body || nextRole !== existing.role) {
      data.permissions = JSON.stringify(nextRole === "admin" ? ROLE_PRESETS[0].permissions : sanitizePermissions(body.permissions));
    }
    if ("stageMoves" in body || nextRole !== existing.role) {
      data.stageMoves = nextRole === "admin" || body.stageMoves === null || body.stageMoves === undefined ? "" : JSON.stringify(parseMoves(body.stageMoves) ?? []);
    }
    if ("interviewActions" in body || nextRole !== existing.role) {
      data.interviewActions = nextRole === "admin" || body.interviewActions === null || body.interviewActions === undefined ? "" : JSON.stringify(parseActions(body.interviewActions) ?? []);
    }
    if ("active" in body) {
      const active = body.active !== false;
      if (!active) {
        if (id === me.id) throw new ApiError(400, "You cannot disable your own account");
        if (existing.role === "admin" && (await otherActiveAdmins(id)) === 0) {
          throw new ApiError(400, "There must be at least one administrator");
        }
      }
      data.active = active;
    }
    if (str(body.password)) {
      if (str(body.password).length < 6) throw new ApiError(400, "Password must be at least 6 characters");
      data.password = await hashPassword(str(body.password));
    }
    const updated = await db.user.update({ where: { id }, data, select: userSelect });
    if (id !== me.id) {
      if (data.password) await notifyUsers([id], "pw_reset", {});
      if (data.role !== undefined || data.permissions !== undefined || data.stageMoves !== undefined || data.interviewActions !== undefined) await notifyUsers([id], "perm_changed", {});
      if (data.active === false) await notifyUsers([id], "acct_disabled", {});
      if (data.name !== undefined || data.title !== undefined || data.phone !== undefined) await notifyUsers([id], "profile_changed", {});
    }
    return json(toManaged(updated));
  });
}

/** DELETE /api/users/:id — remove an account (not yourself, not the last administrator). */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin(req);
    const { id } = await params;
    if (id === me.id) throw new ApiError(400, "You cannot delete your own account");
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");
    if (existing.role === "admin" && (await otherActiveAdmins(id)) === 0) {
      throw new ApiError(400, "There must be at least one administrator");
    }
    await db.user.delete({ where: { id } });
    return json({ ok: true });
  });
}
