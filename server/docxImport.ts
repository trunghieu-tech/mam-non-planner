import JSZip from 'jszip';
import { parse, type HTMLElement } from 'node-html-parser';
import type { AgeGroupId } from '../shared/types.js';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normVN(s: string): string {
  return (s || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectAgeGroupFromText(text: string, filename: string): AgeGroupId {
  const hay = normVN(`${filename} ${text.slice(0, 1200)}`);
  if (/\b(lop\s*la|khoi\s*la|5\s*[-–]\s*6\s*tuoi|mau\s*giao\s*lon)\b/.test(hay)) return 'LA_5_6T';
  if (/\b(lop\s*choi|khoi\s*choi|4\s*[-–]\s*5\s*tuoi|mau\s*giao\s*nho)\b/.test(hay)) return 'CHOI_4_5T';
  if (/\b(lop\s*mam|khoi\s*mam|3\s*[-–]\s*4\s*tuoi|mau\s*giao\s*be)\b/.test(hay)) return 'MAM_3_4T';
  if (/\b(nha\s*tre|24\s*[-–]\s*36\s*thang|18\s*[-–]\s*24\s*thang)\b/.test(hay)) return 'NHA_TRE_24_36T';
  return 'LA_5_6T';
}

function renderParagraphXml(pNode: HTMLElement): { html: string; plain: string } {
  const pPr = pNode.querySelector('w\\:pPr') || pNode.childNodes.find((n: any) => n.rawTagName === 'w:pPr') as HTMLElement | undefined;
  let align = '';
  let headingLevel = 0;

  if (pPr) {
    const jc = pPr.childNodes.find((n: any) => n.rawTagName === 'w:jc') as HTMLElement | undefined;
    const val = jc?.getAttribute('w:val') || '';
    if (val === 'center') align = 'center';
    else if (val === 'right') align = 'right';
    else if (val === 'both' || val === 'justify') align = 'justify';

    const pStyle = pPr.childNodes.find((n: any) => n.rawTagName === 'w:pStyle') as HTMLElement | undefined;
    const styleVal = (pStyle?.getAttribute('w:val') || '').toLowerCase();
    if (styleVal.includes('heading1') || styleVal === '1') headingLevel = 1;
    else if (styleVal.includes('heading2') || styleVal === '2') headingLevel = 2;
    else if (styleVal.includes('heading3') || styleVal === '3') headingLevel = 3;
  }

  let innerHtml = '';
  let plain = '';

  const runs = pNode.childNodes.filter((n: any) => n.rawTagName === 'w:r') as HTMLElement[];
  for (const r of runs) {
    const rPr = r.childNodes.find((n: any) => n.rawTagName === 'w:rPr') as HTMLElement | undefined;
    const isBold = Boolean(rPr?.childNodes.find((n: any) => n.rawTagName === 'w:b' && n.getAttribute('w:val') !== '0'));
    const isItalic = Boolean(rPr?.childNodes.find((n: any) => n.rawTagName === 'w:i' && n.getAttribute('w:val') !== '0'));
    const isUnderline = Boolean(rPr?.childNodes.find((n: any) => n.rawTagName === 'w:u' && n.getAttribute('w:val') !== 'none'));

    let runText = '';
    for (const child of r.childNodes as HTMLElement[]) {
      if (child.rawTagName === 'w:t') runText += child.text || '';
      else if (child.rawTagName === 'w:tab') runText += ' ';
      else if (child.rawTagName === 'w:br') runText += '\n';
    }
    if (!runText) continue;
    plain += runText;

    let frag = esc(runText).replace(/\n/g, '<br />');
    if (isUnderline) frag = `<u>${frag}</u>`;
    if (isItalic) frag = `<em>${frag}</em>`;
    if (isBold) frag = `<strong>${frag}</strong>`;
    innerHtml += frag;
  }

  const trimmed = plain.trim();
  if (!trimmed) return { html: '', plain: '' };

  // Auto-promote obvious Vietnamese section headers to H2/H3 for live Outline!
  if (!headingLevel) {
    if (/^(KẾ HOẠCH GIÁO DỤC|CHỦ ĐỀ\s*:)/i.test(trimmed) && trimmed.length < 95) headingLevel = 1;
    else if (/^(I\.|II\.|III\.|A\.|B\.|C\.|THỨ\s+(?:HAI|BA|TƯ|NĂM|SÁU))/i.test(trimmed) && trimmed.length < 95) headingLevel = 2;
    else if (/^(Tiết\s+\d+|HOẠT ĐỘNG\s+(?:ÂM NHẠC|THỂ DỤC|TẠO HÌNH|LÀM QUEN|KHÁM PHÁ))/i.test(trimmed) && trimmed.length < 110) headingLevel = 3;
  }

  const styleAttr = align ? ` style="text-align: ${align};"` : '';
  const tag = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'p';
  return { html: `<${tag}${styleAttr}>${innerHtml}</${tag}>`, plain: trimmed };
}

function renderTableXml(tblNode: HTMLElement): { html: string; plain: string } {
  const rows = tblNode.childNodes.filter((n: any) => n.rawTagName === 'w:tr') as HTMLElement[];
  if (!rows.length) return { html: '', plain: '' };

  const rowHtmls: string[] = [];
  const plainParts: string[] = [];

  rows.forEach((tr, rIdx) => {
    const cells = tr.childNodes.filter((n: any) => n.rawTagName === 'w:tc') as HTMLElement[];
    const cellHtmls: string[] = [];
    for (const tc of cells) {
      const tcPr = tc.childNodes.find((n: any) => n.rawTagName === 'w:tcPr') as HTMLElement | undefined;
      const gridSpan = tcPr?.childNodes.find((n: any) => n.rawTagName === 'w:gridSpan') as HTMLElement | undefined;
      const colspan = Number(gridSpan?.getAttribute('w:val') || '1');
      const vMerge = tcPr?.childNodes.find((n: any) => n.rawTagName === 'w:vMerge') as HTMLElement | undefined;
      // Skip continuation cells in vertical merge
      if (vMerge && vMerge.getAttribute('w:val') !== 'restart') {
        continue;
      }

      const paras = tc.childNodes.filter((n: any) => n.rawTagName === 'w:p') as HTMLElement[];
      const cInner: string[] = [];
      for (const p of paras) {
        const res = renderParagraphXml(p);
        if (res.html) cInner.push(res.html);
        if (res.plain) plainParts.push(res.plain);
      }
      const tag = rIdx === 0 ? 'th' : 'td';
      const colAttr = colspan > 1 ? ` colspan="${colspan}"` : '';
      cellHtmls.push(`<${tag}${colAttr}>${cInner.join('') || '<p></p>'}</${tag}>`);
    }
    if (cellHtmls.length > 0) {
      rowHtmls.push(`<tr>${cellHtmls.join('')}</tr>`);
    }
  });

  return {
    html: `<table><tbody>${rowHtmls.join('')}</tbody></table>`,
    plain: plainParts.join('\n'),
  };
}

export interface ImportedDocxResult {
  filename: string;
  ageGroupId: AgeGroupId;
  schoolName: string;
  className: string;
  themeName: string;
  subThemeName: string;
  weekNumber: number;
  teacherName: string;
  editorHtml: string;
  wordCount: number;
}

export async function parseUploadedDocx(buffer: Uint8Array, filename: string): Promise<ImportedDocxResult> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('File .docx không hợp lệ (không tìm thấy word/document.xml).');
  }
  const xml = await docXmlFile.async('string');
  const root = parse(xml, { lowerCaseTagName: false, comment: false });
  const body = root.querySelector('w\\:body') || root.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Không đọc được nội dung văn bản trong file .docx.');
  }

  const htmlParts: string[] = [];
  const plainParts: string[] = [];

  for (const child of body.childNodes as HTMLElement[]) {
    if (child.rawTagName === 'w:p') {
      const res = renderParagraphXml(child);
      if (res.html) htmlParts.push(res.html);
      if (res.plain) plainParts.push(res.plain);
    } else if (child.rawTagName === 'w:tbl') {
      const res = renderTableXml(child);
      if (res.html) htmlParts.push(res.html);
      if (res.plain) plainParts.push(res.plain);
    }
  }

  const fullPlain = plainParts.join('\n');
  const head = fullPlain.slice(0, 1500);
  const ageGroupId = detectAgeGroupFromText(fullPlain, filename);

  const schoolMatch = head.match(/TRƯỜNG\s+MẦM\s+NON[^\n]{2,60}/i);
  const classMatch = head.match(/Lớp\s*[:\-–]?\s*([A-Za-zÀ-ỹ0-9\s]{2,20})/i);
  const themeMatch = head.match(/Chủ\s*đề\s*(?:lớn)?\s*[:\-–]\s*([^\n]{3,70})/i);
  const subThemeMatch = head.match(/Chủ\s*đề\s*nhánh[^:\n]*[:\-–]\s*([^\n]{3,70})/i);
  const weekMatch = head.match(/Tuần\s*(\d{1,2})/i) || filename.match(/tu[aầ]n\s*(\d{1,2})/i);
  const teacherMatch = head.match(/Giáo\s*viên\s*(?:phụ\s*trách)?\s*[:\-–]\s*([^\n|]{3,45})/i);

  const cleanFileBase = filename.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();

  return {
    filename,
    ageGroupId,
    schoolName: schoolMatch ? schoolMatch[0].trim().toUpperCase() : 'TRƯỜNG MẦM NON',
    className: classMatch
      ? classMatch[1].trim().split(/\s{2,}|\n/)[0]
      : ageGroupId === 'NHA_TRE_24_36T'
      ? 'Nhà trẻ'
      : ageGroupId === 'MAM_3_4T'
      ? 'Mầm'
      : ageGroupId === 'CHOI_4_5T'
      ? 'Chồi'
      : 'Lá',
    themeName: (themeMatch ? themeMatch[1].trim() : cleanFileBase).toUpperCase(),
    subThemeName: subThemeMatch ? subThemeMatch[1].trim() : cleanFileBase,
    weekNumber: weekMatch ? Math.max(1, Number(weekMatch[1])) : 1,
    teacherName: teacherMatch ? teacherMatch[1].trim() : 'Giáo viên đứng lớp',
    editorHtml: htmlParts.join('\n'),
    wordCount: fullPlain.trim() ? fullPlain.trim().split(/\s+/).length : 0,
  };
}
