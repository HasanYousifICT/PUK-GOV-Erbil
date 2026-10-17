import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, str } from "@/lib/api";
import { FIELD_TYPES, MAX_FIELDS } from "@/lib/candidate-fields";
import { loadFields, normalizeOptions, serializeField } from "@/lib/candidate-custom";

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
    await requireAuth(req);
    const body = await readJson<Record<string, unknown>>(req);
    const label = str(body.label).trim();
    if (!label) throw new ApiError(400, "Field name is required");
    if (label.length > 100) throw new ApiError(400, "Field name is too long (max 100 characters)");
    const type = str(body.type);
    if (!(FIELD_TYPES as readonly string[]).includes(type)) throw new ApiError(400, "Invalid field type");

    const options = type === "select" ? normalizeOptions(body.options) : [];
    if (type === "select" && options.length === 0) throw new ApiError(400, "Add at least one option");

    const existing = await db.candidateField.findMany({ select: { label: true, sortOrder: true } });
    if (existing.length >= MAX_FIELDS) throw new ApiError(400, "Maximum number of fields reached");
    if (existing.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      throw new ApiError(409, "A field with this name already exists");
    }
    const sortOrder = existing.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;

    const row = await db.candidateField.create({
      data: {
        label,
        labelCkb: str(body.labelCkb).trim().slice(0, 100),
        type,
        options: JSON.stringify(options),
        required: body.required === true,
        sortOrder,
      },
    });
    return json(serializeField(row), 201);
  });
}
