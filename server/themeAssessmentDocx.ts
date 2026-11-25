import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type {
  ObjectiveItem,
  StudentRosterItem,
  ThemeAssessmentDocument,
} from '../shared/types.js';
import { packDocxBinary } from '../shared/binary.js';

const FONT = 'Times New Roman';
const BRAND = '0B6E5C';
const BRAND_LIGHT = 'E6F4F1';
const BORDER_COLOR = '94A3B8';

function cm(val: number): number {
  return Math.round(val * 567);
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
    spacing: { before: opts?.before ?? 45, after: opts?.after ?? 45, line: 276 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: (opts?.size ?? 12) * 2,
        bold: opts?.bold,
        italics: opts?.italic,
        color: opts?.color || '0F172A',
      }),
    ],
  });
}

function labeledParagraph(label: string, body: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 50, after: 50, line: 276 },
    children: [
      new TextRun({
        text: `${label}: `,
        font: FONT,
        size: 24,
        bold: true,
        color: '0F172A',
      }),
      new TextRun({
        text: body?.trim() || 'Thực hiện nghiêm túc, phù hợp khả năng nhận thức và đặc điểm tâm sinh lý của trẻ trong lớp.',
        font: FONT,
        size: 24,
        color: '1E293B',
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  opts?: {
    fill?: string;
    widthPct?: number;
    vAlign?: 'top' | 'center' | 'bottom';
    noBorders?: boolean;
  }
): TableCell {
  const b = opts?.noBorders
    ? { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    : { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };

  return new TableCell({
    verticalAlign: opts?.vAlign || VerticalAlign.TOP,
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: { top: b, bottom: b, left: b, right: b },
    children,
  });
}

/**
 * 1. Xuất Phiếu Tổng hợp Đánh giá Kết quả Thực hiện Chủ đề & Bảng Đánh giá Trẻ theo Mã MT (.docx)
 * hỗ trợ đầy đủ 3 trạng thái: Đạt (+), Chưa đạt/Cần rèn (-), Không đánh giá (trống) + Ghi chú riêng từng trẻ.
 */
export async function generateThemeAssessmentDocx(
  assessment: ThemeAssessmentDocument,
  students: StudentRosterItem[],
  objectives: ObjectiveItem[]
): Promise<Uint8Array> {
  const objMap = new Map(
    objectives
      .filter((o) => o.ageGroupId === assessment.ageGroupId)
      .map((o) => [o.code, o])
  );

  const mtCodes = assessment.mtCodes || [];

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p((assessment.schoolName || 'TRƯỜNG MẦM NON').toUpperCase(), {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
                after: 15,
              }),
              p(`LỚP: ${(assessment.className || '').toUpperCase()}`, {
                bold: true,
                size: 11,
                color: BRAND,
                align: AlignmentType.CENTER,
                before: 0,
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
                after: 15,
              }),
              p('Độc lập - Tự do - Hạnh phúc', {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
                before: 0,
              }),
            ],
            { widthPct: 55, noBorders: true }
          ),
        ],
      }),
    ],
  });

  // Bảng II: Tổng hợp kết quả đạt từng mã MT (tính % chuẩn trên số trẻ ĐƯỢC ĐÁNH GIÁ)
  const summaryRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([p('Mã MT', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 10,
          vAlign: VerticalAlign.CENTER,
        }),
        cell([p('Nội dung mục tiêu đánh giá', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 40,
          vAlign: VerticalAlign.CENTER,
        }),
        cell([p('Đạt (SL / %)', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 16,
          vAlign: VerticalAlign.CENTER,
        }),
        cell([p('Chưa đạt / Không ĐG', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 14,
          vAlign: VerticalAlign.CENTER,
        }),
        cell([p('Trẻ cần rèn thêm', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: 20,
          vAlign: VerticalAlign.CENTER,
        }),
      ],
    }),
  ];

  if (mtCodes.length === 0) {
    summaryRows.push(
      new TableRow({
        children: [
          cell([p('—', { align: AlignmentType.CENTER })], { widthPct: 10 }),
          cell([p('Chưa chọn mã MT cho chủ đề này.', { italic: true })], { widthPct: 40 }),
          cell([p('—', { align: AlignmentType.CENTER })], { widthPct: 16 }),
          cell([p('—', { align: AlignmentType.CENTER })], { widthPct: 14 }),
          cell([p('—', { align: AlignmentType.CENTER })], { widthPct: 20 }),
        ],
      })
    );
  } else {
    mtCodes.forEach((code) => {
      const obj = objMap.get(code);
      let achievedCount = 0;
      let notEvalCount = 0;
      const supportNames: string[] = [];
      students.forEach((st) => {
        const lv = assessment.evaluations?.[st.id]?.[code] || 'ACHIEVED';
        if (lv === 'ACHIEVED') achievedCount += 1;
        else if (lv === 'NOT_EVALUATED') notEvalCount += 1;
        else supportNames.push(st.fullName);
      });
      const evaluated = achievedCount + supportNames.length;
      const pct = evaluated > 0 ? Math.round((achievedCount / evaluated) * 100) : 100;
      summaryRows.push(
        new TableRow({
          children: [
            cell([p(code, { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER })], {
              fill: BRAND_LIGHT,
              widthPct: 10,
              vAlign: VerticalAlign.CENTER,
            }),
            cell([p(obj?.description || `Mục tiêu ${code}`, { size: 10.5 })], { widthPct: 40 }),
            cell(
              [
                p(`${achievedCount}/${evaluated} (${pct}%)`, {
                  bold: true,
                  size: 10.5,
                  align: AlignmentType.CENTER,
                }),
              ],
              { widthPct: 16, vAlign: VerticalAlign.CENTER }
            ),
            cell(
              [
                p(
                  `${supportNames.length} rèn${notEvalCount > 0 ? ` · ${notEvalCount} miễn` : ''}`,
                  {
                    bold: supportNames.length > 0,
                    size: 10,
                    color: supportNames.length > 0 ? 'B45309' : '64748B',
                    align: AlignmentType.CENTER,
                  }
                ),
              ],
              { widthPct: 14, vAlign: VerticalAlign.CENTER }
            ),
            cell(
              [
                p(supportNames.length > 0 ? supportNames.join(', ') : '100% trẻ đánh giá đạt', {
                  italic: supportNames.length === 0,
                  size: 10,
                  color: supportNames.length > 0 ? '9A3412' : '047857',
                }),
              ],
              { widthPct: 20 }
            ),
          ],
        })
      );
    });
  }

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows,
  });

  // Bảng III: Bảng theo dõi từng trẻ (chia nhóm tối đa 7 mã MT mỗi bảng + cột Ghi chú riêng)
  const matrixTables: (Paragraph | Table)[] = [];
  const chunkSize = 7;
  for (let start = 0; start < mtCodes.length; start += chunkSize) {
    const chunk = mtCodes.slice(start, start + chunkSize);
    if (mtCodes.length > chunkSize) {
      matrixTables.push(
        p(
          `Bảng chi tiết (${Math.floor(start / chunkSize) + 1}): Các mục tiêu ${chunk.join(', ')}`,
          { bold: true, italic: true, size: 11, color: BRAND, before: 120, after: 40 }
        )
      );
    }

    const mtColPct = Math.max(6, Math.floor(48 / Math.max(chunk.length, 1)));
    const headerCells: TableCell[] = [
      cell([p('STT', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.CENTER })], {
        fill: BRAND,
        widthPct: 6,
        vAlign: VerticalAlign.CENTER,
      }),
      cell([p('Họ và tên trẻ', { bold: true, size: 10, color: 'FFFFFF', align: AlignmentType.LEFT })], {
        fill: BRAND,
        widthPct: 20,
        vAlign: VerticalAlign.CENTER,
      }),
      ...chunk.map((c) =>
        cell([p(c, { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
          fill: BRAND,
          widthPct: mtColPct,
          vAlign: VerticalAlign.CENTER,
        })
      ),
      cell([p('Tổng Đạt', { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
        fill: BRAND,
        widthPct: 10,
        vAlign: VerticalAlign.CENTER,
      }),
      cell([p('Ghi chú riêng', { bold: true, size: 9.5, color: 'FFFFFF', align: AlignmentType.LEFT })], {
        fill: BRAND,
        widthPct: 16,
        vAlign: VerticalAlign.CENTER,
      }),
    ];

    const studentRows: TableRow[] = students.map((st, idx) => {
      let totalPassAll = 0;
      let totalEvalAll = 0;
      mtCodes.forEach((c) => {
        const lv = assessment.evaluations?.[st.id]?.[c] || 'ACHIEVED';
        if (lv !== 'NOT_EVALUATED') totalEvalAll += 1;
        if (lv === 'ACHIEVED') totalPassAll += 1;
      });
      const noteText = assessment.studentNotes?.[st.id] || st.note || '';

      return new TableRow({
        children: [
          cell([p(String(idx + 1), { size: 10, align: AlignmentType.CENTER })], {
            widthPct: 6,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p(st.fullName, { size: 10 })], {
            widthPct: 20,
            vAlign: VerticalAlign.CENTER,
          }),
          ...chunk.map((c) => {
            const lv = assessment.evaluations?.[st.id]?.[c] || 'ACHIEVED';
            const txt = lv === 'ACHIEVED' ? '+' : lv === 'NEEDS_SUPPORT' ? '-' : '—';
            const color = lv === 'ACHIEVED' ? '047857' : lv === 'NEEDS_SUPPORT' ? 'C2410C' : '94A3B8';
            return cell(
              [p(txt, { bold: true, size: 11, color, align: AlignmentType.CENTER })],
              {
                fill: lv === 'NEEDS_SUPPORT' ? 'FFF7ED' : lv === 'NOT_EVALUATED' ? 'F8FAFC' : undefined,
                widthPct: mtColPct,
                vAlign: VerticalAlign.CENTER,
              }
            );
          }),
          cell([p(`${totalPassAll}/${totalEvalAll}`, { bold: true, size: 9.5, align: AlignmentType.CENTER })], {
            widthPct: 10,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p(noteText, { italic: !noteText, size: 9.5, color: '475569' })], {
            widthPct: 16,
            vAlign: VerticalAlign.CENTER,
          }),
        ],
      });
    });

    matrixTables.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ tableHeader: true, children: headerCells }), ...studentRows],
      })
    );
  }

  const signTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p('XÁC NHẬN CỦA BAN GIÁM HIỆU / TỔ CM', {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
                before: 180,
              }),
              p('(Ký, ghi rõ họ tên)', {
                italic: true,
                size: 10.5,
                align: AlignmentType.CENTER,
                after: 600,
              }),
              p(assessment.principalName || '', {
                bold: true,
                size: 11.5,
                align: AlignmentType.CENTER,
              }),
            ],
            { widthPct: 50, noBorders: true }
          ),
          cell(
            [
              p('GIÁO VIÊN PHỤ TRÁCH LỚP', {
                bold: true,
                size: 11,
                align: AlignmentType.CENTER,
                before: 180,
              }),
              p('(Ký, ghi rõ họ tên)', {
                italic: true,
                size: 10.5,
                align: AlignmentType.CENTER,
                after: 600,
              }),
              p(assessment.teacherName || '', {
                bold: true,
                size: 11.5,
                align: AlignmentType.CENTER,
              }),
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
            margin: { top: cm(2.0), bottom: cm(2.0), left: cm(2.5), right: cm(1.5) },
          },
        },
        children: [
          headerTable,
          p('PHIẾU ĐÁNH GIÁ KẾT QUẢ THỰC HIỆN CHỦ ĐỀ', {
            bold: true,
            size: 15,
            color: BRAND,
            align: AlignmentType.CENTER,
            before: 160,
            after: 30,
          }),
          p(
            `Chủ đề: ${assessment.themeName.toUpperCase()}  •  Thời gian: ${assessment.durationText || 'Theo kế hoạch tháng'}  •  Năm học: ${assessment.schoolYear || '2026 – 2027'}`,
            { italic: true, size: 11.5, align: AlignmentType.CENTER, before: 0, after: 160 }
          ),
          p('I. ĐÁNH GIÁ CHUNG VIỆC THỰC HIỆN CHỦ ĐỀ CỦA LỚP', {
            bold: true,
            size: 12.5,
            color: BRAND,
            before: 100,
            after: 60,
          }),
          labeledParagraph('1. Về mục tiêu của chủ đề', assessment.executedObjectivesNote),
          labeledParagraph('2. Về nội dung & hứng thú tham gia của trẻ', assessment.childrenInterestNote),
          labeledParagraph('3. Thuận lợi & khó khăn thực tế', assessment.advantagesDifficultiesNote),
          labeledParagraph('4. Phương hướng điều chỉnh cho chủ đề tiếp theo', assessment.nextThemeAdjustmentNote),
          p('II. TỔNG HỢP TỶ LỆ TRẺ ĐẠT CÁC MỤC TIÊU (MÃ MT) TRONG CHỦ ĐỀ', {
            bold: true,
            size: 12.5,
            color: BRAND,
            before: 160,
            after: 80,
          }),
          summaryTable,
          ...(mtCodes.length > 0 && students.length > 0
            ? [
                p('III. BẢNG THEO DÕI CHI TIẾT TỪNG TRẺ THEO MÃ MỤC TIÊU', {
                  bold: true,
                  size: 12.5,
                  color: BRAND,
                  before: 180,
                  after: 60,
                }),
                p('Ký hiệu: "+" = Đạt mục tiêu; "-" = Chưa đạt / Cần rèn thêm; "—" = Không đánh giá (trẻ nghỉ ốm / miễn đánh giá).', {
                  italic: true,
                  size: 10.5,
                  color: '475569',
                  before: 0,
                  after: 80,
                }),
                ...matrixTables,
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
 * 2. Xuất PHIẾU ĐÁNH GIÁ CÁ NHÂN RIÊNG TỪNG TRẺ (.docx — YC-041)
 * Mỗi trẻ 1 phiếu hoàn chỉnh (ngắt trang từng bé) với bảng chi tiết từng Mã MT (+ / - / trống),
 * ghi chú riêng của giáo viên và chữ ký Giáo viên – Phụ huynh để in gửi về gia đình!
 */
export async function generateIndividualChildCardsDocx(
  assessment: ThemeAssessmentDocument,
  students: StudentRosterItem[],
  objectives: ObjectiveItem[]
): Promise<Uint8Array> {
  const objMap = new Map(
    objectives
      .filter((o) => o.ageGroupId === assessment.ageGroupId)
      .map((o) => [o.code, o])
  );
  const mtCodes = assessment.mtCodes || [];
  const children: (Paragraph | Table)[] = [];

  students.forEach((st, idx) => {
    if (idx > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    let passCount = 0;
    let evalCount = 0;
    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          cell([p('Mã MT', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
            fill: BRAND,
            widthPct: 12,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p('Lĩnh vực', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.LEFT })], {
            fill: BRAND,
            widthPct: 24,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p('Nội dung mục tiêu đánh giá', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.LEFT })], {
            fill: BRAND,
            widthPct: 48,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p('Kết quả', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
            fill: BRAND,
            widthPct: 16,
            vAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ];

    mtCodes.forEach((code) => {
      const obj = objMap.get(code);
      const lv = assessment.evaluations?.[st.id]?.[code] || 'ACHIEVED';
      if (lv !== 'NOT_EVALUATED') evalCount += 1;
      if (lv === 'ACHIEVED') passCount += 1;

      const label = lv === 'ACHIEVED' ? '+ (Đạt)' : lv === 'NEEDS_SUPPORT' ? '- (Cần rèn)' : '(Không ĐG)';
      const color = lv === 'ACHIEVED' ? '047857' : lv === 'NEEDS_SUPPORT' ? 'C2410C' : '64748B';

      rows.push(
        new TableRow({
          children: [
            cell([p(code, { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER })], {
              fill: BRAND_LIGHT,
              widthPct: 12,
              vAlign: VerticalAlign.CENTER,
            }),
            cell([p(obj?.domain || '', { size: 10 })], { widthPct: 24 }),
            cell([p(obj?.description || `Mục tiêu ${code}`, { size: 10.5 })], { widthPct: 48 }),
            cell([p(label, { bold: true, size: 10.5, color, align: AlignmentType.CENTER })], {
              fill: lv === 'NEEDS_SUPPORT' ? 'FFF7ED' : undefined,
              widthPct: 16,
              vAlign: VerticalAlign.CENTER,
            }),
          ],
        })
      );
    });

    const pct = evalCount > 0 ? Math.round((passCount / evalCount) * 100) : 100;
    const personalNote =
      assessment.studentNotes?.[st.id]?.trim() ||
      st.note?.trim() ||
      'Bé ngoan, tích cực tham gia hoạt động cùng cô và các bạn tại lớp.';

    children.push(
      p(`${(assessment.schoolName || 'TRƯỜNG MẦM NON').toUpperCase()}  •  LỚP: ${(assessment.className || '').toUpperCase()}`, {
        bold: true,
        size: 11,
        color: BRAND,
        align: AlignmentType.CENTER,
        after: 20,
      }),
      p('PHIẾU ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ CUỐI CHỦ ĐỀ', {
        bold: true,
        size: 14.5,
        align: AlignmentType.CENTER,
        before: 40,
        after: 20,
      }),
      p(`Chủ đề: ${assessment.themeName.toUpperCase()}  •  Thời gian: ${assessment.durationText || ''}`, {
        italic: true,
        size: 11,
        align: AlignmentType.CENTER,
        before: 0,
        after: 100,
      }),
      p(
        `Họ và tên trẻ: ${st.fullName}    •    Ngày sinh: ${st.dob || '...'}    •    Kết quả đạt: ${passCount}/${evalCount} mục tiêu (${pct}%)`,
        { bold: true, size: 11.5, before: 40, after: 80 }
      ),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }),
      labeledParagraph('Nhận xét & phối hợp cùng gia đình', personalNote),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cell(
                [
                  p('Ý KIẾN CỦA PHỤ HUYNH', { bold: true, size: 11, align: AlignmentType.CENTER, before: 120 }),
                  p('(Ký, ghi rõ họ tên)', { italic: true, size: 10, align: AlignmentType.CENTER, after: 450 }),
                ],
                { widthPct: 50, noBorders: true }
              ),
              cell(
                [
                  p('GIÁO VIÊN PHỤ TRÁCH LỚP', { bold: true, size: 11, align: AlignmentType.CENTER, before: 120 }),
                  p('(Ký, ghi rõ họ tên)', { italic: true, size: 10, align: AlignmentType.CENTER, after: 450 }),
                  p(assessment.teacherName || '', { bold: true, size: 11, align: AlignmentType.CENTER }),
                ],
                { widthPct: 50, noBorders: true }
              ),
            ],
          }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: cm(1.8), bottom: cm(1.8), left: cm(2.2), right: cm(1.5) },
          },
        },
        children,
      },
    ],
  });

  return packDocxBinary(doc);
}
