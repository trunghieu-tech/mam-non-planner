import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { ObjectiveItem, WeeklyPlanDocument } from '../shared/types.js';
import { packDocxBinary } from '../shared/binary.js';

const FONT = 'Times New Roman';
const SZ_BODY = 24; // 12pt
const SZ_SUB = 26;  // 13pt
const SZ_H1 = 28;   // 14pt
const SZ_TITLE = 36; // 18pt

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '334155' };
const TABLE_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
};
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const CELL_MARGINS = { top: 80, bottom: 80, left: 110, right: 110 };

function fmtDateVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateLongVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `ngày ${d} tháng ${m} năm ${y}`;
}

function pText(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceBefore?: number;
    spaceAfter?: number;
    color?: string;
    indentLeft?: number;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: {
      before: opts?.spaceBefore ?? 40,
      after: opts?.spaceAfter ?? 60,
      line: 276, // 1.15 line spacing
    },
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts?.size ?? SZ_BODY,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        color: opts?.color ?? '000000',
      }),
    ],
  });
}

function bulletP(text: string, prefix = '- '): Paragraph {
  return pText(`${prefix}${text}`, { indentLeft: 240, spaceBefore: 20, spaceAfter: 40 });
}

function makeCell(
  paragraphs: Paragraph[],
  opts?: {
    widthPct?: number;
    fill?: string;
    colSpan?: number;
    rowSpan?: number;
    vAlign?: 'top' | 'center' | 'bottom';
  }
): TableCell {
  return new TableCell({
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    columnSpan: opts?.colSpan,
    rowSpan: opts?.rowSpan,
    verticalAlign: opts?.vAlign ?? VerticalAlign.TOP,
    margins: CELL_MARGINS,
    children: paragraphs.length ? paragraphs : [pText('')],
  });
}

function ageGroupDisplay(id: string): string {
  switch (id) {
    case 'NHA_TRE_24_36T':
      return 'Nhà trẻ (24–36 tháng)';
    case 'MAM_3_4T':
      return 'Mẫu giáo bé – Mầm (3–4 tuổi)';
    case 'CHOI_4_5T':
      return 'Mẫu giáo nhỡ – Chồi (4–5 tuổi)';
    case 'LA_5_6T':
      return 'Mẫu giáo lớn – Lá (5–6 tuổi)';
    default:
      return id;
  }
}

export async function generateBgdDocx(
  plan: WeeklyPlanDocument,
  allObjectives: ObjectiveItem[]
): Promise<Uint8Array> {
  const mtMap = new Map<string, ObjectiveItem>();
  for (const obj of allObjectives) {
    if (obj.ageGroupId === plan.ageGroupId) {
      mtMap.set(obj.code, obj);
    }
  }

  const children: Array<Paragraph | Table> = [];

  // =========================================================================
  // 1. TRANG BÌA CHUẨN BỘ GD&ĐT (khung viền đôi lịch sự)
  // =========================================================================
  const coverTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.DOUBLE, size: 12, color: '1D4ED8' },
      bottom: { style: BorderStyle.DOUBLE, size: 12, color: '1D4ED8' },
      left: { style: BorderStyle.DOUBLE, size: 12, color: '1D4ED8' },
      right: { style: BorderStyle.DOUBLE, size: 12, color: '1D4ED8' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 480, bottom: 480, left: 360, right: 360 },
            children: [
              pText(plan.governingBody.toUpperCase(), {
                align: AlignmentType.CENTER,
                size: SZ_SUB,
                spaceBefore: 100,
              }),
              pText(plan.schoolName.toUpperCase(), {
                align: AlignmentType.CENTER,
                bold: true,
                size: SZ_H1,
                spaceAfter: 120,
              }),
              pText('────────── ★ ──────────', {
                align: AlignmentType.CENTER,
                color: '1D4ED8',
                spaceAfter: 900,
              }),
              pText('KẾ HOẠCH GIÁO DỤC MẦM NON', {
                align: AlignmentType.CENTER,
                bold: true,
                size: SZ_TITLE,
                color: '1D4ED8',
                spaceAfter: 140,
              }),
              pText(`NĂM HỌC ${plan.schoolYear}`, {
                align: AlignmentType.CENTER,
                bold: true,
                size: SZ_H1,
                spaceAfter: 600,
              }),
              pText(`CHỦ ĐỀ: ${plan.themeName.toUpperCase()}`, {
                align: AlignmentType.CENTER,
                bold: true,
                size: 32,
                spaceAfter: 160,
              }),
              pText(`Chủ đề nhánh Tuần ${plan.weekNumber}: ${plan.subThemeName}`, {
                align: AlignmentType.CENTER,
                bold: true,
                size: SZ_H1,
                spaceAfter: 140,
              }),
              pText(
                plan.includeThemeSection
                  ? `Thời gian thực hiện chủ đề: ${plan.themeTotalWeeks} tuần (Từ ${fmtDateVN(plan.themeStartDate)} đến ${fmtDateVN(plan.themeEndDate)})`
                  : `Thời gian thực hiện Tuần ${plan.weekNumber}: Từ ${fmtDateVN(plan.weekStartDate)} đến ${fmtDateVN(plan.weekEndDate)}`,
                {
                  align: AlignmentType.CENTER,
                  italic: true,
                  size: SZ_SUB,
                  spaceAfter: 1200,
                }
              ),
              pText(`Khối tuổi: ${ageGroupDisplay(plan.ageGroupId)}`, {
                bold: true,
                size: SZ_SUB,
                indentLeft: 2000,
                spaceAfter: 80,
              }),
              pText(`Lớp: ${plan.className}`, {
                bold: true,
                size: SZ_SUB,
                indentLeft: 2000,
                spaceAfter: 80,
              }),
              pText(`Giáo viên phụ trách: ${plan.teacherName}`, {
                bold: true,
                size: SZ_SUB,
                indentLeft: 2000,
                spaceAfter: 80,
              }),
              pText(`Năm học: ${plan.schoolYear}`, {
                bold: true,
                size: SZ_SUB,
                indentLeft: 2000,
                spaceAfter: 240,
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(coverTable);
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // 2. PHẦN KẾ HOẠCH CHỦ ĐỀ (Mục tiêu 5 lĩnh vực + Mạng nội dung + Mạng hoạt động)
  // =========================================================================
  if (plan.includeThemeSection) {
    children.push(
      pText(`CHỦ ĐỀ: ${plan.themeName.toUpperCase()}`, {
        align: AlignmentType.CENTER,
        bold: true,
        size: SZ_H1,
        color: '1D4ED8',
      }),
      pText(
        `Thời gian thực hiện: ${plan.themeTotalWeeks} tuần (Từ ${fmtDateLongVN(plan.themeStartDate)} đến ${fmtDateLongVN(plan.themeEndDate)})`,
        { align: AlignmentType.CENTER, italic: true, spaceAfter: 180 }
      ),
      pText('I. MỤC TIÊU CHỦ ĐỀ', { bold: true, size: SZ_SUB, spaceBefore: 120, spaceAfter: 80 })
    );

    for (const block of plan.themeObjectives) {
      children.push(pText(block.domainTitle, { bold: true, spaceBefore: 100, spaceAfter: 40 }));
      for (const g of block.customGoals) {
        if (g.trim()) children.push(bulletP(g.trim()));
      }
      for (const code of block.mtCodes) {
        const obj = mtMap.get(code);
        children.push(
          new Paragraph({
            indent: { left: 240 },
            spacing: { before: 20, after: 40, line: 276 },
            children: [
              new TextRun({ text: `${code}. `, font: FONT, size: SZ_BODY, bold: true, color: '1D4ED8' }),
              new TextRun({
                text: obj ? obj.description : '(Mục tiêu theo khung chuẩn Chương trình GDMN)',
                font: FONT,
                size: SZ_BODY,
              }),
            ],
          })
        );
      }
    }

    // MẠNG NỘI DUNG
    children.push(
      pText('II. MẠNG NỘI DUNG', {
        align: AlignmentType.CENTER,
        bold: true,
        size: SZ_SUB,
        spaceBefore: 240,
        spaceAfter: 120,
      })
    );

    if (plan.contentNetwork.length > 0) {
      const colW = Math.floor(100 / plan.contentNetwork.length);
      const cnTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: TABLE_BORDERS,
        rows: [
          new TableRow({
            children: plan.contentNetwork.map((b) =>
              makeCell(
                [pText(b.branchTitle, { align: AlignmentType.CENTER, bold: true, color: '1E3A8A' })],
                { widthPct: colW, fill: 'DBEAFE', vAlign: VerticalAlign.CENTER }
              )
            ),
          }),
          new TableRow({
            children: plan.contentNetwork.map((b) =>
              makeCell(
                b.items.filter((x) => x.trim()).map((it) => pText(`- ${it.trim()}`, { spaceAfter: 30 })),
                { widthPct: colW }
              )
            ),
          }),
        ],
      });
      children.push(cnTable);
    }

    // MẠNG HOẠT ĐỘNG (5 lĩnh vực)
    children.push(
      pText('III. MẠNG HOẠT ĐỘNG', {
        align: AlignmentType.CENTER,
        bold: true,
        size: SZ_SUB,
        spaceBefore: 260,
        spaceAfter: 120,
      })
    );

    if (plan.activityNetwork.length > 0) {
      const anRows = [
        new TableRow({
          tableHeader: true,
          children: [
            makeCell(
              [pText('LĨNH VỰC PHÁT TRIỂN', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })],
              { widthPct: 26, fill: '1D4ED8', vAlign: VerticalAlign.CENTER }
            ),
            makeCell(
              [
                pText(`HOẠT ĐỘNG GIÁO DỤC CHỦ ĐỀ: ${plan.themeName.toUpperCase()}`, {
                  align: AlignmentType.CENTER,
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
              { widthPct: 74, fill: '1D4ED8', vAlign: VerticalAlign.CENTER }
            ),
          ],
        }),
        ...plan.activityNetwork.map(
          (br) =>
            new TableRow({
              children: [
                makeCell([pText(br.domainTitle, { bold: true, color: '1E3A8A' })], {
                  widthPct: 26,
                  fill: 'F0FAF8',
                  vAlign: VerticalAlign.CENTER,
                }),
                makeCell(
                  br.items.filter((x) => x.trim()).map((it) => pText(`- ${it.trim()}`, { spaceAfter: 30 })),
                  { widthPct: 74 }
                ),
              ],
            })
        ),
      ];
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: TABLE_BORDERS,
          rows: anRows,
        })
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // =========================================================================
  // 3. KẾ HOẠCH HOẠT ĐỘNG GIÁO DỤC TUẦN (Mục tiêu tuần + Bảng tổng hợp tuần)
  // =========================================================================
  children.push(
    pText(`KẾ HOẠCH HOẠT ĐỘNG GIÁO DỤC TUẦN ${plan.weekNumber}`, {
      align: AlignmentType.CENTER,
      bold: true,
      size: SZ_H1,
      color: '1D4ED8',
    }),
    pText(`Chủ đề nhánh: ${plan.subThemeName}`, {
      align: AlignmentType.CENTER,
      bold: true,
      size: SZ_SUB,
    }),
    pText(
      `Thời gian thực hiện: Từ ${fmtDateVN(plan.weekStartDate)} đến ${fmtDateVN(plan.weekEndDate)}`,
      { align: AlignmentType.CENTER, italic: true, spaceAfter: 160 }
    ),
    pText('A. MỤC TIÊU TUẦN', { bold: true, size: SZ_SUB, spaceAfter: 60 })
  );

  for (const wObj of plan.weeklyObjectives) {
    children.push(pText(wObj.domainTitle, { bold: true, spaceBefore: 60, spaceAfter: 20 }));
    for (const g of wObj.goals) {
      if (g.trim()) children.push(bulletP(g.trim()));
    }
  }

  // BẢNG TỔNG HỢP KẾ HOẠCH TUẦN (chuẩn 5 cột y mẫu 1. Lá Trường MN Tuần 1.docx)
  children.push(
    pText(`B. BẢNG TỔNG HỢP KẾ HOẠCH HOẠT ĐỘNG TUẦN ${plan.weekNumber}`, {
      align: AlignmentType.CENTER,
      bold: true,
      size: SZ_SUB,
      spaceBefore: 200,
      spaceAfter: 100,
    })
  );

  const summaryRows: TableRow[] = [
    // Hàng LỄ GIÁO
    new TableRow({
      children: [
        makeCell([pText('LỄ GIÁO', { align: AlignmentType.CENTER, bold: true })], {
          colSpan: 2,
          fill: 'F0FAF8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell(
          plan.etiquetteNotes.filter((x) => x.trim()).map((n) => pText(`- ${n}`, { spaceAfter: 20 })),
          { colSpan: 3 }
        ),
      ],
    }),
    // Hàng THỂ DỤC SÁNG (đồng bộ 100% từ plan.morningExercise!)
    new TableRow({
      children: [
        makeCell([pText('THỂ DỤC SÁNG', { align: AlignmentType.CENTER, bold: true })], {
          colSpan: 2,
          fill: 'F0FAF8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell(
          plan.morningExercise.moves.map((m, idx) => pText(`${idx + 1}/ ${m.group}: ${m.name}`, { spaceAfter: 20 })),
          { colSpan: 3 }
        ),
      ],
    }),
    // Tiêu đề 5 cột ngày
    new TableRow({
      tableHeader: true,
      children: [
        makeCell([pText('THỨ', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], {
          widthPct: 9,
          fill: '1D4ED8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell([pText('HOẠT ĐỘNG CHUNG', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], {
          widthPct: 14,
          fill: '1D4ED8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell([pText('LUYỆN TẬP CÓ MỤC ĐÍCH', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], {
          widthPct: 31,
          fill: '1D4ED8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell([pText('HOẠT ĐỘNG NGOÀI TRỜI', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], {
          widthPct: 22,
          fill: '1D4ED8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell([pText('HOẠT ĐỘNG CHIỀU', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], {
          widthPct: 24,
          fill: '1D4ED8',
          vAlign: VerticalAlign.CENTER,
        }),
      ],
    }),
  ];

  const shortDayNames: Record<number, string> = { 2: 'HAI', 3: 'BA', 4: 'TƯ', 5: 'NĂM', 6: 'SÁU' };

  for (const day of plan.days) {
    const lessons = day.mainLessons.length > 0 ? day.mainLessons : [null];
    const span = lessons.length;
    const afternoonLines: Paragraph[] = [];
    if (day.extracurricularTitle.trim()) {
      afternoonLines.push(pText(`- ${day.extracurricularTitle.trim()}`, { bold: true, spaceAfter: 20 }));
    }
    if (day.afternoonLesson) {
      afternoonLines.push(pText(`- ${day.afternoonLesson.topicTitle}`, { spaceAfter: 20 }));
    }

    lessons.forEach((les, idx) => {
      const topicPs: Paragraph[] = [];
      if (les) {
        topicPs.push(pText(les.topicTitle, { bold: true, spaceAfter: 20 }));
        for (const st of les.subTopics) {
          if (st.trim()) topicPs.push(pText(st.trim(), { spaceAfter: 20 }));
        }
        if (les.linkedMtCodes.length > 0) {
          topicPs.push(
            pText(`(${les.linkedMtCodes.join(', ')})`, { italic: true, color: '1D4ED8', size: 20, spaceAfter: 10 })
          );
        }
      } else {
        topicPs.push(pText('—'));
      }

      const rowCells: TableCell[] = [];
      if (idx === 0) {
        rowCells.push(
          makeCell(
            [
              pText(shortDayNames[day.dayOfWeek] || day.dayLabel, { align: AlignmentType.CENTER, bold: true }),
              pText(fmtDateVN(day.dateStr).slice(0, 5), { align: AlignmentType.CENTER, size: 20, color: '475569' }),
            ],
            { widthPct: 9, rowSpan: span > 1 ? span : undefined, vAlign: VerticalAlign.CENTER }
          )
        );
      }
      rowCells.push(
        makeCell([pText(les ? les.subjectCode : '—', { align: AlignmentType.CENTER, bold: true })], {
          widthPct: 14,
          vAlign: VerticalAlign.CENTER,
        })
      );
      rowCells.push(makeCell(topicPs, { widthPct: 31 }));
      if (idx === 0) {
        rowCells.push(
          makeCell([pText(`- ${day.outdoorObservation || 'Quan sát theo chủ đề'}`)], {
            widthPct: 22,
            rowSpan: span > 1 ? span : undefined,
          })
        );
        rowCells.push(
          makeCell(afternoonLines.length ? afternoonLines : [pText('—')], {
            widthPct: 24,
            rowSpan: span > 1 ? span : undefined,
          })
        );
      }
      summaryRows.push(new TableRow({ children: rowCells }));
    });
  }

  // Hàng VUI CHƠI (5 góc)
  const cornerSummaryPs: Paragraph[] = [];
  for (const c of plan.cornerTable) {
    cornerSummaryPs.push(pText(`* ${c.cornerName}:`, { bold: true, spaceBefore: 30, spaceAfter: 10 }));
    for (const ct of c.contents) {
      if (ct.trim()) cornerSummaryPs.push(pText(`  - ${ct.trim()}`, { spaceAfter: 10 }));
    }
  }
  summaryRows.push(
    new TableRow({
      children: [
        makeCell([pText('VUI CHƠI\n(HOẠT ĐỘNG GÓC)', { align: AlignmentType.CENTER, bold: true })], {
          widthPct: 23,
          colSpan: 2,
          fill: 'F0FAF8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell(cornerSummaryPs, { widthPct: 77, colSpan: 3 }),
      ],
    })
  );

  // Hàng LAO ĐỘNG VỆ SINH
  summaryRows.push(
    new TableRow({
      children: [
        makeCell([pText('LAO ĐỘNG\nVỆ SINH', { align: AlignmentType.CENTER, bold: true })], {
          widthPct: 23,
          colSpan: 2,
          fill: 'F0FAF8',
          vAlign: VerticalAlign.CENTER,
        }),
        makeCell(
          plan.laborHygieneNotes.filter((x) => x.trim()).map((n) => pText(`- ${n}`, { spaceAfter: 20 })),
          { widthPct: 77, colSpan: 3 }
        ),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: TABLE_BORDERS,
      rows: summaryRows,
    })
  );

  // =========================================================================
  // 4. KHỐI HOẠT ĐỘNG DÙNG CHUNG TUẦN (TDS, Điểm danh, Nêu gương, HĐNT, HĐ Góc)
  // =========================================================================
  children.push(
    pText('C. CÁC HOẠT ĐỘNG TỔ CHỨC DÙNG CHUNG TRONG TUẦN', {
      bold: true,
      size: SZ_SUB,
      color: '1D4ED8',
      spaceBefore: 240,
      spaceAfter: 100,
    }),
    pText('I. THỂ DỤC SÁNG', { bold: true }),
    pText('1. Mục đích – yêu cầu:', { bold: true })
  );
  for (const a of plan.morningExercise.aims) children.push(bulletP(a));
  children.push(pText('2. Chuẩn bị:', { bold: true }));
  for (const pr of plan.morningExercise.preparation) children.push(bulletP(pr));
  children.push(
    pText('3. Tiến hành:', { bold: true }),
    pText(`- Khởi động: ${plan.morningExercise.warmup}`, { indentLeft: 240 }),
    pText('- Trọng động:', { bold: true, indentLeft: 240 })
  );
  for (const mv of plan.morningExercise.moves) {
    children.push(pText(`+ ${mv.group} – ${mv.name}`, { bold: true, indentLeft: 360, spaceAfter: 20 }));
    if (mv.steps.trim()) children.push(pText(mv.steps.trim(), { indentLeft: 480, spaceAfter: 30 }));
  }
  children.push(pText(`- Hồi tỉnh: ${plan.morningExercise.cooldown}`, { indentLeft: 240 }));

  // Điểm danh & Nêu gương
  children.push(
    pText('II. ĐIỂM DANH', { bold: true, spaceBefore: 120 }),
    bulletP('Nắm sĩ số học sinh đi học hằng ngày, kiểm tra tình trạng sức khỏe buổi sáng.'),
    bulletP('Tìm hiểu nguyên nhân trẻ vắng mặt và trao đổi kịp thời với phụ huynh.'),
    pText('III. HOẠT ĐỘNG NÊU GƯƠNG (Cắm cờ cuối ngày & Phát phiếu bé ngoan cuối tuần)', {
      bold: true,
      spaceBefore: 120,
    }),
    pText('1. Ba tiêu chuẩn bé ngoan trong tuần:', { bold: true })
  );
  for (const st of plan.praiseStandards) children.push(bulletP(st));
  children.push(
    pText('2. Cách tổ chức:', { bold: true }),
    bulletP(`Ổn định lớp bằng bài hát “${plan.praiseSongStart}”, chỉnh đốn trang phục gọn gàng.`),
    bulletP('Nêu gương cuối ngày: Trẻ nhắc lại 3 tiêu chuẩn bé ngoan, từng tổ tự nhận xét và nhận xét bạn; cô nhận xét chung và mời trẻ đạt tiêu chuẩn lên cắm cờ.'),
    bulletP(`Nêu gương cuối tuần: Kiểm tra tổng số cờ đạt được trong tuần (4–5 cờ), phát phiếu bé ngoan, hướng dẫn trẻ dán phiếu vào sổ và hát bài “${plan.praiseSongWeekEnd}”.`)
  );

  // BẢNG HOẠT ĐỘNG NGOÀI TRỜI 1 TUẦN (5 cột)
  children.push(
    pText('IV. KẾ HOẠCH HOẠT ĐỘNG NGOÀI TRỜI TRONG 1 TUẦN', {
      align: AlignmentType.CENTER,
      bold: true,
      size: SZ_SUB,
      spaceBefore: 200,
      spaceAfter: 80,
    })
  );
  const outdoorCatLabels: Record<string, string> = {
    CHU_DICH: 'I. Hoạt động có chủ đích',
    TCVD: 'II. Trò chơi vận động',
    TCDG: 'III. Trò chơi dân gian',
    TU_DO: 'IV. Chơi tự do',
  };
  const outdoorTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell([pText('PHẦN', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 14, fill: '1D4ED8' }),
          makeCell([pText('NỘI DUNG', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 20, fill: '1D4ED8' }),
          makeCell([pText('YÊU CẦU', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 22, fill: '1D4ED8' }),
          makeCell([pText('CHUẨN BỊ', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 16, fill: '1D4ED8' }),
          makeCell([pText('TỔ CHỨC THỰC HIỆN', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 28, fill: '1D4ED8' }),
        ],
      }),
      ...plan.outdoorTable.map(
        (row) =>
          new TableRow({
            children: [
              makeCell([pText(outdoorCatLabels[row.category] || row.category, { bold: true })], { widthPct: 14, fill: 'F0FAF8' }),
              makeCell([pText(row.title, { bold: true })], { widthPct: 20 }),
              makeCell(row.requirements.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 22 }),
              makeCell(row.preparation.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 16 }),
              makeCell(row.procedure.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 28 }),
            ],
          })
      ),
    ],
  });
  children.push(outdoorTable);

  // BẢNG HOẠT ĐỘNG GÓC 1 TUẦN (5 cột)
  children.push(
    pText('V. KẾ HOẠCH HOẠT ĐỘNG GÓC TRONG 1 TUẦN', {
      align: AlignmentType.CENTER,
      bold: true,
      size: SZ_SUB,
      spaceBefore: 200,
      spaceAfter: 80,
    })
  );
  const cornerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell([pText('GÓC CHƠI', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 15, fill: '1D4ED8' }),
          makeCell([pText('NỘI DUNG', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 21, fill: '1D4ED8' }),
          makeCell([pText('YÊU CẦU', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 22, fill: '1D4ED8' }),
          makeCell([pText('CHUẨN BỊ', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 18, fill: '1D4ED8' }),
          makeCell([pText('TỔ CHỨC HOẠT ĐỘNG', { align: AlignmentType.CENTER, bold: true, color: 'FFFFFF' })], { widthPct: 24, fill: '1D4ED8' }),
        ],
      }),
      ...plan.cornerTable.map(
        (c) =>
          new TableRow({
            children: [
              makeCell([pText(c.cornerName, { bold: true })], { widthPct: 15, fill: 'F0FAF8' }),
              makeCell(c.contents.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 21 }),
              makeCell(c.requirements.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 22 }),
              makeCell(c.preparation.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 18 }),
              makeCell(c.organization.map((x) => pText(`- ${x}`, { spaceAfter: 20 })), { widthPct: 24 }),
            ],
          })
      ),
    ],
  });
  children.push(cornerTable);

  // =========================================================================
  // 5. KẾ HOẠCH HOẠT ĐỘNG TÍCH HỢP 5 NGÀY (Thứ 2 -> Thứ 6)
  // =========================================================================
  const tcvdTitle = plan.outdoorTable.find((o) => o.category === 'TCVD')?.title || 'TCVĐ theo kế hoạch tuần';
  const tcdgTitle = plan.outdoorTable.find((o) => o.category === 'TCDG')?.title || 'TCDG theo kế hoạch tuần';

  for (const day of plan.days) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      pText('HOẠT ĐỘNG TÍCH HỢP TRONG MỘT NGÀY', {
        align: AlignmentType.CENTER,
        bold: true,
        size: SZ_H1,
        color: '1D4ED8',
      }),
      pText(`${day.dayLabel}, ${fmtDateLongVN(day.dateStr)}`, {
        align: AlignmentType.CENTER,
        bold: true,
        italic: true,
        size: SZ_SUB,
        spaceAfter: 120,
      })
    );

    // A. ĐÓN TRẺ – THỂ DỤC SÁNG – ĐIỂM DANH
    children.push(pText('A. ĐÓN TRẺ – THỂ DỤC SÁNG – ĐIỂM DANH', { bold: true, spaceBefore: 80 }));
    for (const w of plan.welcomeRoutineNotes) children.push(bulletP(w));
    children.push(
      pText('1. Thể dục sáng: Thực hiện bài tập phát triển chung theo kế hoạch tuần.', { bold: true, indentLeft: 180 }),
      pText('2. Điểm danh: Nắm sĩ số học sinh đi học và lý do trẻ vắng trong ngày.', { bold: true, indentLeft: 180 })
    );
    if (day.showPraiseStandards) {
      children.push(pText('3. Phổ biến 3 Tiêu chuẩn bé ngoan đầu tuần:', { bold: true, indentLeft: 180 }));
      for (const st of plan.praiseStandards) children.push(bulletP(st, '+ '));
    }

    // B. HOẠT ĐỘNG NGOÀI TRỜI
    children.push(
      pText('B. HOẠT ĐỘNG NGOÀI TRỜI', { bold: true, spaceBefore: 100 }),
      bulletP(`Hoạt động có chủ đích: ${day.outdoorObservation || 'Quan sát theo chủ đề tuần'}`),
      bulletP(tcvdTitle),
      bulletP(tcdgTitle),
      bulletP('Chơi tự do với đồ chơi sân trường dưới sự giám sát an toàn của cô.')
    );

    // C. HOẠT ĐỘNG CÓ CHỦ ĐÍCH (1 hoặc 2 tiết)
    children.push(pText('C. HOẠT ĐỘNG CÓ CHỦ ĐÍCH', { bold: true, spaceBefore: 120, color: '1D4ED8' }));
    day.mainLessons.forEach((les, idx) => {
      if (day.mainLessons.length > 1) {
        children.push(pText(`Tiết ${idx + 1}:`, { bold: true, italic: true, spaceBefore: 80 }));
      }
      children.push(
        pText(les.domainTitle.toUpperCase(), { align: AlignmentType.CENTER, bold: true }),
        pText(les.subjectFullTitle.toUpperCase(), { align: AlignmentType.CENTER, bold: true }),
        pText(`Chủ đề: ${plan.subThemeName}`, { align: AlignmentType.CENTER, italic: true }),
        pText(`Đề tài: ${les.topicTitle}`, { align: AlignmentType.CENTER, bold: true, size: SZ_SUB })
      );
      for (const st of les.subTopics) {
        if (st.trim()) children.push(pText(st.trim(), { align: AlignmentType.CENTER, bold: true }));
      }
      if (les.linkedMtCodes.length > 0) {
        children.push(
          pText(`Mục tiêu gắn kết: ${les.linkedMtCodes.join(', ')}`, {
            align: AlignmentType.CENTER,
            italic: true,
            color: '1D4ED8',
            spaceAfter: 80,
          })
        );
      }

      children.push(pText('I. Mục đích – Yêu cầu:', { bold: true }));
      for (const a of les.aims) if (a.trim()) children.push(bulletP(a.trim()));

      children.push(pText('II. Chuẩn bị:', { bold: true }));
      for (const pr of les.preparation) if (pr.trim()) children.push(bulletP(pr.trim()));

      children.push(pText('III. Tổ chức hoạt động:', { bold: true }));
      for (const step of les.steps) {
        children.push(pText(`* ${step.title}`, { bold: true, indentLeft: 120, spaceBefore: 40 }));
        for (const d of step.details) if (d.trim()) children.push(bulletP(d.trim()));
      }
    });

    // D. HOẠT ĐỘNG GÓC
    children.push(pText('D. HOẠT ĐỘNG GÓC', { bold: true, spaceBefore: 120 }));
    for (const c of plan.cornerTable) {
      children.push(
        pText(`* ${c.cornerName}: ${c.contents.join('; ')}`, { indentLeft: 180, spaceAfter: 30 })
      );
    }

    // E. HOẠT ĐỘNG CHIỀU
    children.push(pText('E. HOẠT ĐỘNG CHIỀU', { bold: true, spaceBefore: 120, color: '1D4ED8' }));
    if (day.extracurricularTitle.trim()) {
      children.push(pText(`1. ${day.extracurricularTitle.trim()}`, { bold: true, indentLeft: 120 }));
    }
    if (day.afternoonLesson) {
      const al = day.afternoonLesson;
      children.push(
        pText(`${day.extracurricularTitle.trim() ? '2. ' : ''}${al.subjectFullTitle}: ${al.topicTitle}`, {
          bold: true,
          indentLeft: 120,
          spaceBefore: 40,
        })
      );
      if (al.linkedMtCodes.length > 0) {
        children.push(pText(`(Mục tiêu gắn kết: ${al.linkedMtCodes.join(', ')})`, { italic: true, indentLeft: 180, color: '1D4ED8' }));
      }
      children.push(pText('I. Mục đích – Yêu cầu:', { bold: true, indentLeft: 180 }));
      for (const a of al.aims) if (a.trim()) children.push(bulletP(a.trim()));
      children.push(pText('II. Chuẩn bị:', { bold: true, indentLeft: 180 }));
      for (const pr of al.preparation) if (pr.trim()) children.push(bulletP(pr.trim()));
      children.push(pText('III. Tổ chức hoạt động:', { bold: true, indentLeft: 180 }));
      for (const step of al.steps) {
        children.push(pText(`* ${step.title}`, { bold: true, indentLeft: 200 }));
        for (const d of step.details) if (d.trim()) children.push(bulletP(d.trim()));
      }
    }

    // F. NÊU GƯƠNG – VỆ SINH – TRẢ TRẺ & ĐÁNH GIÁ CUỐI NGÀY (3 tiêu chí BGD)
    children.push(
      pText('F. NÊU GƯƠNG – VỆ SINH – TRẢ TRẺ', { bold: true, spaceBefore: 100 }),
      bulletP('Tổ chức nêu gương cắm cờ cuối ngày theo 3 tiêu chuẩn bé ngoan; vệ sinh cá nhân gọn gàng và trả trẻ tận tay phụ huynh.'),
      pText('ĐÁNH GIÁ CUỐI NGÀY', {
        align: AlignmentType.CENTER,
        bold: true,
        size: SZ_SUB,
        spaceBefore: 140,
        spaceAfter: 60,
      }),
      pText('1. Tình trạng sức khỏe của trẻ:', { bold: true }),
      pText(
        day.evalHealth.trim() || '................................................................................................................................................',
        { indentLeft: 180 }
      ),
      pText('2. Trạng thái cảm xúc, thái độ, hành vi của trẻ:', { bold: true }),
      pText(
        day.evalEmotionBehavior.trim() || '................................................................................................................................................',
        { indentLeft: 180 }
      ),
      pText('3. Kiến thức, kỹ năng của trẻ:', { bold: true }),
      pText(
        day.evalKnowledgeSkill.trim() || '................................................................................................................................................',
        { indentLeft: 180 }
      )
    );
  }

  // =========================================================================
  // 6. KHỐI KÝ DUYỆT CUỐI HỒ SƠ (GV & BAN GIÁM HIỆU)
  // =========================================================================
  children.push(pText('', { spaceBefore: 240 }));
  const signTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          makeCell(
            [
              pText('GIÁO VIÊN', { align: AlignmentType.CENTER, bold: true }),
              pText('(Ký, ghi rõ họ tên)', { align: AlignmentType.CENTER, italic: true, spaceAfter: 800 }),
              pText(plan.teacherName, { align: AlignmentType.CENTER, bold: true }),
            ],
            { widthPct: 50 }
          ),
          makeCell(
            [
              pText('XÁC NHẬN CỦA BAN GIÁM HIỆU', { align: AlignmentType.CENTER, bold: true }),
              pText('(Ký tên và đóng dấu)', { align: AlignmentType.CENTER, italic: true, spaceAfter: 800 }),
              pText(plan.principalName, { align: AlignmentType.CENTER, bold: true }),
            ],
            { widthPct: 50 }
          ),
        ],
      }),
    ],
  });
  children.push(signTable);

  const doc = new Document({
    creator: 'Mầm Non Planner',
    title: `Kế hoạch giáo dục Tuần ${plan.weekNumber} - ${plan.className} - ${plan.themeName}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 21.0cm in twips
              height: 16838, // A4 29.7cm in twips
            },
            margin: {
              top: 1134,    // 2.0cm (chuẩn NĐ 30/2020/NĐ-CP)
              bottom: 1134, // 2.0cm
              left: 1588,   // 2.8cm
              right: 1020,  // 1.8cm
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${plan.schoolName} – Lớp ${plan.className} – Tuần ${plan.weekNumber}   |   Trang `,
                    font: FONT,
                    size: 18,
                    italics: true,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: FONT,
                    size: 18,
                    italics: true,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return packDocxBinary(doc);
}
