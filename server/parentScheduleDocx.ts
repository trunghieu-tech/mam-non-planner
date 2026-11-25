import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
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
import type { WeeklyPlanDocument } from '../shared/types.js';
import { packDocxBinary } from '../shared/binary.js';

const FONT = 'Times New Roman';
const BRAND = '1D4ED8';
const BRAND_LIGHT = 'DBEAFE';
const BORDER_COLOR = '8FAEA6';

function cm(val: number): number {
  return Math.round(val * 567);
}

function fmtDateVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtShortDay(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function p(text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number }): Paragraph {
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

function cell(children: Paragraph[], opts?: { fill?: string; widthPct?: number; vAlign?: 'top' | 'center' | 'bottom' }): TableCell {
  return new TableCell({
    verticalAlign: opts?.vAlign || VerticalAlign.TOP,
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    },
    children,
  });
}

/**
 * Tạo Tờ Lịch Hoạt Động Tuần gọn đẹp trong 1 trang A4 Ngang (Landscape)
 * dùng để dán bảng tin lớp hoặc xuất gửi nhóm Zalo Phụ huynh.
 */
export async function generateParentScheduleDocx(plan: WeeklyPlanDocument): Promise<Uint8Array> {
  const dayHeaders = plan.days.map((d) =>
    cell(
      [
        p(d.dayLabel.toUpperCase(), { bold: true, size: 11, color: 'FFFFFF', align: AlignmentType.CENTER, after: 10 }),
        p(fmtShortDay(d.dateStr), { italic: true, size: 10, color: 'DBEAFE', align: AlignmentType.CENTER, before: 0 }),
      ],
      { fill: BRAND, widthPct: 17, vAlign: VerticalAlign.CENTER }
    )
  );

  const mainLessonCells = plan.days.map((d) => {
    const paras: Paragraph[] = [];
    if (d.mainLessons.length === 0) {
      paras.push(p('—', { italic: true, color: '94A3B8', align: AlignmentType.CENTER }));
    } else {
      d.mainLessons.forEach((l, idx) => {
        paras.push(
          new Paragraph({
            spacing: { before: idx > 0 ? 60 : 20, after: 20, line: 240 },
            children: [
              new TextRun({ text: `• [${l.subjectCode}] `, font: FONT, size: 21, bold: true, color: BRAND }),
              new TextRun({ text: l.topicTitle, font: FONT, size: 21, bold: true, color: '0F172A' }),
            ],
          })
        );
        if (l.subTopics?.length) {
          paras.push(p(`  (${l.subTopics.join('; ')})`, { italic: true, size: 10, color: '475569', before: 0 }));
        }
      });
    }
    return cell(paras);
  });

  const outdoorCells = plan.days.map((d) =>
    cell([p(`• ${d.outdoorObservation || 'Quan sát theo chủ đề tuần'}`, { size: 10.5 })])
  );

  const afternoonCells = plan.days.map((d) => {
    const paras: Paragraph[] = [];
    if (d.extracurricularTitle?.trim()) {
      paras.push(p(`★ ${d.extracurricularTitle}`, { bold: true, size: 10.5, color: 'B45309' }));
    }
    if (d.afternoonLesson) {
      paras.push(p(`• ${d.afternoonLesson.topicTitle}`, { size: 10.5 }));
    }
    if (!paras.length) paras.push(p('Ôn luyện kỹ năng & chơi nhẹ theo ý thích', { italic: true, size: 10, color: '64748B' }));
    return cell(paras);
  });

  const scheduleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell([p('HOẠT ĐỘNG', { bold: true, size: 11, color: 'FFFFFF', align: AlignmentType.CENTER })], {
            fill: BRAND,
            widthPct: 15,
            vAlign: VerticalAlign.CENTER,
          }),
          ...dayHeaders,
        ],
      }),
      new TableRow({
        children: [
          cell([p('HOẠT ĐỘNG HỌC\nCÓ CHỦ ĐÍCH', { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER })], {
            fill: BRAND_LIGHT,
            vAlign: VerticalAlign.CENTER,
          }),
          ...mainLessonCells,
        ],
      }),
      new TableRow({
        children: [
          cell([p('HOẠT ĐỘNG\nNGOÀI TRỜI', { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER })], {
            fill: BRAND_LIGHT,
            vAlign: VerticalAlign.CENTER,
          }),
          ...outdoorCells,
        ],
      }),
      new TableRow({
        children: [
          cell([p('HOẠT ĐỘNG CHIỀU\n& NGOẠI KHÓA', { bold: true, size: 10.5, color: BRAND, align: AlignmentType.CENTER })], {
            fill: BRAND_LIGHT,
            vAlign: VerticalAlign.CENTER,
          }),
          ...afternoonCells,
        ],
      }),
    ],
  });

  const tdsLine = plan.morningExercise.moves.map((m) => m.name).join(' • ');
  const cornersLine = plan.cornerTable.map((c) => `${c.cornerName} (${c.contents.slice(0, 2).join(', ')})`).join(' | ');
  const etiquetteLine = plan.etiquetteNotes.filter((x) => x.trim()).join(' • ');

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: cm(21.0),
              height: cm(29.7),
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: cm(1.2),
              bottom: cm(1.2),
              left: cm(1.5),
              right: cm(1.5),
            },
          },
        },
        children: [
          p(`${plan.schoolName.toUpperCase()} — LỚP ${plan.className.toUpperCase()}`, {
            bold: true,
            size: 12,
            color: BRAND,
            align: AlignmentType.CENTER,
            after: 20,
          }),
          p(`LỊCH HOẠT ĐỘNG TUẦN ${plan.weekNumber} — CHỦ ĐỀ NHÁNH: ${plan.subThemeName.toUpperCase()}`, {
            bold: true,
            size: 15,
            color: '0F172A',
            align: AlignmentType.CENTER,
            after: 20,
          }),
          p(
            `Chủ đề lớn: ${plan.themeName}  •  Thời gian: ${fmtDateVN(plan.weekStartDate)} – ${fmtDateVN(plan.weekEndDate)}  •  Giáo viên phụ trách: ${plan.teacherName}`,
            { italic: true, size: 11, color: '475569', align: AlignmentType.CENTER, after: 100 }
          ),
          scheduleTable,
          new Paragraph({
            spacing: { before: 120, after: 40, line: 240 },
            children: [
              new TextRun({ text: '• Thể dục sáng cả tuần: ', font: FONT, size: 21, bold: true, color: BRAND }),
              new TextRun({ text: tdsLine || 'Tập bài phát triển chung 5 động tác theo nhạc chủ đề.', font: FONT, size: 21 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 20, after: 40, line: 240 },
            children: [
              new TextRun({ text: '• Hoạt động 5 góc chơi: ', font: FONT, size: 21, bold: true, color: BRAND }),
              new TextRun({ text: cornersLine, font: FONT, size: 21 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 20, after: 60, line: 240 },
            children: [
              new TextRun({ text: '• Phối hợp Phụ huynh & Rèn lễ giáo: ', font: FONT, size: 21, bold: true, color: 'B45309' }),
              new TextRun({
                text: etiquetteLine || 'Kính mong Quý phụ huynh phối hợp rèn thói quen chào hỏi lễ phép, đi học đúng giờ và trò chuyện cùng con về chủ đề tuần.',
                font: FONT,
                size: 21,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return packDocxBinary(doc);
}
