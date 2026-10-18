// Preset: the fields of the "Central Government Board — Organizational Affairs Office" Jotform,
// so the candidate profile / application form collects the same details.
// Labels are English (label) + Kurdish Sorani (labelCkb); dropdown choices keep the original Kurdish/Arabic text.

import type { FieldType } from "@/lib/candidate-fields";

export type PresetSection = { key: string; name: string; nameCkb: string };
export type PresetField = {
  section: string;
  label: string;
  labelCkb: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
};

const YES_NO = ["بەڵێ", "نەخێر"];
const HAS = ["هەیە", "نیە"];
const CITIES = ["هەولێر", "سلێمانی", "دهۆک", "هەڵەبجە", "کەرکووک", "موسڵ"];
const LEVELS = ["مامناوەند", "باش", "زۆر باش", "نایاب", "دایک", "نازانم"];
const YEARS_COLS = ["لە ساڵی", "بۆ ساڵی"];

const DISTRICTS = [
  "قەزای ناوەندیی هەولێر", "قەزای شەقڵاوە", "قەزای کۆیە", "قەزای تەق تەق", "قەزای مەخموور",
  "قەزای دەشتی هەولێر (قەزای بنەسڵاوە)", "قەزای پیرمام", "قەزای هەریر", "قەزای قوشتەپە", "قەزای عەنکاوە",
  "قەزای خەبات", "قەزای سۆران", "قەزای چۆمان", "قەزای مێرگەسۆر", "قەزای ڕەواندز", "قەزای خەلیفان",
  "قەزای سیدەکان", "قەزای ناوەندیی سلێمانی", "قەزای سەید سادق", "قەزای شارەزوور", "قەزای دووکان",
  "قەزای دەربەندیخان", "قەزای چەمچەماڵ", "قەزای قەرەداغ", "قەزای پێنجوێن", "قەزای شارباژێڕ", "قەزای ماوەت",
  "قەزای بازیان", "قەزای کەلار", "قەزای کفری", "قەزای خانەقین", "قەزای ڕزگاری", "قەزای ڕانیە",
  "قەزای حاجیاوا", "قەزای پشدەر", "قەزای ناوەندیی دهۆک", "قەزای ئاکرێ", "قەزای شێخان", "قەزای ئامێدی",
  "قەزای سێمێل", "قەزای بەردەڕەش", "قەزای زاخۆ", "قەزای باتیفا", "پارێزگای هەڵەبجە", "قەزای ناوەندیی هەڵەبجە",
  "قەزای خورماڵ", "قەزای ناوەندیی کەرکووک", "قەزای داقووق", "قەزای دووبز", "قەزای حەویجە", "قەزای شنگال",
  "قەزای تلکێف", "قەزای قەرەقووش", "قەزای تەلەعفەر", "قەزای بەلەدروز", "قەزای شارەبان", "قەزای مەندەلی",
  "قەزای گوڵاڵە", "قەزای دووزخورماتوو", "قەزای بەدرە",
];

const MINISTRIES_KRG = [
  "سەرۆکایەتی هەرێم", "سەرۆکایەتی پەڕڵەمان", "ئەنجوومەنی وەزیران", "وەزارەتی ناوخۆ", "وەزارەتی دارایی و ئابووری",
  "وەزارەتی سامانە سروشتییەکان", "وەزارەتی پەروەردە", "وەزارەتی پلاندانان", "وەزارەتی گواستنەوە و گەیاندن",
  "وەزارەتی کاروباری شەهیدان و ئەنفالکراوان", "وەزارەتی ئەوقاف و کاروباری ئایینی", "وەزارەتی بازرگانی و پیشەسازی",
  "وەزارەتی ئاوادانکردنەوە و نیشتەجێکردن", "وەزارەتی داد", "وەزارەتی شارەوانی و گەشتوگوزار", "وەزارەتی پێشمەرگە",
  "وەزارەتی تەندرووستی", "وەزارەتی خوێندنی باڵا و توێژینەوەی زانستی", "وەزارەتی کار و کاروباری کۆمەڵایەتی",
  "وەزارەتی ڕۆشنبیری و لاوان", "وەزارەتی کشتوکاڵ و سەرچاوەکانی ئاو", "وەزارەتی کارەبا", "وەزیری هەرێم بۆ کاروباری پەڕلەمان",
  "وەزیری هەرێم بۆ کاروباری پێکهاتەکان", "وەزیری هەرێم بۆ کاروباری دانووستان لەگەڵ حکومەتی فیدڕاڵ", "دەستەی وەبەرهێنان",
  "دەستەی پاراستن و چاککردنی ژینگە", "دەستەی گشتی ناوچە کوردستانیەکانی دەرەوەی هەرێم", "دەستەی سەربەخۆی مافی مرۆڤ",
  "دیوانی چاودێری دارایی", "سەرۆکایەتی ئەنجوومەنی دادوەری", "ڕێکخراوە ناحکوومیەکان", "ئەکادیمیای کوردی",
  "کۆمسیۆنی باڵای سەربەخۆی هەڵبژاردن و ڕاپرسی هەرێم", "کۆمسیۆنی باڵای عێراق", "دەزگای مێن", "دەستەی دەستپاکی هەرێم",
];

const MINISTRIES_IRAQ = [
  "رئاسة الجمهورية", "مجلس النواب العراقي", "مجلس الوزراء", "مجلس القضاء الأعلى", "المحكمة الاتحادية العليا",
  "الأمانة العامة لمجلس الوزراء", "مكتب رئيس مجلس الوزراء", "وزارة الدفاع", "وزارة الداخلية", "وزارة الخارجية",
  "وزارة المالية", "وزارة النفط", "وزارة الكهرباء", "وزارة التخطيط", "وزارة التجارة", "وزارة الصناعة والمعادن",
  "وزارة الزراعة", "وزارة الموارد المائية", "وزارة النقل", "وزارة الاتصالات", "وزارة الإعمار والإسكان والبلديات والأشغال العامة",
  "وزارة التربية", "وزارة التعليم العالي والبحث العلمي", "وزارة الصحة", "وزارة العمل والشؤون الاجتماعية", "وزارة العدل",
  "وزارة الثقافة والسياحة والآثار", "وزارة الشباب والرياضة", "وزارة الهجرة والمهجرين", "وزارة البيئة",
  "المفوضية العليا المستقلة للانتخابات", "المفوضية العليا لحقوق الإنسان", "هيئة النزاهة الاتحادية", "البنك المركزي العراقي",
  "ديوان الرقابة المالية الاتحادي", "هيئة الإعلام والاتصالات", "مؤسسة الشهداء", "مجلس الخدمة العامة الاتحادي",
  "دواوين الأوقاف", "الهيئة الوطنية للاستثمار", "هيئة التقاعد الوطنية", "هيئة المنافذ الحدودية", "هيئة الأوراق المالية",
  "هيئة دعاوى الملكية", "هيئة المساءلة والعدالة", "الجهاز المركزي للتقييس والسيطرة النوعية", "شبكة الإعلام العراقي",
  "مجلس الدولة", "مجلس المنافسة ومنع الاحتكار", "المركز الوطني للتحول الرقمي", "هيئة الإحصاء ونظم المعلومات الجغرافية",
];

const MILITARY_IRAQ = [
  "وزارة الدفاع", "وزارة الداخلية", "جهاز المخابرات الوطني العراقي", "جهاز الأمن الوطني العراقي",
  "مستشارية الأمن القومي", "جهاز مكافحة الإرهاب", "هيئة الحشد الشعبي",
];

const RANKS = [
  "جندي/شرطي", "جندي أول/شرطي اول", "نائب عريف", "عريف", "رئيس عرفاء", "نائب ضابط/مفوض", "ملازم", "ملازم أول",
  "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء", "فريق", "فريق أول",
];

export const BOARD_SECTIONS: PresetSection[] = [
  { key: "personal", name: "Personal information", nameCkb: "زانیاری کەسی" },
  { key: "docs", name: "Personal documents", nameCkb: "بەڵگەنامە کەسیەکان" },
  { key: "family", name: "Family status", nameCkb: "باری خێزانی" },
  { key: "contact", name: "Contact details", nameCkb: "هێڵەکانی پەیوەندیکردن" },
  { key: "education", name: "Education level", nameCkb: "ئاستی خوێندن" },
  { key: "language", name: "Language proficiency", nameCkb: "ئاستی زمان" },
  { key: "election", name: "Election participation", nameCkb: "مێژووی بەشداریکردن لە هەڵمەتەکانی هەڵبژاردن" },
  { key: "govjob", name: "Government employment", nameCkb: "زانیاری کاری حکومی" },
  { key: "party", name: "Party information", nameCkb: "زانیاری کاری حزبی" },
  { key: "martyrs", name: "Martyrs, political prisoners and disabled veterans", nameCkb: "زانیاری دەربارەی شەهیدان و زیندانیانی سیاسی و کەمئەندامانی سەنگەر" },
];

const f = (
  section: string,
  label: string,
  labelCkb: string,
  type: FieldType,
  required = false,
  options?: string[]
): PresetField => ({ section, label, labelCkb, type, required, ...(options ? { options } : {}) });

const lang = (en: string, ckb: string) => f("language", `Language: ${en}`, `زمانی ${ckb}`, "select", true, LEVELS);

export const BOARD_FIELDS: PresetField[] = [
  // Personal information (name, e-mail and main phone are already built into every candidate)
  f("personal", "Gender", "ڕەگەز", "select", true, ["نێر", "مێ", "هیتر", "نامەوێ دیاریبکەم"]),
  f("personal", "Title", "نازناو", "text", true),
  f("personal", "Mother's full name", "ناوی سیانی دایک", "text", true),
  f("personal", "Blood group", "گروپی خوێن", "select", true, ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  f("personal", "Personal photo", "وێنەی کەسی", "file", true),
  f("personal", "Date of birth", "بەرواری لەدایکبوون", "date", true),
  f("personal", "Age (years)", "تەمەن بەساڵ", "number", true),
  f("personal", "Place of birth (city)", "شوێنی لەدایکبوون (شار)", "select", true, CITIES),
  f("personal", "Place of birth (district)", "شوێنی لەدایکبوون (قەزا)", "select", true, DISTRICTS),
  // Personal documents
  f("docs", "National ID office (city)", "فەرمانگەی کارتی نیشتیمانی (شار)", "select", true, CITIES),
  f("docs", "National ID card number", "ژمارەی کارتی نیشتیمانی", "text", true),
  f("docs", "National ID family number", "ژمارەی خێزانی کارتی نیشتیمانی", "text", true),
  f("docs", "National ID issue date", "بەرواری دەرچوونی کارتی نیشتیمانی", "date", true),
  f("docs", "National ID expiry date", "بەرواری کۆتایی هاتنی کارتی نیشتیمانی", "date", true),
  f("docs", "Information card office (city)", "فەرمانگەی کارتی زانیاری (شار)", "select", true, CITIES),
  f("docs", "Information card number", "ژمارەی کارتی زانیاری", "text", true),
  f("docs", "Unique number code (UPN), if available", "کۆدی ژمارەی بێهاوتا (UPN)", "text"),
  f("docs", "Voter card number", "ژمارەی کارتی دەنگدان", "text", true),
  f("docs", "Voting location (city)", "شوێنی دەنگدان (شار)", "select", true, CITIES),
  f("docs", "Voter card type", "جۆری کارتی دەنگدان", "select", true, ["سەربازی", "شارستانی"]),
  f("docs", "Attached documents", "هاوپێچکردنی بەڵگەنامەکان", "file", true),
  // Family
  f("family", "Family status", "باری خێزانی", "select", true, ["خێزاندار", "سەڵت"]),
  f("family", "Number of family members", "ژمارەی ئەندامانی خێزان", "number"),
  f("family", "Family members", "زانیاری ئەندامانی خێزان", "table", false, ["ناو", "پەیوەندی", "بەرواری لەدایکبوون", "پیشە"]),
  // Contact
  f("contact", "Second phone number", "ژمارەی تەلەفوونی دووەم", "phone"),
  f("contact", "WhatsApp number", "ژمارەی مۆبایلی وەتساپ", "phone"),
  // Education
  f("education", "Education level", "ئاستی خوێندن", "select", true, [
    "سەرەتایی", "ناوەندی", "ئامادەیی", "پەیمانگا (دبلۆم)", "زانکۆ (بەکالۆریۆس)", "دبلۆمی باڵا", "ماستەر", "دکتۆرا",
    "پڕۆفیسۆری یاریدەدەر", "پڕۆفیسۆر",
  ]),
  f("education", "Field of specialization", "پسپۆری", "text", true),
  f("education", "Date of last degree", "بەرواری وەرگرتنی دوایین بڕوانامە", "date", true),
  f("education", "Degree attachments", "هاوپێچکردنی بڕوانامەکان", "file"),
  // Languages (the Jotform grid: one row per language)
  lang("Kurdish", "کوردی"),
  lang("Arabic", "عەرەبی"),
  lang("English", "ئینگلیزی"),
  lang("Turkish", "تورکی"),
  lang("Persian", "فارسی"),
  lang("French", "فەڕەنسی"),
  lang("German", "ئەڵمانی"),
  f("language", "Language certificate attachment", "هاوپێچکردنی بڕوانامەی زمان", "file"),
  // Election participation
  f("election", "Have you taken part in election campaigns before?", "ئایا پێشتر بەشداربوویت", "select", true, YES_NO),
  f("election", "Election campaign details", "زانیاری بەشداریکردن لە هەڵمەتی هەڵبژاردن", "longtext"),
  // Government employment (the questions that only apply to some people are optional)
  f("govjob", "Are you a government employee?", "ئایا فەرمانبەری حکومەتی", "select", true, ["بەڵێ", "نەخێر", "خانەنشینم"]),
  f("govjob", "Government employer", "فەرمانبەری حکومەت؟", "select", false, ["حکومەتی عێراقی فیدڕاڵ", "حکومەتی هەرێمی کوردستان"]),
  f("govjob", "Civil / military", "مەدەنی / سەربازی", "select", false, ["مەدەنی", "سەربازی"]),
  f("govjob", "Ministry / body / presidency (Kurdistan)", "وەزارەت / دەستە / سەرۆکایەتی - کوردستان", "select", false, MINISTRIES_KRG),
  f("govjob", "Ministry / body / presidency (Iraq)", "وەزارەت / دەستە / سەرۆکایەتی - عێراق", "select", false, MINISTRIES_IRAQ),
  f("govjob", "Employee position", "پۆستی فەرمانبەر", "text"),
  f("govjob", "Employee title", "ناونیشانی فەرمانبەر", "select", false, [
    "ڕاوێژکار", "بەڕێوەبەری گشتی", "جێگری بەڕێوەبەری گشتی", "بەڕێوەبەری پێشکەوتوو", "بەڕێوەبەری جێبەجێکردن",
    "بەڕێوەبەر", "یاریدەدەری بەڕێوەبەر", "تێبینەر",
  ]),
  f("govjob", "Employee grade", "پلەی فەرمانبەر", "select", false, ["1", "2", "3", "4", "5", "6", "7"]),
  f("govjob", "Judicial title", "ناونیشانی دادوەری", "select", false, [
    "جێگری سەرۆکی ئەنجومەنی دادوەری", "ئەندامی دادگای پێداچوونەوە", "ڕاوێژکار",
  ]),
  f("govjob", "Military (Kurdistan)", "سەربازی - کوردستان", "select", false, [
    "وەزارەتی ناوخۆ", "وەزارەتی پێشمەرگە", "دەزگای ئاسایشی هەرێم", "دادگەی سەربازی هێزەکانی ناوخۆ", "دادگای سەربازی وەزارەتی پێشمەرگە",
  ]),
  f("govjob", "Military (Iraq)", "سەربازی - عێراق", "select", false, MILITARY_IRAQ),
  f("govjob", "Military rank", "پلەی سەربازی", "select", false, RANKS),
  f("govjob", "Military post", "پۆستی سەربازی", "text"),
  f("govjob", "Workplace", "شوێنی کارکردن", "text"),
  // Party information
  f("party", "Are you a PUK cadre?", "ئایا کادیری یەکێتی نیشتیمانی کوردستانیت؟", "select", true, YES_NO),
  f("party", "Do you currently hold a party organisational rank?", "ئایا لەئێستادا پلەی ڕێکخراوەییت هەیە؟", "select", true, YES_NO),
  f("party", "Party organisational rank details", "زانیاری پلەی ڕێکخراوەیی", "table", false, ["پلە", "شوێن", ...YEARS_COLS]),
  f("party", "Government work history", "مێژووی کارکردنی حکومی", "select", true, HAS),
  f("party", "Government posts", "پۆستە حکومیەکان", "table", false, ["پۆست", "شوێن", ...YEARS_COLS]),
  f("party", "Years of government service", "ژمارەی ساڵەکانی خزمەتی حکومی", "number"),
  f("party", "Party work history", "مێژووی کارکردنی حزبی", "select", true, HAS),
  f("party", "Years of party service", "ژمارەی ساڵەکانی خزمەتی حزبی", "number"),
  f("party", "Party posts", "پۆستە حزبیەکان", "table", false, ["پۆست", "شوێن", ...YEARS_COLS]),
  f("party", "Last party rank", "دوایین پلەی حزبی", "text"),
  f("party", "Organisation service", "خزمەتی ڕێکخراوەکان", "select", true, YES_NO),
  f("party", "Years of organisation service", "ژمارەی ساڵەکانی خزمەتی ڕێکخراوەیی", "number"),
  f("party", "Work in organisations", "کارکردن لەڕێکخراوەکان", "table", false, ["ڕێکخراو", "پۆست", ...YEARS_COLS]),
  f("party", "Have you taken part in training courses?", "ئایا بەژداری خوولی ڕاهێنانت کردووە", "select", true, YES_NO),
  f("party", "Training courses", "خولەکان", "table", false, ["ناوی خول", "شوێن / دامەزراوە", "ساڵ", "ماوە"]),
  // Martyrs, political prisoners, disabled veterans
  f("martyrs", "First-degree relative of a martyr", "کەسی پلە یەکی شەهید", "select", true, HAS),
  f("martyrs", "Relationship to the martyr", "پەیوەندی شەهید", "select", false, ["دایک", "باوک", "برا", "خوشک"]),
  f("martyrs", "Were you a political prisoner?", "ئایا زیندانی سیاسی بوویت", "select", true, YES_NO),
  f("martyrs", "Year of imprisonment", "ساڵی زیندانی", "text"),
  f("martyrs", "Place of imprisonment", "شوێنی زیندانی", "text"),
  f("martyrs", "Are you a frontline disabled veteran?", "ئایا کەمئەندامی سەنگەریت", "select", true, YES_NO),
  f("martyrs", "Year of disability", "ساڵی کەمئەندامبوون", "text"),
  f("martyrs", "Frontline location of the disability", "سەنگەری کەمئەندامبوون", "text"),
];
