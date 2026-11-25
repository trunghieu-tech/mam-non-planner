import {
  AlignmentType,
  BorderStyle,
  Document,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { packDocxBinary } from '../shared/binary.js';
import type {
  AnnualPlanDocument,
  ClassProfile,
  ObjectiveItem,
  ThemeMonthAllocation,
  WeeklyPlanDocument,
} from '../shared/types.js';

const FONT = 'Times New Roman';
const BRAND = '1D4ED8';
const BRAND_LIGHT = 'DBEAFE';
const BORDER = '94A3B8';

function cm(val: number): number {
  return Math.round(val * 567);
}

function fmtDateVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function addDays(iso: string, days: number): string {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function p(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align || AlignmentType.LEFT,
    spacing: { before: opts?.before ?? 30, after: opts?.after ?? 30, line: 250 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: (opts?.size ?? 11) * 2,
        bold: opts?.bold,
        italics: opts?.italic,
        color: opts?.color || '1E293B',
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  opts?: {
    fill?: string;
    widthPct?: number;
    vAlign?: typeof VerticalAlign.TOP | typeof VerticalAlign.CENTER | typeof VerticalAlign.BOTTOM;
    noBorders?: boolean;
  }
): TableCell {
  const b = opts?.noBorders
    ? { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    : { style: BorderStyle.SINGLE, size: 4, color: BORDER };
  return new TableCell({
    verticalAlign: opts?.vAlign || VerticalAlign.TOP,
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    borders: { top: b, bottom: b, left: b, right: b },
    children,
  });
}

/**
 * Xuất Sổ KẾ HOẠCH GIÁO DỤC NĂM HỌC (.docx) gồm:
 * I. Dự kiến Chủ đề – Sự kiện cả năm (4–5 tuần/tháng)
 * II. Khung Thời khóa biểu Tuần lẻ / Tuần chẵn
 * III. Bảng Phân phối Mục tiêu – Nội dung Giáo dục Năm học (✓ dạy, ★ đánh giá, ☆ cuối độ tuổi)
 * IV. Các hoạt động ngoài mục tiêu & Danh sách trẻ của lớp
 */
export async function generateAnnualPlanDocx(
  annualPlan: AnnualPlanDocument,
  allObjectives: ObjectiveItem[]
): Promise<Uint8Array> {
  const prof = annualPlan.profile;
  const customList = annualPlan.customObjectives || [];
  const gradeObjs = [
    ...allObjectives.filter((o) => o.ageGroupId === annualPlan.ageGroupId),
    ...customList.filter(
      (c) => !allObjectives.some((o) => o.ageGroupId === annualPlan.ageGroupId && o.code === c.code)
    ),
  ];
  const customCodes = new Set(customList.map((c) => c.code));
  const eoySet = new Set(annualPlan.endOfYearMtCodes || gradeObjs.map((o) => o.code));
  const maxWeeks = Math.max(4, ...annualPlan.themes.map((t) => t.totalWeeks || 4));

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p((prof.governingBody || 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO').toUpperCase(), {
                size: 10.5,
                align: AlignmentType.CENTER,
              }),
              p((prof.schoolName || 'TRƯỜNG MẦM NON').toUpperCase(), {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
              }),
            ],
            { widthPct: 45, noBorders: true }
          ),
          cell(
            [
              p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
              }),
              p('Độc lập - Tự do - Hạnh phúc', {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
              }),
            ],
            { widthPct: 55, noBorders: true }
          ),
        ],
      }),
    ],
  });

  // I. Bảng Dự kiến Chủ đề – Nhánh tuần – Sự kiện
  const themeHeaderCells = [
    cell([p('Tháng', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 8,
    }),
    cell([p('Chủ đề chính & Thời gian', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 22,
    }),
    ...Array.from({ length: maxWeeks }, (_, idx) =>
      cell([p(`Tuần ${idx + 1}`, { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
        fill: BRAND,
        widthPct: Math.floor(54 / maxWeeks),
      })
    ),
    cell([p('Sự kiện / Lễ hội', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 16,
    }),
  ];

  const themeRows: TableRow[] = [
    new TableRow({ tableHeader: true, children: themeHeaderCells }),
    ...annualPlan.themes.map((th) => {
      const endIso = addDays(th.startDate, th.totalWeeks * 7 - 3);
      return new TableRow({
        children: [
          cell([p(th.monthLabel, { bold: true, size: 10, color: BRAND, align: AlignmentType.CENTER })], {
            fill: BRAND_LIGHT,
            widthPct: 8,
          }),
          cell(
            [
              p(th.themeName, { bold: true, size: 10 }),
              p(`${fmtDateVN(th.startDate)} – ${fmtDateVN(endIso)} (${th.totalWeeks} tuần)`, {
                italic: true,
                size: 9.5,
                color: '475569',
              }),
            ],
            { widthPct: 22 }
          ),
          ...Array.from({ length: maxWeeks }, (_, wIdx) => {
            const sub = wIdx < th.totalWeeks ? th.subThemes[wIdx] || `Nhánh tuần ${wIdx + 1}` : '—';
            const ws = addDays(th.startDate, wIdx * 7);
            const we = addDays(ws, 4);
            return cell(
              wIdx < th.totalWeeks
                ? [
                    p(sub, { size: 9.5, bold: true }),
                    p(`${ws.slice(8, 10)}/${ws.slice(5, 7)}–${we.slice(8, 10)}/${we.slice(5, 7)}`, {
                      size: 8.5,
                      italic: true,
                      color: '64748B',
                    }),
                  ]
                : [p('—', { size: 9.5, align: AlignmentType.CENTER, color: '94A3B8' })],
              { widthPct: Math.floor(54 / maxWeeks) }
            );
          }),
          cell([p(th.festivalNote || '', { size: 9.5, italic: true })], { widthPct: 16 }),
        ],
      });
    }),
  ];

  // II. Khung Thời khóa biểu Tuần lẻ / Tuần chẵn
  const tt = annualPlan.timetable;
  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
  const ttTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell([p('Phiên chế', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
            fill: BRAND,
            widthPct: 15,
          }),
          ...dayNames.map((dn) =>
            cell([p(dn, { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
              fill: BRAND,
              widthPct: 17,
            })
          ),
        ],
      }),
      new TableRow({
        children: [
          cell([p('Tuần lẻ (1, 3, 5...)', { bold: true, size: 10, color: BRAND })], {
            fill: BRAND_LIGHT,
            widthPct: 15,
          }),
          ...[0, 1, 2, 3, 4].map((dIdx) =>
            cell([p((tt?.oddWeek?.[dIdx] || []).join(', ') || '—', { size: 10, align: AlignmentType.CENTER })], {
              widthPct: 17,
            })
          ),
        ],
      }),
      new TableRow({
        children: [
          cell([p('Tuần chẵn (2, 4, 6...)', { bold: true, size: 10, color: BRAND })], {
            fill: BRAND_LIGHT,
            widthPct: 15,
          }),
          ...[0, 1, 2, 3, 4].map((dIdx) =>
            cell([p((tt?.evenWeek?.[dIdx] || []).join(', ') || '—', { size: 10, align: AlignmentType.CENTER })], {
              widthPct: 17,
            })
          ),
        ],
      }),
    ],
  });

  // III. Bảng Phân phối Mục tiêu – Nội dung GD × 9 Tháng
  const mtHeaderCells = [
    cell([p('Mã MT', { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 7,
    }),
    cell([p('Mục tiêu giáo dục', { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 28,
    }),
    cell([p('Nội dung – Hoạt động GD', { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 25,
    }),
    ...annualPlan.themes.map((t) =>
      cell([p(`T${t.monthNumber}`, { bold: true, size: 9, color: 'FFFFFF', align: AlignmentType.CENTER })], {
        fill: BRAND,
        widthPct: 4,
      })
    ),
    cell([p('Cuối tuổi', { bold: true, size: 9, color: 'FFFFFF', align: AlignmentType.CENTER })], {
      fill: BRAND,
      widthPct: 4,
    }),
  ];

  const mtRows: TableRow[] = [
    new TableRow({ tableHeader: true, children: mtHeaderCells }),
    ...gradeObjs.map((obj) => {
      const isCustom = customCodes.has(obj.code);
      const eduText =
        annualPlan.customEduContentByMt?.[obj.code] ||
        obj.eduContent ||
        obj.activities.map((a) => `[${a.type}] ${a.text}`).slice(0, 2).join('; ');

      return new TableRow({
        children: [
          cell(
            [
              p(`${obj.code}${isCustom ? '*' : ''}`, {
                bold: true,
                size: 9.5,
                color: isCustom ? 'BE123C' : BRAND,
                align: AlignmentType.CENTER,
              }),
            ],
            { widthPct: 7 }
          ),
          cell(
            [
              p(obj.description, {
                size: 9.5,
                italic: isCustom,
                color: isCustom ? '9F1239' : '1E293B',
              }),
            ],
            { widthPct: 28 }
          ),
          cell([p(eduText || '—', { size: 9.5 })], { widthPct: 25 }),
          ...annualPlan.themes.map((t) => {
            const inM = t.plannedMtCodes.includes(obj.code);
            const star = (t.assessmentMtCodes || []).includes(obj.code);
            const mark = star ? '★' : inM ? '✓' : '';
            return cell(
              [
                p(mark, {
                  bold: true,
                  size: 10,
                  color: star ? 'B45309' : BRAND,
                  align: AlignmentType.CENTER,
                }),
              ],
              { widthPct: 4 }
            );
          }),
          cell(
            [
              p(eoySet.has(obj.code) ? '☆' : '', {
                bold: true,
                size: 10,
                color: BRAND,
                align: AlignmentType.CENTER,
              }),
            ],
            { widthPct: 4 }
          ),
        ],
      });
    }),
  ];

  const signTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p('BAN GIÁM HIỆU PHÊ DUYỆT', { bold: true, size: 10.5, align: AlignmentType.CENTER, before: 140 }),
              p('(Ký tên, đóng dấu)', { italic: true, size: 10, align: AlignmentType.CENTER, after: 360 }),
              p(prof.principalName || '', { bold: true, size: 11, align: AlignmentType.CENTER }),
            ],
            { widthPct: 50, noBorders: true }
          ),
          cell(
            [
              p('GIÁO VIÊN LẬP KẾ HOẠCH', { bold: true, size: 10.5, align: AlignmentType.CENTER, before: 140 }),
              p('(Ký, ghi rõ họ tên)', { italic: true, size: 10, align: AlignmentType.CENTER, after: 360 }),
              p(
                [prof.teacherName, prof.coTeacherName].filter(Boolean).join('  –  '),
                { bold: true, size: 11, align: AlignmentType.CENTER }
              ),
            ],
            { widthPct: 50, noBorders: true }
          ),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: cm(1.5), bottom: cm(1.5), left: cm(1.8), right: cm(1.5) },
          },
        },
        children: [
          headerTable,
          p(`KẾ HOẠCH GIÁO DỤC NĂM HỌC ${prof.schoolYear || '2026 – 2027'}`, {
            bold: true,
            size: 15,
            color: BRAND,
            align: AlignmentType.CENTER,
            before: 120,
            after: 30,
          }),
          p(
            `Lớp: ${prof.className}  •  Sĩ số: ${prof.students.length} trẻ  •  Giáo viên phụ trách: ${[
              prof.teacherName,
              prof.coTeacherName,
            ]
              .filter(Boolean)
              .join(' & ')}`,
            { italic: true, size: 11, align: AlignmentType.CENTER, after: 120 }
          ),
          p('I. DỰ KIẾN CHỦ ĐỀ – NHÁNH TUẦN – SỰ KIỆN TRONG NĂM HỌC', {
            bold: true,
            size: 12,
            color: BRAND,
            before: 80,
            after: 60,
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: themeRows }),
          p('II. KHUNG THỜI KHÓA BIỂU HOẠT ĐỘNG HỌC (TUẦN LẺ / TUẦN CHẴN)', {
            bold: true,
            size: 12,
            color: BRAND,
            before: 140,
            after: 60,
          }),
          ttTable,
          new Paragraph({ children: [new PageBreak()] }),
          p(
            'III. PHÂN PHỐI MỤC TIÊU & NỘI DUNG GIÁO DỤC 9 THÁNG (✓: Tháng dạy · ★: Tháng đánh giá · *: MT mở rộng của lớp)',
            { bold: true, size: 12, color: BRAND, before: 60, after: 60 }
          ),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: mtRows }),
          ...(annualPlan.nonObjectiveActivitiesNote
            ? [
                p('IV. CÁC HOẠT ĐỘNG GIÁO DỤC KHÔNG PHỤC VỤ MỤC TIÊU CỤ THỂ', {
                  bold: true,
                  size: 11.5,
                  color: BRAND,
                  before: 120,
                  after: 40,
                }),
                p(annualPlan.nonObjectiveActivitiesNote, { size: 10.5 }),
              ]
            : []),
          signTable,
        ],
      },
    ],
  });

  return packDocxBinary(doc);
}

/**
 * Xuất Sổ KẾ HOẠCH GIÁO DỤC THÁNG (.docx, khổ ngang A4) — Ma trận các Tuần trong tháng × 8 Giờ sinh hoạt + Mục tiêu thực hiện
 */
export async function generateMonthlyPlanDocx(
  theme: ThemeMonthAllocation,
  monthPlans: WeeklyPlanDocument[],
  allObjectives: ObjectiveItem[],
  profile: ClassProfile
): Promise<Uint8Array> {
  const numWeeks = Math.max(3, theme.totalWeeks || 4);
  const weekCols = Array.from({ length: numWeeks }, (_, wIdx) => {
    const ws = addDays(theme.startDate, wIdx * 7);
    const we = addDays(ws, 4);
    const found = monthPlans.find(
      (pl) =>
        pl.weekStartDate === ws ||
        (pl.annualThemeId === theme.id && pl.subThemeName === theme.subThemes[wIdx])
    );
    return { wIdx, ws, we, subName: theme.subThemes[wIdx] || `Tuần ${wIdx + 1}`, plan: found };
  });

  const colW = Math.floor(68 / numWeeks);
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([p('Thời gian / Hoạt động', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 18,
        }),
        ...weekCols.map((wc) =>
          cell(
            [
              p(`Tuần ${wc.wIdx + 1} (${wc.ws.slice(8, 10)}/${wc.ws.slice(5, 7)}–${wc.we.slice(8, 10)}/${wc.we.slice(5, 7)})`, {
                bold: true,
                size: 9.5,
                color: 'FFFFFF',
                align: AlignmentType.CENTER,
              }),
              p(wc.subName, { italic: true, size: 9, color: 'DBEAFE', align: AlignmentType.CENTER }),
            ],
            { fill: BRAND, widthPct: colW }
          )
        ),
        cell([p('Mục tiêu thực hiện', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 14,
        }),
      ],
    }),
  ];

  const pushMatrixRow = (
    slotTitle: string,
    getCellLines: (pl?: WeeklyPlanDocument) => string[],
    mtCodes: string[]
  ) => {
    rows.push(
      new TableRow({
        children: [
          cell([p(slotTitle, { bold: true, size: 10, color: BRAND })], { fill: BRAND_LIGHT, widthPct: 18 }),
          ...weekCols.map((wc) => {
            const lines = getCellLines(wc.plan);
            return cell(
              lines.length > 0
                ? lines.map((ln) => p(ln, { size: 9.5 }))
                : [p('Chưa lập chi tiết tuần', { italic: true, size: 9, color: '94A3B8' })],
              { widthPct: colW }
            );
          }),
          cell([p(Array.from(new Set(mtCodes)).join(', ') || '—', { bold: true, size: 9.5, color: BRAND })], {
            widthPct: 14,
          }),
        ],
      })
    );
  };

  const allRoutineMts = weekCols.flatMap((wc) => wc.plan?.routineMtCodes || []);
  const allMainMts = weekCols.flatMap((wc) =>
    (wc.plan?.days || [])
      .filter((d) => !d.isHoliday)
      .flatMap((d) => d.mainLessons.flatMap((l) => l.linkedMtCodes || []))
  );
  const allAfternoonMts = weekCols.flatMap((wc) =>
    (wc.plan?.days || [])
      .filter((d) => !d.isHoliday)
      .flatMap((d) => d.afternoonLesson?.linkedMtCodes || [])
  );

  pushMatrixRow(
    '1. Đón trẻ & Thể dục sáng',
    (pl) =>
      pl
        ? [
            ...(pl.welcomeRoutineNotes || []).slice(0, 1).map((x) => `• Đón trẻ: ${x}`),
            `• TDS: ${pl.morningExercise.moves.map((m) => m.name).slice(0, 3).join('; ')}`,
          ]
        : [],
    allRoutineMts
  );

  pushMatrixRow(
    '2. Trò chuyện sáng',
    (pl) =>
      pl
        ? (pl.morningTalkNotes?.length ? pl.morningTalkNotes : pl.welcomeRoutineNotes.slice(1, 2)).map(
            (x) => `• ${x}`
          )
        : [],
    allRoutineMts
  );

  pushMatrixRow(
    '3. Hoạt động học (T2 → T6)',
    (pl) =>
      pl
        ? pl.days.map((d) =>
            d.isHoliday
              ? `• ${d.dayLabel}: Nghỉ (${d.holidayName || 'Lễ'})`
              : `• ${d.dayLabel}: ${
                  d.mainLessons
                    .map(
                      (l) =>
                        `[${l.subjectCode}] ${l.topicTitle}${
                          l.linkedMtCodes?.length ? ` (${l.linkedMtCodes.join(',')})` : ''
                        }`
                    )
                    .join('; ') || '—'
                }`
          )
        : [],
    allMainMts
  );

  pushMatrixRow(
    '4. Hoạt động ngoài trời',
    (pl) =>
      pl
        ? pl.days
            .filter((d) => !d.isHoliday && d.outdoorObservation)
            .slice(0, 4)
            .map((d) => `• ${d.dayLabel}: ${d.outdoorObservation}`)
        : [],
    allRoutineMts
  );

  pushMatrixRow(
    '5. Hoạt động chơi góc',
    (pl) => (pl ? pl.cornerTable.slice(0, 4).map((c) => `• ${c.cornerName}: ${c.contents[0] || ''}`) : []),
    allRoutineMts
  );

  pushMatrixRow(
    '6. Ăn – Ngủ – Vệ sinh',
    (pl) => (pl ? pl.laborHygieneNotes.slice(0, 2).map((n) => `• ${n}`) : []),
    allRoutineMts
  );

  pushMatrixRow(
    '7. Hoạt động chiều & Nêu gương',
    (pl) =>
      pl
        ? pl.days
            .filter((d) => !d.isHoliday && d.afternoonLesson)
            .slice(0, 4)
            .map((d) => `• ${d.dayLabel}: [${d.afternoonLesson!.subjectCode}] ${d.afternoonLesson!.topicTitle}`)
        : [],
    allAfternoonMts
  );

  pushMatrixRow(
    '8. Đánh giá KQ thực hiện của GV',
    (pl) => (pl ? [pl.weeklyTeacherNote || 'Đa số trẻ hứng thú, nắm bắt tốt mục tiêu tuần.'] : []),
    theme.assessmentMtCodes || []
  );

  const objMap = new Map(allObjectives.map((o) => [o.code, o]));
  const starSummary = (theme.assessmentMtCodes || [])
    .map((c) => `${c}${objMap.get(c) ? `: ${objMap.get(c)!.description}` : ''}`)
    .join('  |  ');

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: cm(1.4), bottom: cm(1.4), left: cm(1.6), right: cm(1.5) },
          },
        },
        children: [
          p(
            `${(profile.schoolName || 'TRƯỜNG MẦM NON').toUpperCase()}  •  LỚP: ${profile.className}  •  NĂM HỌC: ${
              profile.schoolYear
            }`,
            { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER }
          ),
          p(`KẾ HOẠCH GIÁO DỤC ${theme.monthLabel.toUpperCase()} — CHỦ ĐỀ: ${theme.themeName.toUpperCase()}`, {
            bold: true,
            size: 14,
            align: AlignmentType.CENTER,
            before: 30,
            after: 25,
          }),
          p(
            `Giáo viên phụ trách: ${[profile.teacherName, profile.coTeacherName].filter(Boolean).join(' & ')}  •  Tổng số MT phân phối tháng: ${
              theme.plannedMtCodes.length
            } mã MT`,
            { italic: true, size: 10.5, align: AlignmentType.CENTER, after: 80 }
          ),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
          ...(starSummary
            ? [
                p(`★ Mục tiêu trọng tâm đánh giá trong ${theme.monthLabel}: ${starSummary}`, {
                  italic: true,
                  size: 9.5,
                  color: '92400E',
                  before: 90,
                }),
              ]
            : []),
        ],
      },
    ],
  });

  return packDocxBinary(doc);
}
