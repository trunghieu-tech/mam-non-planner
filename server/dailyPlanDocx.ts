import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
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
import { parse as parseHtml } from 'node-html-parser';
import type { DayPlan, WeeklyPlanDocument } from '../shared/types.js';
import { packDocxBinary } from '../shared/binary.js';

const FONT = 'Times New Roman';
const BRAND = '1D4ED8';
const BRAND_LIGHT = 'DBEAFE';
const BORDER_COLOR = '94A3B8';

function cm(val: number): number {
  return Math.round(val * 567);
}

function fmtDateVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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
    spacing: { before: opts?.before ?? 36, after: opts?.after ?? 36, line: 276 },
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
    margins: { top: 75, bottom: 75, left: 100, right: 100 },
    borders: { top: b, bottom: b, left: b, right: b },
    children,
  });
}

export interface DailyExportOptions {
  fromDate: string;
  toDate: string;
  orientation?: 'portrait' | 'landscape';
  continuous?: boolean;
  includeDailyChildEval?: boolean;
  includeGvEval?: boolean;
  includeBghComments?: boolean;
  includeSignature?: boolean;
}

function richHtmlToPlainParagraphs(richHtml: string): Paragraph[] {
  try {
    const root = parseHtml(richHtml);
    const out: Paragraph[] = [];
    for (const node of root.childNodes) {
      const txt = node.text?.replace(/\s+/g, ' ').trim() || '';
      if (!txt) continue;
      const tag = (node as { rawTagName?: string }).rawTagName?.toLowerCase() || '';
      if (tag === 'ul' || tag === 'ol') {
        const lis = (node as unknown as { querySelectorAll: (s: string) => Array<{ text: string }> }).querySelectorAll('li');
        if (lis?.length) {
          lis.forEach((li) => {
            const lt = li.text.replace(/\s+/g, ' ').trim();
            if (lt) out.push(p(`  - ${lt}`, { size: 10.5 }));
          });
          continue;
        }
      }
      const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3' || /^(I|II|III|IV|1|2|3|4)\.\s/.test(txt);
      out.push(p(txt, { bold: isHeading, size: isHeading ? 11 : 10.5 }));
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Xuất Sổ KẾ HOẠCH GIÁO DỤC NGÀY (.docx) theo khoảng Từ ngày – Đến ngày (YC-050, chuẩn GoKids vietec.mp4 48:27)
 */
export async function generateDailyPlansDocx(
  plans: WeeklyPlanDocument[],
  opts: DailyExportOptions
): Promise<Uint8Array> {
  const matchedDays: Array<{ plan: WeeklyPlanDocument; day: DayPlan }> = [];

  const sortedPlans = [...plans].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  for (const pl of sortedPlans) {
    for (const d of pl.days) {
      if (d.dateStr >= opts.fromDate && d.dateStr <= opts.toDate) {
        matchedDays.push({ plan: pl, day: d });
      }
    }
  }

  // Fallback nếu người dùng chọn ngoài khoảng -> xuất 5 ngày của kế hoạch đầu tiên
  if (matchedDays.length === 0 && sortedPlans[0]) {
    sortedPlans[0].days.forEach((d) => matchedDays.push({ plan: sortedPlans[0], day: d }));
  }

  const docChildren: (Paragraph | Table)[] = [];

  matchedDays.forEach(({ plan, day }, idx) => {
    if (idx > 0) {
      if (opts.continuous) {
        docChildren.push(p('────────────────────────────────────────', { align: AlignmentType.CENTER, color: '94A3B8', before: 140, after: 100 }));
      } else {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
    }

    const dayBghComments = (plan.reviewComments || []).filter(
      (c) =>
        c.authorRole !== 'TEACHER' &&
        c.targetSection.trim().toLowerCase() === day.dayLabel.trim().toLowerCase()
    );

    docChildren.push(
      p(`${(plan.schoolName || 'TRƯỜNG MẦM NON').toUpperCase()}  •  LỚP: ${plan.className.toUpperCase()}`, {
        bold: true,
        size: 11,
        color: BRAND,
        align: AlignmentType.CENTER,
        after: 15,
      }),
      p(`KẾ HOẠCH GIÁO DỤC NGÀY — ${day.dayLabel.toUpperCase()} (${fmtDateVN(day.dateStr)})`, {
        bold: true,
        size: 14.5,
        align: AlignmentType.CENTER,
        before: 30,
        after: 20,
      }),
      p(
        `Chủ đề: ${plan.themeName}  •  Nhánh tuần ${plan.weekNumber}: ${plan.subThemeName}  •  GV: ${plan.teacherName}`,
        { italic: true, size: 11, align: AlignmentType.CENTER, before: 0, after: 100 }
      )
    );

    if (day.isHoliday) {
      docChildren.push(
        p(`★ ${day.holidayName || 'NGHỈ LỄ / SỰ KIỆN TRƯỜNG'}: Trẻ nghỉ học theo quy định.`, {
          bold: true,
          size: 12,
          color: 'B45309',
          align: AlignmentType.CENTER,
          before: 120,
          after: 120,
        })
      );
      return;
    }

    const scheduleRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          cell([p('Thời điểm / Hoạt động', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
            fill: BRAND,
            widthPct: 22,
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p('Mục đích – Chuẩn bị – Tổ chức thực hiện', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.LEFT })], {
            fill: BRAND,
            widthPct: opts.includeBghComments ? 56 : 78,
            vAlign: VerticalAlign.CENTER,
          }),
          ...(opts.includeBghComments
            ? [
                cell([p('Nhận xét BGH', { bold: true, size: 10.5, color: 'FFFFFF', align: AlignmentType.CENTER })], {
                  fill: BRAND,
                  widthPct: 22,
                  vAlign: VerticalAlign.CENTER,
                }),
              ]
            : []),
        ],
      }),
    ];

    const addSlotRow = (slotName: string, paras: Paragraph[], bghText = '') => {
      scheduleRows.push(
        new TableRow({
          children: [
            cell([p(slotName, { bold: true, size: 10.5, color: BRAND })], {
              fill: BRAND_LIGHT,
              widthPct: 22,
            }),
            cell(paras.length > 0 ? paras : [p('Thực hiện theo kế hoạch tuần.')], {
              widthPct: opts.includeBghComments ? 56 : 78,
            }),
            ...(opts.includeBghComments
              ? [
                  cell([p(bghText, { italic: Boolean(bghText), size: 10, color: '9A3412' })], {
                    widthPct: 22,
                  }),
                ]
              : []),
          ],
        })
      );
    };

    // 1. Đón trẻ – Thể dục sáng & 1b. Trò chuyện sáng
    addSlotRow('1. Đón trẻ & Thể dục sáng', [
      ...plan.welcomeRoutineNotes.slice(0, 2).map((n) => p(`- Đón trẻ: ${n}`, { size: 11 })),
      p(`- Thể dục sáng: Khởi động (${plan.morningExercise.warmup}). Trọng động: ${plan.morningExercise.moves.map((m) => m.name).join('; ')}.`, { size: 11 }),
    ]);

    if (plan.morningTalkNotes?.length) {
      addSlotRow(
        '2. Trò chuyện sáng',
        plan.morningTalkNotes.map((n) => p(`- ${n}`, { size: 11 }))
      );
    }

    // 3. Hoạt động học có chủ đích (ưu tiên đọc les.richHtml đã soạn trên Word Studio!)
    const mainParas: Paragraph[] = [];
    day.mainLessons.forEach((les) => {
      const mtBadge = les.linkedMtCodes?.length ? ` (${les.linkedMtCodes.join(', ')})` : '';
      mainParas.push(
        p(`[${les.subjectCode}] ${les.topicTitle}${mtBadge}`, { bold: true, size: 11.5, color: BRAND, before: 60 })
      );
      const fromRich = les.richHtml && les.richHtml.trim().length > 20 ? richHtmlToPlainParagraphs(les.richHtml) : [];
      if (fromRich.length > 0) {
        mainParas.push(...fromRich);
      } else {
        mainParas.push(
          p('• I. Mục đích – Yêu cầu:', { bold: true, size: 11 }),
          ...les.aims.map((a) => p(`  - ${a}`, { size: 10.5 })),
          p('• II. Chuẩn bị:', { bold: true, size: 11 }),
          ...les.preparation.map((pr) => p(`  - ${pr}`, { size: 10.5 })),
          p('• III. Tổ chức hoạt động:', { bold: true, size: 11 }),
          ...les.steps.flatMap((st) => [
            p(`  * ${st.title}`, { bold: true, italic: true, size: 10.5 }),
            ...st.details.map((dt) => p(`    + ${dt}`, { size: 10.5 })),
          ])
        );
      }
      if (les.mediaItems?.length) {
        mainParas.push(
          p(`• Học liệu Media đính kèm: ${les.mediaItems.map((m) => `${m.title} (${m.url})`).join('; ')}`, {
            italic: true,
            size: 10,
            color: '0369A1',
          })
        );
      }
    });
    addSlotRow(
      plan.morningTalkNotes?.length ? '3. Hoạt động học' : '2. Hoạt động học',
      mainParas,
      dayBghComments.map((c) => `${c.authorName}: ${c.content}`).join('\n')
    );

    // 3. Hoạt động ngoài trời
    addSlotRow('3. Hoạt động ngoài trời', [
      p(`- Quan sát có chủ đích: ${day.outdoorObservation || 'Quan sát thời tiết, cây xanh sân trường'}`, { size: 11 }),
      ...plan.outdoorTable.slice(1, 3).map((r) => p(`- ${r.title}`, { size: 10.5 })),
    ]);

    // 4. Hoạt động chơi góc
    addSlotRow(
      '4. Hoạt động chơi góc',
      plan.cornerTable.slice(0, 4).map((c) => p(`- ${c.cornerName}: ${c.contents.join('; ')}`, { size: 10.5 }))
    );

    // 5. Ăn – Ngủ – Vệ sinh & Hoạt động chiều
    const aftParas: Paragraph[] = [
      ...plan.laborHygieneNotes.slice(0, 1).map((n) => p(`- Ăn, ngủ, vệ sinh: ${n}`, { size: 10.5 })),
    ];
    if (day.afternoonLesson) {
      aftParas.push(
        p(`- Hoạt động chiều [${day.afternoonLesson.subjectCode}]: ${day.afternoonLesson.topicTitle}`, {
          bold: true,
          size: 11,
        }),
        ...day.afternoonLesson.aims.slice(0, 2).map((a) => p(`  + ${a}`, { size: 10.5 }))
      );
    }
    if (day.extracurricularTitle) {
      aftParas.push(p(`- Ngoại khóa: ${day.extracurricularTitle}`, { size: 10.5 }));
    }
    aftParas.push(
      p(`- Nêu gương – Trả trẻ: Bình xét cờ Bé ngoan (${plan.praiseStandards.join('; ')}).`, { size: 10.5 })
    );
    addSlotRow('5. Ăn ngủ, Chiều & Trả trẻ', aftParas);

    // 6. Nhận xét cuối ngày & Hướng chỉnh sửa kế hoạch của Giáo viên
    if (opts.includeGvEval !== false) {
      const evalParas: Paragraph[] = [
        p(`- Sức khỏe: ${day.evalHealth || 'Trẻ khỏe mạnh, ăn hết suất, ngủ ngon giấc.'}`, { size: 10.5 }),
        p(`- Cảm xúc, hành vi: ${day.evalEmotionBehavior || 'Trẻ ngoan, tích cực tham gia hoạt động cùng cô và bạn.'}`, { size: 10.5 }),
        p(`- Kiến thức, kỹ năng: ${day.evalKnowledgeSkill || 'Đa số trẻ đạt yêu cầu bài học đề ra.'}`, { size: 10.5 }),
      ];
      if (day.evalAdjustment) {
        evalParas.push(p(`- Chỉnh sửa / Lưu ý điều chỉnh kế hoạch: ${day.evalAdjustment}`, { bold: true, size: 10.5, color: BRAND }));
      }
      if (opts.includeDailyChildEval && day.dailyStudentNotes?.length) {
        evalParas.push(
          p(
            `- Ghi nhận cá nhân trẻ cần lưu ý (${day.dailyStudentNotes.length} trẻ): ${day.dailyStudentNotes
              .map((sn) => `${sn.studentId} (${[sn.health, sn.emotion, sn.skill, sn.adjustmentNote].filter(Boolean).join('; ')})`)
              .join(' | ')}`,
            { italic: true, size: 10 }
          )
        );
      }
      addSlotRow('6. Đánh giá / Nhận xét & Chỉnh sửa cuối ngày', evalParas);
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: scheduleRows,
      })
    );

    if (opts.includeSignature !== false) {
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                cell(
                  [
                    p('BAN GIÁM HIỆU / TỔ CHUYÊN MÔN', { bold: true, size: 10.5, align: AlignmentType.CENTER, before: 120 }),
                    p(
                      plan.status === 'APPROVED'
                        ? `✓ Đã ký duyệt trực tuyến (${plan.approvedAt || ''})`
                        : '(Ký duyệt)',
                      {
                        italic: plan.status !== 'APPROVED',
                        bold: plan.status === 'APPROVED',
                        size: 10,
                        color: plan.status === 'APPROVED' ? '047857' : '64748B',
                        align: AlignmentType.CENTER,
                        after: 320,
                      }
                    ),
                    p(plan.approvedBy || plan.principalName || '', { bold: true, size: 11, align: AlignmentType.CENTER }),
                  ],
                  { widthPct: 50, noBorders: true }
                ),
                cell(
                  [
                    p('GIÁO VIÊN PHỤ TRÁCH LỚP', { bold: true, size: 10.5, align: AlignmentType.CENTER, before: 120 }),
                    p('(Ký, ghi rõ họ tên)', { italic: true, size: 10, align: AlignmentType.CENTER, after: 320 }),
                    p(plan.teacherName || '', { bold: true, size: 11, align: AlignmentType.CENTER }),
                  ],
                  { widthPct: 50, noBorders: true }
                ),
              ],
            }),
          ],
        })
      );
    }
  });

  const isLandscape = opts.orientation === 'landscape';
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: isLandscape ? { orientation: PageOrientation.LANDSCAPE } : undefined,
            margin: isLandscape
              ? { top: cm(1.5), bottom: cm(1.5), left: cm(1.8), right: cm(1.5) }
              : { top: cm(1.8), bottom: cm(1.8), left: cm(2.5), right: cm(1.5) },
          },
        },
        children: docChildren,
      },
    ],
  });

  return packDocxBinary(doc);
}
