import ExcelJS from 'exceljs';
import type { ObjectiveItem, WeeklyPlanDocument } from '../shared/types.js';

export async function generateWeeklyXlsx(
  plan: WeeklyPlanDocument,
  allObjectives: ObjectiveItem[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mầm Non Planner';
  wb.created = new Date();

  const ws1 = wb.addWorksheet('Ke_Hoach_Tuan');
  ws1.mergeCells('A1:F1');
  ws1.getCell('A1').value = `${plan.schoolName} — KẾ HOẠCH GIÁO DỤC TUẦN ${plan.weekNumber} (${plan.className})`;
  ws1.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0B6E5C' } };
  ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:F2');
  ws1.getCell('A2').value = `Chủ đề: ${plan.themeName} | Nhánh tuần: ${plan.subThemeName} | Thời gian: ${plan.weekStartDate} – ${plan.weekEndDate} | GV: ${plan.teacherName}`;
  ws1.getCell('A2').alignment = { horizontal: 'center' };
  ws1.getCell('A2').font = { name: 'Calibri', size: 11, italic: true };

  ws1.addRow([]);
  const hdr = ws1.addRow(['Thứ', 'Ngày', 'Môn / Lĩnh vực', 'Đề tài HĐ có chủ đích & Mã MT', 'HĐ ngoài trời', 'HĐ chiều (HĐNK & Giáo án chiều)']);
  hdr.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B6E5C' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  hdr.height = 26;

  for (const d of plan.days) {
    const mainText = d.mainLessons
      .map((l) => `[${l.subjectCode}] ${l.topicTitle}${l.linkedMtCodes.length ? ` (${l.linkedMtCodes.join(', ')})` : ''}`)
      .join('\n');
    const subjText = d.mainLessons.map((l) => l.subjectCode).join('\n');
    const aftText = [d.extracurricularTitle, d.afternoonLesson?.topicTitle].filter(Boolean).join('\n');
    const row = ws1.addRow([d.dayLabel, d.dateStr, subjText, mainText, d.outdoorObservation, aftText]);
    row.eachCell((c) => {
      c.alignment = { vertical: 'top', wrapText: true };
      c.font = { name: 'Calibri', size: 10.5 };
    });
    row.height = 48;
  }

  ws1.columns = [
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 42 },
    { width: 30 },
    { width: 34 },
  ];

  // Sheet 2: Mã MT gắn kết trong tuần/chủ đề
  const ws2 = wb.addWorksheet('Muc_Tieu_Gan_Ket');
  const mtCodes = new Set<string>();
  for (const b of plan.themeObjectives) for (const c of b.mtCodes) mtCodes.add(c);
  for (const d of plan.days) {
    for (const l of d.mainLessons) for (const c of l.linkedMtCodes) mtCodes.add(c);
    if (d.afternoonLesson) for (const c of d.afternoonLesson.linkedMtCodes) mtCodes.add(c);
  }

  const hdr2 = ws2.addRow(['Mã MT', 'Lĩnh vực', 'Nội dung mục tiêu', 'Nội dung giáo dục', 'Nguồn trong kế hoạch']);
  hdr2.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B6E5C' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const mtLookup = new Map(allObjectives.filter((o) => o.ageGroupId === plan.ageGroupId).map((o) => [o.code, o]));
  for (const code of Array.from(mtCodes)) {
    const o = mtLookup.get(code);
    const row = ws2.addRow([
      code,
      o?.domain || '',
      o?.description || '',
      o?.eduContent || '',
      `Chủ đề ${plan.themeName} – Tuần ${plan.weekNumber}`,
    ]);
    row.eachCell((c) => {
      c.alignment = { vertical: 'top', wrapText: true };
    });
    row.height = 42;
  }
  ws2.columns = [{ width: 10 }, { width: 24 }, { width: 48 }, { width: 44 }, { width: 28 }];

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}
