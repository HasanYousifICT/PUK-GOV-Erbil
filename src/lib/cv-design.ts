// Server: how candidate CVs look (admin-designed). One row, id "cv".
import { db } from "@/lib/db";

export type CvDesignInfo = {
  layout: "classic" | "modern" | "sidebar";
  accent: string;
  font: "sans" | "serif";
  showCode: boolean;
  showLogo: boolean;
  hiddenSections: string[];
  headerNote: string;
  footerNote: string;
};

export const CV_DEFAULTS: CvDesignInfo = {
  layout: "classic",
  accent: "#0369a1",
  font: "sans",
  showCode: true,
  showLogo: true,
  hiddenSections: [],
  headerNote: "",
  footerNote: "",
};

export async function getCvDesign(): Promise<CvDesignInfo> {
  try {
    const r = await db.cvDesign.findUnique({ where: { id: "cv" } });
    if (!r) return CV_DEFAULTS;
    let hidden: string[] = [];
    try {
      const v = JSON.parse(r.hiddenSections);
      if (Array.isArray(v)) hidden = v.filter((x) => typeof x === "string");
    } catch {}
    return {
      layout: r.layout === "modern" || r.layout === "sidebar" ? r.layout : "classic",
      accent: /^#[0-9a-fA-F]{6}$/.test(r.accent) ? r.accent : CV_DEFAULTS.accent,
      font: r.font === "serif" ? "serif" : "sans",
      showCode: r.showCode,
      showLogo: r.showLogo,
      hiddenSections: hidden,
      headerNote: r.headerNote,
      footerNote: r.footerNote,
    };
  } catch {
    return CV_DEFAULTS;
  }
}
