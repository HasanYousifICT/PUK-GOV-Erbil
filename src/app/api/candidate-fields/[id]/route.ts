import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { FieldType, hasOptions, isFileValue, parseCustomData, parseShowIf } from "@/lib/candidate-fields";
import { deleteFiles, loadFields, loadSections, normalizeColumnDefs, normalizeOptions, normalizeSettings, normalizeShowIf, serializeField } from "@/lib/candidate-custom";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/candidate-fields/:id — edit label, required flag or dropdown options (type is fixed). */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.candidateField.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Field not found");

    const data: { label?: string; labelCkb?: string; options?: string; columnDefs?: string; settings?: string; required?: boolean; publicForm?: boolean; sectionId?: string; showIf?: string } = {};
    if ("label" in body) {
      const label = str(body.label).trim();
      if (!label) throw new ApiError(400, "Field name is required");
      if (label.length > 100) throw new ApiError(400, "Field name is too long (max 100 characters)");
      const others = await db.candidateField.findMany({ where: { NOT: { id } }, select: { label: true } });
      if (others.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
        throw new ApiError(409, "A field with this name already exists");
      }
      data.label = label;
    }
    if ("labelCkb" in body) data.labelCkb = str(body.labelCkb).trim().slice(0, 100);
    if ("required" in body) data.required = body.required === true;
    if ("publicForm" in body) data.publicForm = body.publicForm === true;
    if ("sectionId" in body) {
      const sid = str(body.sectionId);
      if (!(await loadSections()).some((s) => s.id === sid)) throw new ApiError(400, "Section not found");
      data.sectionId = sid;
    }
    if ("settings" in body) {
      const settings = normalizeSettings(body.settings, existing.type as FieldType, id, await loadFields());
      data.settings = JSON.stringify(settings);
      if (settings.ageFrom) data.required = false;
    }
    if ("showIf" in body) data.showIf = normalizeShowIf(body.showIf, id, await loadFields());
    if (("columns" in body || "options" in body) && existing.type === "table") {
      const cols = normalizeColumnDefs(body.columns ?? body.options);
      data.options = JSON.stringify(cols.names);
      data.columnDefs = JSON.stringify(cols.defs);
    } else if ("options" in body && hasOptions(existing.type as FieldType)) {
      const options = normalizeOptions(body.options);
      if (options.length === 0) throw new ApiError(400, "Add at least one option");
      data.options = JSON.stringify(options);
    }

    const row = await db.candidateField.update({ where: { id }, data });
    return json(serializeField(row));
  });
}

/** DELETE /api/candidate-fields/:id — removes the field and its values (and attachments) from every candidate. */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const existing = await db.candidateField.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Field not found");

    const holders = await db.candidate.findMany({
      where: { customData: { contains: id } },
      select: { id: true, customData: true },
    });
    const files: string[] = [];
    for (const c of holders) {
      const data = parseCustomData(c.customData);
      if (!(id in data)) continue;
      const v = data[id];
      if (isFileValue(v)) files.push(v.key);
      delete data[id];
      await db.candidate.update({ where: { id: c.id }, data: { customData: JSON.stringify(data) } });
    }
    // fields that were shown by this one become always visible
    const dependents = await db.candidateField.findMany({ where: { showIf: { contains: id } }, select: { id: true, showIf: true } });
    for (const d of dependents) {
      const rule = parseShowIf(d.showIf);
      if (!rule || !rule.conds.some((c) => c.fieldId === id)) continue;
      const left = rule.conds.filter((c) => c.fieldId !== id);
      await db.candidateField.update({ where: { id: d.id }, data: { showIf: left.length ? JSON.stringify({ ...rule, conds: left }) : "" } });
    }
    await db.candidateField.delete({ where: { id } });
    await deleteFiles(files);
    return json({ ok: true });
  });
}
