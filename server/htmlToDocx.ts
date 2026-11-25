import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
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
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';
import { parse, HTMLElement, Node, TextNode } from 'node-html-parser';
import type { WeeklyPlanDocument } from '../shared/types.js';
import { base64ToUint8, packDocxBinary } from '../shared/binary.js';

const DEFAULT_FONT = 'Times New Roman';
const DEFAULT_SIZE = 26; // 13pt (chuẩn Nghị định 30/2020/NĐ-CP)

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '334155' };
const GRID_BORDERS = {
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

interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  font?: string;
  size?: number; // half-points
}

function parseColorHex(raw: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toUpperCase();
    if (h.length === 6) return h.toUpperCase();
  }
  const m = s.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

function parseStyleAttr(styleStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!styleStr) return out;
  for (const part of styleStr.split(';')) {
    const idx = part.indexOf(':');
    if (idx > 0) {
      const k = part.slice(0, idx).trim().toLowerCase();
      const v = part.slice(idx + 1).trim();
      if (k && v) out[k] = v;
    }
  }
  return out;
}

function parseAlign(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const st = parseStyleAttr(el.getAttribute('style') || '');
  const a = (st['text-align'] || el.getAttribute('align') || '').toLowerCase();
  if (a === 'center') return AlignmentType.CENTER;
  if (a === 'right') return AlignmentType.RIGHT;
  if (a === 'justify') return AlignmentType.JUSTIFIED;
  if (a === 'left') return AlignmentType.LEFT;
  return undefined;
}

function parseFontSizeHalfPts(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const mPt = val.match(/([\d.]+)\s*pt/i);
  if (mPt) return Math.round(parseFloat(mPt[1]) * 2);
  const mPx = val.match(/([\d.]+)\s*px/i);
  if (mPx) return Math.round(parseFloat(mPx[1]) * 1.5);
  return undefined;
}

function collectRuns(node: Node, inherited: InlineStyle): Array<TextRun | ImageRun> {
  if (node instanceof TextNode) {
    const txt = node.text.replace(/\u00a0/g, ' ');
    if (!txt) return [];
    return [
      new TextRun({
        text: txt,
        font: inherited.font || DEFAULT_FONT,
        size: inherited.size || DEFAULT_SIZE,
        bold: inherited.bold,
        italics: inherited.italic,
        underline: inherited.underline ? { type: UnderlineType.SINGLE } : undefined,
        strike: inherited.strike,
        color: inherited.color || '000000',
        shading: inherited.highlight
          ? { type: ShadingType.CLEAR, color: 'auto', fill: inherited.highlight }
          : undefined,
      }),
    ];
  }

  if (!(node instanceof HTMLElement)) return [];
  const tag = (node.tagName || '').toLowerCase();

  if (tag === 'br') {
    return [new TextRun({ break: 1 })];
  }

  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    const m = src.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i);
    if (m) {
      try {
        const imgType = m[1].toLowerCase() === 'jpg' ? 'jpg' : (m[1].toLowerCase() as 'png' | 'jpg' | 'gif');
        const buf = base64ToUint8(m[2]);
        return [
          new ImageRun({
            type: imgType,
            data: buf,
            transformation: { width: 420, height: 280 },
          }),
        ];
      } catch {
        return [];
      }
    }
    return [];
  }

  const next: InlineStyle = { ...inherited };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's' || tag === 'del' || tag === 'strike') next.strike = true;
  if (tag === 'code') next.font = 'Consolas';
  if (tag === 'mark') {
    const st = parseStyleAttr(node.getAttribute('style') || '');
    next.highlight = parseColorHex(st['background-color'] || node.getAttribute('data-color') || '#FEF08A') || 'FEF08A';
  }

  const st = parseStyleAttr(node.getAttribute('style') || '');
  if (st['color']) {
    const c = parseColorHex(st['color']);
    if (c) next.color = c;
  }
  if (st['background-color']) {
    const bg = parseColorHex(st['background-color']);
    if (bg) next.highlight = bg;
  }
  if (st['font-family']) {
    next.font = st['font-family'].replace(/['"]/g, '').split(',')[0].trim();
  }
  const sz = parseFontSizeHalfPts(st['font-size']);
  if (sz) next.size = sz;

  const runs: Array<TextRun | ImageRun> = [];
  for (const child of node.childNodes) {
    runs.push(...collectRuns(child, next));
  }
  return runs;
}

function buildParagraph(
  el: HTMLElement,
  opts?: {
    baseStyle?: InlineStyle;
    prefixText?: string;
    indentLeft?: number;
    spaceBefore?: number;
    spaceAfter?: number;
  }
): Paragraph {
  const align = parseAlign(el);
  const runs = collectRuns(el, opts?.baseStyle || {});
  if (opts?.prefixText) {
    // Strip duplicate leading bullet/dash from the first text run so Word never gets "• - Nội dung"
    if (runs.length > 0) {
      const firstNode = el.childNodes[0];
      if (firstNode instanceof TextNode) {
        const stripped = firstNode.text.replace(/^[\s•●▪◦▸►\-–—+]+(?=\S)/, '');
        if (stripped !== firstNode.text) {
          firstNode.rawText = stripped;
          const cleanRuns = collectRuns(el, opts?.baseStyle || {});
          runs.splice(0, runs.length, ...cleanRuns);
        }
      }
    }
    runs.unshift(
      new TextRun({
        text: opts.prefixText,
        font: DEFAULT_FONT,
        size: opts?.baseStyle?.size || DEFAULT_SIZE,
        bold: false,
      })
    );
  }
  return new Paragraph({
    alignment: align ?? AlignmentType.LEFT,
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    spacing: {
      before: opts?.spaceBefore ?? 40,
      after: opts?.spaceAfter ?? 60,
      line: 276,
    },
    children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT, size: DEFAULT_SIZE })],
  });
}

function convertListElement(listEl: HTMLElement, depth = 0): Paragraph[] {
  const out: Paragraph[] = [];
  const tag = (listEl.tagName || '').toLowerCase();
  const baseIndent = 320 + depth * 320;
  let idx = 1;

  for (const li of listEl.childNodes) {
    if (!(li instanceof HTMLElement) || li.tagName.toLowerCase() !== 'li') continue;
    const prefix = tag === 'ol' ? `${idx}. ` : depth === 0 ? '• ' : '– ';
    idx += 1;

    const directChildren = li.childNodes.filter(
      (c) =>
        c instanceof HTMLElement &&
        ['p', 'ul', 'ol'].includes(c.tagName.toLowerCase())
    ) as HTMLElement[];

    if (directChildren.length > 0) {
      let emittedPrefix = false;
      for (const ch of directChildren) {
        const chTag = ch.tagName.toLowerCase();
        if (chTag === 'p') {
          out.push(
            buildParagraph(ch, {
              prefixText: !emittedPrefix ? prefix : undefined,
              indentLeft: baseIndent,
              spaceBefore: 20,
              spaceAfter: 40,
            })
          );
          emittedPrefix = true;
        } else if (chTag === 'ul' || chTag === 'ol') {
          out.push(...convertListElement(ch, depth + 1));
        }
      }
    } else {
      out.push(buildParagraph(li, { prefixText: prefix, indentLeft: baseIndent, spaceBefore: 20, spaceAfter: 40 }));
    }
  }
  return out;
}

function convertBlockList(nodes: Node[]): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const node of nodes) {
    if (node instanceof TextNode) {
      const txt = node.text.trim();
      if (txt) {
        out.push(
          new Paragraph({
            spacing: { before: 40, after: 60, line: 276 },
            children: [new TextRun({ text: txt, font: DEFAULT_FONT, size: DEFAULT_SIZE })],
          })
        );
      }
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = (node.tagName || '').toLowerCase();

    if (tag === 'hr') {
      out.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (tag === 'h1') {
      out.push(buildParagraph(node, { baseStyle: { bold: true, size: 32 }, spaceBefore: 140, spaceAfter: 100 }));
    } else if (tag === 'h2') {
      out.push(buildParagraph(node, { baseStyle: { bold: true, size: 28 }, spaceBefore: 140, spaceAfter: 80 }));
    } else if (tag === 'h3') {
      out.push(buildParagraph(node, { baseStyle: { bold: true, size: 26 }, spaceBefore: 100, spaceAfter: 60 }));
    } else if (tag === 'p' || tag === 'div' || tag === 'blockquote') {
      out.push(buildParagraph(node, { indentLeft: tag === 'blockquote' ? 360 : undefined }));
    } else if (tag === 'ul' || tag === 'ol') {
      out.push(...convertListElement(node, 0));
    } else if (tag === 'table') {
      const tableTxt = node.text.toUpperCase();
      const isSignatureTable =
        tableTxt.includes('GIÁO VIÊN') && tableTxt.includes('BAN GIÁM HIỆU');

      const trNodes = node.querySelectorAll('tr');
      const rows: TableRow[] = [];
      trNodes.forEach((tr, rIdx) => {
        const cellNodes = tr.childNodes.filter(
          (c) => c instanceof HTMLElement && ['th', 'td'].includes(c.tagName.toLowerCase())
        ) as HTMLElement[];
        if (!cellNodes.length) return;

        const isHeaderRow = rIdx === 0 && cellNodes.every((c) => c.tagName.toLowerCase() === 'th');
        const cells = cellNodes.map((cel) => {
          const isTh = cel.tagName.toLowerCase() === 'th';
          const colSpan = Number(cel.getAttribute('colspan') || 1);
          const rowSpan = Number(cel.getAttribute('rowspan') || 1);
          const cellChildren = convertBlockList(cel.childNodes).filter(
            (x): x is Paragraph => x instanceof Paragraph
          );
          const fill = isSignatureTable
            ? undefined
            : isHeaderRow
            ? 'DBEAFE'
            : isTh
            ? 'F0FAF8'
            : undefined;

          return new TableCell({
            columnSpan: colSpan > 1 ? colSpan : undefined,
            rowSpan: rowSpan > 1 ? rowSpan : undefined,
            shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
            verticalAlign: isTh ? VerticalAlign.CENTER : VerticalAlign.TOP,
            margins: { top: 80, bottom: 80, left: 110, right: 110 },
            children: cellChildren.length
              ? cellChildren
              : [new Paragraph({ children: [new TextRun({ text: '', font: DEFAULT_FONT, size: DEFAULT_SIZE })] })],
          });
        });

        rows.push(new TableRow({ tableHeader: isHeaderRow, children: cells }));
      });

      if (rows.length > 0) {
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: isSignatureTable ? NO_BORDERS : GRID_BORDERS,
            rows,
          })
        );
      }
    } else {
      out.push(...convertBlockList(node.childNodes));
    }
  }
  return out;
}

export async function generateDocxFromEditorHtml(
  html: string,
  plan: WeeklyPlanDocument
): Promise<Uint8Array> {
  const root = parse(html || '<p></p>');
  const children = convertBlockList(root.childNodes);

  const doc = new Document({
    creator: 'Mầm Non Planner',
    title: `Kế hoạch giáo dục Tuần ${plan.weekNumber} - ${plan.className}`,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 21.0cm x 29.7cm
            margin: {
              top: 1134,    // 2.0cm (NĐ 30/2020/NĐ-CP)
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
                    font: DEFAULT_FONT,
                    size: 18,
                    italics: true,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: DEFAULT_FONT,
                    size: 18,
                    italics: true,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children: children.length
          ? children
          : [new Paragraph({ children: [new TextRun({ text: '', font: DEFAULT_FONT, size: DEFAULT_SIZE })] })],
      },
    ],
  });

  return packDocxBinary(doc);
}
