import JSZip from 'jszip';
import type { ObjectiveItem, WeeklyPlanDocument } from './types';

function xmlEsc(val: string): string {
  return (val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx);
}

function buildSheetXml(rows: string[][]): string {
  const rowXml = rows
    .map((cells, rIdx) => {
      const rNum = rIdx + 1;
      const cellXml = cells
        .map(
          (v, cIdx) =>
            `<c r="${colLetter(cIdx)}${rNum}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
        )
        .join('');
      return `<row r="${rNum}">${cellXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

export async function generateBrowserWeeklyXlsx(
  plan: WeeklyPlanDocument,
  allObjectives: ObjectiveItem[]
): Promise<Uint8Array> {
  const sheet1Rows: string[][] = [
    [`${plan.schoolName} — KẾ HOẠCH GIÁO DỤC TUẦN ${plan.weekNumber} (${plan.className})`],
    [
      `Chủ đề: ${plan.themeName} | Nhánh tuần: ${plan.subThemeName} | Thời gian: ${plan.weekStartDate} – ${plan.weekEndDate} | GV: ${plan.teacherName}`,
    ],
    [],
    ['Thứ', 'Ngày', 'Môn / Lĩnh vực', 'Đề tài HĐ có chủ đích & Mã MT', 'HĐ ngoài trời', 'HĐ chiều'],
    ...plan.days.map((d) => [
      d.dayLabel,
      d.dateStr,
      d.mainLessons.map((l) => l.subjectCode).join('\n'),
      d.mainLessons
        .map((l) => `[${l.subjectCode}] ${l.topicTitle}${l.linkedMtCodes.length ? ` (${l.linkedMtCodes.join(', ')})` : ''}`)
        .join('\n'),
      d.outdoorObservation || '',
      [d.extracurricularTitle, d.afternoonLesson?.topicTitle].filter(Boolean).join('\n'),
    ]),
  ];

  const objMap = new Map(
    allObjectives.filter((o) => o.ageGroupId === plan.ageGroupId).map((o) => [o.code, o])
  );
  const allCodes = Array.from(new Set(plan.themeObjectives.flatMap((b) => b.mtCodes)));

  const sheet2Rows: string[][] = [
    ['Mã MT', 'Lĩnh vực phát triển', 'Mục tiêu giáo dục (01/VBHN-BGDĐT)', 'Nội dung giáo dục', 'Tuần áp dụng'],
    ...allCodes.map((code) => {
      const o = objMap.get(code);
      return [
        code,
        o?.domain || '',
        o?.description || '',
        o?.eduContent || '',
        `Chủ đề ${plan.themeName} – Tuần ${plan.weekNumber}`,
      ];
    }),
  ];

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Ke_Hoach_Tuan" sheetId="1" r:id="rId1"/>
    <sheet name="Ma_Muc_Tieu" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`
  );
  zip.file('xl/worksheets/sheet1.xml', buildSheetXml(sheet1Rows));
  zip.file('xl/worksheets/sheet2.xml', buildSheetXml(sheet2Rows));

  return zip.generateAsync({ type: 'uint8array' });
}
