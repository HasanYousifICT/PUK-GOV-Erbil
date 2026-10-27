import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, requireAuth, str } from "@/lib/api";
import { FIELD_TYPES, hasOptions, MAX_FIELDS, FieldType } from "@/lib/candidate-fields";
import { loadFields, loadSections, normalizeColumnDefs, normalizeOptions, normalizeSettings, normalizeShowIf, serializeField } from "@/lib/candidate-custom";

/** GET /api/candidate-fields — all custom field definitions in display order. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    return json(await loadFields());
  });
}

/** POST /api/candidate-fields — define a new field. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const label = str(body.label).trim();
    if (!label) throw new ApiError(400, "Field name is required");
    if (label.length > 100) throw new ApiError(400, "Field name is too long (max 100 characters)");
    const type = str(body.type);
    if (!(FIELD_TYPES as readonly string[]).includes(type)) throw new ApiError(400, "Invalid field type");

    const cols = type === "table" ? normalizeColumnDefs(body.columns ?? body.options) : null;
    const options = cols ? cols.names : hasOptions(type as FieldType) ? normalizeOptions(body.options) : [];
    if (hasOptions(type as FieldType) && options.length === 0) throw new ApiError(400, "Add at least one option");

    const sections = await loadSections();
    const wanted = str(body.sectionId);
    if (wanted && !sections.some((s) => s.id === wanted)) throw new ApiError(400, "Section not found");
    const sectionId = wanted || sections[0].id;

    const existing = await db.candidateField.findMany({ select: { label: true, sortOrder: true } });
    if (existing.length >= MAX_FIELDS) throw new ApiError(400, "Maximum number of fields reached");
    if (existing.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      throw new ApiError(409, "A field with this name already exists");
    }
    const allFields = await loadFields();
    const showIf = normalizeShowIf(body.showIf, null, allFields);
    const settings = normalizeSettings(body.settings, type as FieldType, null, allFields);
    const sortOrder = existing.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;

    const row = await db.candidateField.create({
      data: {
        label,
        labelCkb: str(body.labelCkb).trim().slice(0, 100),
        type,
        options: JSON.stringify(options),
        columnDefs: JSON.stringify(cols?.defs ?? []),
        required: body.required === true && !settings.ageFrom,
        settings: JSON.stringify(settings),
        publicForm: body.publicForm !== false,
        sectionId,
        showIf,
        sortOrder,
      },
    });
    return json(serializeField(row), 201);
  });
}
