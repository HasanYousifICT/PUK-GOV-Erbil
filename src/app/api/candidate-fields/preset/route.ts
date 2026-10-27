import { db } from "@/lib/db";
import { ApiError, handle, json, requireAdmin } from "@/lib/api";
import { MAX_FIELDS } from "@/lib/candidate-fields";
import { DEFAULT_SECTIONS, normalizeColumns, normalizeOptions } from "@/lib/candidate-custom";
import { BOARD_FIELDS, BOARD_SECTIONS } from "@/lib/presets/board-form";

/**
 * POST /api/candidate-fields/preset — add the Jotform "board" fields (administrators only).
 * Safe to run twice: sections and fields that already exist (same name) are skipped.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const sectionRows = await db.candidateSection.findMany();
    const bySection = new Map<string, string>(sectionRows.map((s): [string, string] => [s.name.toLowerCase(), s.id]));
    let order = sectionRows.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
    let createdSections = 0;
    const sectionIds = new Map<string, string>();
    for (const s of BOARD_SECTIONS) {
      let id = bySection.get(s.name.toLowerCase());
      if (!id) {
        const row = await db.candidateSection.create({ data: { name: s.name, nameCkb: s.nameCkb, sortOrder: order++ } });
        id = row.id;
        createdSections++;
      }
      sectionIds.set(s.key, id);
    }

    const existing = await db.candidateField.findMany({ select: { label: true, sortOrder: true } });
    const have = new Set(existing.map((e) => e.label.toLowerCase()));
    let sortOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;
    const todo = BOARD_FIELDS.filter((x) => !have.has(x.label.toLowerCase()));
    if (existing.length + todo.length > MAX_FIELDS) throw new ApiError(400, "Maximum number of fields reached");

    for (const x of todo) {
      const options = x.type === "table" ? normalizeColumns(x.options) : x.type === "select" ? normalizeOptions(x.options) : [];
      await db.candidateField.create({
        data: {
          label: x.label,
          labelCkb: x.labelCkb,
          type: x.type,
          options: JSON.stringify(options),
          required: x.required === true,
          publicForm: true,
          sectionId: sectionIds.get(x.section)!,
          sortOrder: sortOrder++,
        },
      });
    }

    // Automatic behaviour: the age is calculated from the date of birth, and the city of birth fills Location.
    const all = await db.candidateField.findMany({ select: { id: true, label: true, settings: true } });
    const byLabel = new Map(all.map((x) => [x.label.toLowerCase(), x]));
    const dob = byLabel.get("date of birth");
    const age = byLabel.get("age (years)");
    const city = byLabel.get("place of birth (city)");
    if (dob && age && !age.settings.replace(/[{}\s]/g, "")) {
      await db.candidateField.update({ where: { id: age.id }, data: { settings: JSON.stringify({ ageFrom: dob.id }), required: false } });
    }
    if (city && !city.settings.replace(/[{}\s]/g, "")) {
      await db.candidateField.update({ where: { id: city.id }, data: { settings: JSON.stringify({ toLocation: true }) } });
    }

    // The built-in starter sections ("Summary of information", "Experience", …) are not needed once the
    // form sections exist: remove them when they hold no fields (sections that are in use are kept).
    const starter = new Set(DEFAULT_SECTIONS.map(([name]) => name.toLowerCase()));
    const fieldsPerSection = await db.candidateField.groupBy({ by: ["sectionId"], _count: { _all: true } });
    const used = new Set(fieldsPerSection.map((g) => g.sectionId));
    const wanted = new Set(BOARD_SECTIONS.map((s) => s.name.toLowerCase()));
    let removedSections = 0;
    for (const s of await db.candidateSection.findMany()) {
      if (starter.has(s.name.toLowerCase()) && !wanted.has(s.name.toLowerCase()) && !used.has(s.id)) {
        await db.candidateSection.delete({ where: { id: s.id } });
        removedSections++;
      }
    }
    return json({ sections: createdSections, fields: todo.length, skipped: BOARD_FIELDS.length - todo.length, removedSections });
  });
}
