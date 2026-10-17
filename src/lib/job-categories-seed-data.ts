// OpenRecruitOS: ISCO-08 starter classification (ILO International Standard Classification of Occupations).
//
// Loaded automatically the first time the classification tree is requested
// while the table is empty. Levels: 1 major group, 2 sub-major, 3 minor,
// 4 unit group. It covers all 10 major and 43 sub-major groups, plus the
// detailed minor/unit groups for managers (partly), professionals, associate
// professionals (business, ICT) and clerks. Add the remaining branches in the
// "Job Classification" screen or with CSV import; anything deeper than level 4
// (your own specialisations) is yours to add.
//
// Line format:  code|English name|Kurdish Sorani name (optional)
// A category's parent is the entry whose code is its code minus the last digit.

export const ISCO_SEED = `1|Managers|بەڕێوەبەران
2|Professionals|پیشەگەران
3|Technicians and Associate Professionals|تەکنیسیەن و یاریدەدەری پیشەگەران
4|Clerical Support Workers|کارمەندانی پشتگیری نووسینگەیی
5|Services and Sales Workers|کارمەندانی خزمەتگوزاری و فرۆشتن
6|Skilled Agricultural, Forestry and Fishery Workers|کارمەندانی شارەزای کشتوکاڵ، دارستان و ماسیگرتن
7|Craft and Related Trades Workers|پیشە دەستییەکان و پیشە پەیوەندیدارەکان
8|Plant and Machine Operators, and Assemblers|کارپێکەرانی کارگە و ئامێر و بەکۆکەرەوەکان
9|Elementary Occupations|پیشە سەرەتاییەکان
0|Armed Forces Occupations|پیشەکانی هێزە چەکدارەکان
01|Commissioned Armed Forces Officers|ئەفسەرانی هێزە چەکدارەکان
02|Non-commissioned Armed Forces Officers|ژێرئەفسەرانی هێزە چەکدارەکان
03|Armed Forces Occupations, Other Ranks|پیشەکانی هێزە چەکدارەکان، پلەکانی تر
11|Chief Executives, Senior Officials and Legislators|بەڕێوەبەرە باڵاکان، بەرپرسە باڵاکان و یاسادانەران
12|Administrative and Commercial Managers|بەڕێوەبەرانی کارگێڕی و بازرگانی
13|Production and Specialized Services Managers|بەڕێوەبەرانی بەرهەمهێنان و خزمەتگوزارییە تایبەتمەندەکان
14|Hospitality, Retail and Other Services Managers|بەڕێوەبەرانی میوانداری، تاکفرۆشی و خزمەتگوزارییەکانی تر
21|Science and Engineering Professionals|پیشەگەرانی زانست و ئەندازیاری
22|Health Professionals|پیشەگەرانی تەندروستی
23|Teaching Professionals|پیشەگەرانی وانەوتنەوە
24|Business and Administration Professionals|پیشەگەرانی بازرگانی و کارگێڕی
25|Information and Communications Technology Professionals|پیشەگەرانی تەکنەلۆجیای زانیاری و پەیوەندییەکان
26|Legal, Social and Cultural Professionals|پیشەگەرانی یاسایی، کۆمەڵایەتی و کولتووری
31|Science and Engineering Associate Professionals|یاریدەدەری پیشەگەرانی زانست و ئەندازیاری
32|Health Associate Professionals|یاریدەدەری پیشەگەرانی تەندروستی
33|Business and Administration Associate Professionals|یاریدەدەری پیشەگەرانی بازرگانی و کارگێڕی
34|Legal, Social, Cultural and Related Associate Professionals|یاریدەدەری پیشەگەرانی یاسایی، کۆمەڵایەتی، کولتووری و پەیوەندیدار
35|Information and Communications Technicians|تەکنیسیەنانی زانیاری و پەیوەندییەکان
41|General and Keyboard Clerks|کارمەندانی گشتی و تایپکردن
42|Customer Services Clerks|کارمەندانی خزمەتگوزاری کڕیاران
43|Numerical and Material Recording Clerks|کارمەندانی تۆمارکردنی ژمارە و کەلوپەل
44|Other Clerical Support Workers|کارمەندانی تری پشتگیری نووسینگەیی
51|Personal Services Workers|کارمەندانی خزمەتگوزاری کەسی
52|Sales Workers|کارمەندانی فرۆشتن
53|Personal Care Workers|کارمەندانی چاودێری کەسی
54|Protective Services Workers|کارمەندانی خزمەتگوزاری پاراستن
61|Market-oriented Skilled Agricultural Workers|کارمەندانی شارەزای کشتوکاڵی بازاڕمەند
62|Market-oriented Skilled Forestry, Fishery and Hunting Workers|کارمەندانی شارەزای دارستان، ماسیگرتن و ڕاوکردنی بازاڕمەند
63|Subsistence Farmers, Fishers, Hunters and Gatherers|جووتیار، ماسیگر، ڕاوچی و کۆکەرەوەی بژێوی
71|Building and Related Trades Workers (excluding Electricians)|کارمەندانی بیناسازی و پیشە پەیوەندیدارەکان (بێجگە لە کارەباچی)
72|Metal, Machinery and Related Trades Workers|کارمەندانی کانزا، ئامێر و پیشە پەیوەندیدارەکان
73|Handicraft and Printing Workers|کارمەندانی پیشەسازی دەستی و چاپکردن
74|Electrical and Electronic Trades Workers|کارمەندانی کارەبایی و ئەلیکترۆنی
75|Food Processing, Wood Working, Garment and Other Craft and Related Trades Workers|کارمەندانی پرۆسێسکردنی خۆراک، دارتاشی، جلوبەرگ و پیشە دەستییەکانی تر
81|Stationary Plant and Machine Operators|کارپێکەرانی کارگە و ئامێری جێگیر
82|Assemblers|بەکۆکەرەوەکان
83|Drivers and Mobile Plant Operators|شۆفێران و کارپێکەرانی ئامێری جووڵاو
91|Cleaners and Helpers|پاککەرەوە و یاریدەدەران
92|Agricultural, Forestry and Fishery Labourers|کرێکارانی کشتوکاڵ، دارستان و ماسیگرتن
93|Labourers in Mining, Construction, Manufacturing and Transport|کرێکارانی کانزاگەری، بیناسازی، بەرهەمهێنان و گواستنەوە
94|Food Preparation Assistants|یاریدەدەرانی ئامادەکردنی خۆراک
95|Street and Related Sales and Services Workers|کارمەندانی فرۆشتن و خزمەتگوزاری شەقام و پەیوەندیدار
96|Refuse Workers and Other Elementary Workers|کارمەندانی خاشاک و کارمەندانی سەرەتایی تر
121|Business Services and Administration Managers
1211|Finance Managers
1212|Human Resource Managers
1213|Policy and Planning Managers
1219|Business Services and Administration Managers Not Elsewhere Classified
122|Sales, Marketing and Development Managers
1221|Sales and Marketing Managers
1222|Advertising and Public Relations Managers
1223|Research and Development Managers
131|Production Managers in Agriculture, Forestry and Fisheries
1311|Agricultural and Forestry Production Managers
1312|Aquaculture and Fisheries Production Managers
132|Manufacturing, Mining, Construction, and Distribution Managers
1321|Manufacturing Managers
1322|Mining Managers
1323|Construction Managers
1324|Supply, Distribution and Related Managers
133|Information and Communications Technology Service Managers
1330|Information and Communications Technology Service Managers
134|Professional Services Managers
1341|Child Care Services Managers
1342|Health Services Managers
1343|Aged Care Services Managers
1344|Social Welfare Managers
1345|Education Managers
1346|Financial and Insurance Services Branch Managers
1349|Professional Services Managers Not Elsewhere Classified
211|Physical and Earth Science Professionals|پیشەگەرانی زانستی فیزیکی و زەوی
2111|Physicists and Astronomers
2112|Meteorologists
2113|Chemists
2114|Geologists and Geophysicists
212|Mathematicians, Actuaries and Statisticians|بیرکاریزانان، ئەکچوەری و ئامارزانان
2120|Mathematicians, Actuaries and Statisticians
213|Life Science Professionals|پیشەگەرانی زانستی ژیان
2131|Biologists, Botanists, Zoologists and Related Professionals
2132|Farming, Forestry and Fisheries Advisers
2133|Environmental Protection Professionals
214|Engineering Professionals (excluding Electrotechnology)|ئەندازیاران (بێجگە لە کارەبا-تەکنەلۆجیا)
2141|Industrial and Production Engineers
2142|Civil Engineers
2143|Environmental Engineers
2144|Mechanical Engineers
2145|Chemical Engineers
2146|Mining Engineers, Metallurgists and Related Professionals
2149|Engineering Professionals Not Elsewhere Classified
215|Electrotechnology Engineers|ئەندازیارانی کارەبا-تەکنەلۆجیا
2151|Electrical Engineers
2152|Electronics Engineers
2153|Telecommunications Engineers
216|Architects, Planners, Surveyors and Designers|تەلارسازان، پلاندانەران، پێوەرکاران و دیزاینەران
2161|Building Architects
2162|Landscape Architects
2163|Product and Garment Designers
2164|Town and Traffic Planners
2165|Cartographers and Surveyors
2166|Graphic and Multimedia Designers
221|Medical Doctors|پزیشکان
2211|Generalist Medical Practitioners
2212|Specialist Medical Practitioners
222|Nursing and Midwifery Professionals|پەرستاران و ماماکان
2221|Nursing Professionals
2222|Midwifery Professionals
223|Traditional and Complementary Medicine Professionals|پیشەگەرانی پزیشکی نەریتی و تەواوکەر
2230|Traditional and Complementary Medicine Professionals
224|Paramedical Practitioners|پارامێدیکەکان
2240|Paramedical Practitioners
225|Veterinarians|پزیشکانی ئاژەڵ
2250|Veterinarians
226|Other Health Professionals|پیشەگەرانی تری تەندروستی
2261|Dentists
2262|Pharmacists
2263|Environmental and Occupational Health and Hygiene Professionals
2264|Physiotherapists
2265|Dieticians and Nutritionists
2266|Audiologists and Speech Therapists
2267|Optometrists and Ophthalmic Opticians
2269|Health Professionals Not Elsewhere Classified
231|University and Higher Education Teachers|مامۆستایانی زانکۆ و خوێندنی باڵا
2310|University and Higher Education Teachers
232|Vocational Education Teachers|مامۆستایانی خوێندنی پیشەیی
2320|Vocational Education Teachers
233|Secondary Education Teachers|مامۆستایانی خوێندنی ناوەندی
2330|Secondary Education Teachers
234|Primary School and Early Childhood Teachers|مامۆستایانی قوتابخانەی سەرەتایی و منداڵی بچووک
2341|Primary School Teachers
2342|Early Childhood Educators
235|Other Teaching Professionals|پیشەگەرانی تری وانەوتنەوە
2351|Education Methods Specialists
2352|Special Needs Teachers
2353|Other Language Teachers
2354|Other Music Teachers
2355|Other Arts Teachers
2356|Information Technology Trainers
2359|Teaching Professionals Not Elsewhere Classified
241|Finance Professionals|پیشەگەرانی دارایی
2411|Accountants
2412|Financial and Investment Advisers
2413|Financial Analysts
242|Administration Professionals|پیشەگەرانی کارگێڕی
2421|Management and Organization Analysts
2422|Policy Administration Professionals
2423|Personnel and Careers Professionals
2424|Training and Staff Development Professionals
243|Sales, Marketing and Public Relations Professionals|پیشەگەرانی فرۆشتن، بازاڕگەری و پەیوەندییە گشتییەکان
2431|Advertising and Marketing Professionals
2432|Public Relations Professionals
2433|Technical and Medical Sales Professionals (excluding ICT)
2434|Information and Communications Technology Sales Professionals
251|Software and Applications Developers and Analysts|گەشەپێدەر و شیکەرەوەی نەرمەکاڵا و بەرنامەکان
2511|Systems Analysts
2512|Software Developers
2513|Web and Multimedia Developers
2514|Applications Programmers
2519|Software and Applications Developers and Analysts Not Elsewhere Classified
252|Database and Network Professionals|پیشەگەرانی بنکەدراوە و تۆڕ
2521|Database Designers and Administrators
2522|Systems Administrators
2523|Computer Network Professionals
2529|Database and Network Professionals Not Elsewhere Classified
261|Legal Professionals|پیشەگەرانی یاسایی
2611|Lawyers
2612|Judges
2619|Legal Professionals Not Elsewhere Classified
262|Librarians, Archivists and Curators|کتێبخانەوان، ئەرشیڤوان و بەڕێوەبەری مۆزەخانە
2621|Archivists and Curators
2622|Librarians and Related Information Professionals
263|Social and Religious Professionals|پیشەگەرانی کۆمەڵایەتی و ئایینی
2631|Economists
2632|Sociologists, Anthropologists and Related Professionals
2633|Philosophers, Historians and Political Scientists
2634|Psychologists
2635|Social Work and Counselling Professionals
2636|Religious Professionals
264|Authors, Journalists and Linguists|نووسەر، ڕۆژنامەنووس و زمانەوان
2641|Authors and Related Writers
2642|Journalists
2643|Translators, Interpreters and Other Linguists
265|Creative and Performing Artists|هونەرمەندانی داهێنەر و نمایشکار
2651|Visual Artists
2652|Musicians, Singers and Composers
2653|Dancers and Choreographers
2654|Film, Stage and Related Directors and Producers
2655|Actors
2656|Announcers on Radio, Television and Other Media
2659|Creative and Performing Artists Not Elsewhere Classified
331|Financial and Mathematical Associate Professionals
3311|Securities and Finance Dealers and Brokers
3312|Credit and Loans Officers
3313|Accounting Associate Professionals
3314|Statistical, Mathematical and Related Associate Professionals
3315|Valuers and Loss Assessors
332|Sales and Purchasing Agents and Brokers
3321|Insurance Representatives
3322|Commercial Sales Representatives
3323|Buyers
3324|Trade Brokers
333|Business Services Agents
3331|Clearing and Forwarding Agents
3332|Conference and Event Planners
3333|Employment Agents and Contractors
3334|Real Estate Agents and Property Managers
3339|Business Services Agents Not Elsewhere Classified
334|Administrative and Specialized Secretaries
3341|Office Supervisors
3342|Legal Secretaries
3343|Administrative and Executive Secretaries
3344|Medical Secretaries
335|Regulatory Government Associate Professionals
3351|Customs and Border Inspectors
3352|Government Tax and Excise Officials
3353|Government Social Benefits Officials
3354|Government Licensing Officials
3355|Police Inspectors and Detectives
3359|Regulatory Government Associate Professionals Not Elsewhere Classified
351|Information and Communications Technology Operations and User Support Technicians
3511|Information and Communications Technology Operations Technicians
3512|Information and Communications Technology User Support Technicians
3513|Computer Network and Systems Technicians
3514|Web Technicians
352|Telecommunications and Broadcasting Technicians
3521|Broadcasting and Audiovisual Technicians
3522|Telecommunications Engineering Technicians
411|General Office Clerks
4110|General Office Clerks
412|Secretaries (General)
4120|Secretaries (General)
413|Keyboard Operators
4131|Typists and Word Processing Operators
4132|Data Entry Clerks
421|Tellers, Money Collectors and Related Clerks
4211|Bank Tellers and Related Clerks
4212|Bookmakers, Croupiers and Related Gaming Workers
4213|Pawnbrokers and Money-lenders
4214|Debt-collectors and Related Workers
422|Client Information Workers
4221|Travel Consultants and Clerks
4222|Contact Centre Information Clerks
4223|Telephone Switchboard Operators
4224|Hotel Receptionists
4225|Enquiry Clerks
4226|Receptionists (General)
4227|Survey and Market Research Interviewers
4229|Client Information Workers Not Elsewhere Classified
431|Numerical Clerks
4311|Accounting and Bookkeeping Clerks
4312|Statistical, Finance and Insurance Clerks
4313|Payroll Clerks
432|Material-recording and Transport Clerks
4321|Stock Clerks
4322|Production Clerks
4323|Transport Clerks
441|Other Clerical Support Workers
4411|Library Clerks
4412|Mail Carriers and Sorting Clerks
4413|Coding, Proof-reading and Related Clerks
4414|Scribes and Related Workers
4415|Filing and Copying Clerks
4416|Personnel Clerks
4419|Clerical Support Workers Not Elsewhere Classified`;

export type SeedRow = { code: string; name: string; nameCkb: string };

export function parseSeed(): SeedRow[] {
  return ISCO_SEED.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [code, name, nameCkb] = l.split("|");
      return { code, name, nameCkb: nameCkb ?? "" };
    });
}
