import type { Editor } from '@tiptap/react';

export type InsertMode = 'auto' | 'line' | 'block' | 'mt';

export interface SmartInsertOptions {
  mode?: InsertMode;
  /** Nếu là 'aims', tự tìm đúng mục "I. Mục đích – Yêu cầu" để chèn thêm ý gọn gàng */
  preferredSection?: 'aims';
}

/**
 * Chuẩn hóa chuỗi văn bản thuần từ kho gợi ý / dữ liệu cào trước khi đưa vào các ô danh sách
 * (Góc chơi, Lễ giáo, Đón trẻ, Nêu gương, HĐ ngoài trời...):
 * - Xóa ký tự gạch đầu dòng/dấu chấm thừa ở đầu để không bao giờ sinh ra "- - " hay "• - ".
 * - Gộp khoảng trắng thừa và bỏ xuống dòng gãy.
 */
export function normalizePlainSuggestion(raw: string): string {
  return (raw || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/^[\s•●▪◦▸►\-–—+*]+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Chuẩn hóa HTML trước khi chèn vào Tiptap hoặc khi người dùng dán (Ctrl+V) từ Word/Web:
 * - Gỡ sạch font-family, font-size, background-color, margin, padding, line-height, class/id lạ
 *   để văn bản luôn giữ đúng chuẩn Times New Roman 13pt của giáo án gốc.
 * - Chỉ giữ lại text-align (center/right/justify/left) và cấu trúc ngữ nghĩa (p, h1-h3, ul, ol, li, strong, em, u, table).
 * - Gỡ gạch đầu dòng thừa trong <li> để tránh lỗi "• - Nội dung".
 */
export function normalizeSuggestionHtml(rawHtml: string, opts?: { preserveHeadingColor?: boolean }): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  // Remove indentation newlines between HTML tags that cause ProseMirror stray spaces
  const compact = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();

  if (typeof document === 'undefined') {
    return compact;
  }

  const container = document.createElement('div');
  container.innerHTML = compact;

  const ALLOWED_TAGS = new Set([
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'table',
    'tbody',
    'thead',
    'tr',
    'th',
    'td',
    'hr',
    'code',
    'img',
  ]);

  const cleanNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || '').replace(/\u00a0/g, ' ');
      return document.createTextNode(txt);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link') {
      return null;
    }

    // Unwrap span / font / div-wrappers without breaking children
    if (!ALLOWED_TAGS.has(tag)) {
      if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'blockquote') {
        const hasBlockChild = Array.from(el.children).some((ch) =>
          ['p', 'div', 'ul', 'ol', 'table', 'h1', 'h2', 'h3', 'hr'].includes(ch.tagName.toLowerCase())
        );
        if (!hasBlockChild) {
          const p = document.createElement('p');
          const align = el.style?.textAlign;
          if (align && ['left', 'center', 'right', 'justify'].includes(align)) {
            p.style.textAlign = align;
          }
          for (const ch of Array.from(el.childNodes)) {
            const c = cleanNode(ch);
            if (c) p.appendChild(c);
          }
          return p;
        }
      }
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(el.childNodes)) {
        const c = cleanNode(ch);
        if (c) frag.appendChild(c);
      }
      return frag;
    }

    const mappedTag = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
    const out = document.createElement(mappedTag);

    // Keep only safe structural attributes
    if (mappedTag === 'p' || mappedTag === 'h1' || mappedTag === 'h2' || mappedTag === 'h3') {
      const align = (el.style?.textAlign || el.getAttribute('align') || '').toLowerCase();
      if (['left', 'center', 'right', 'justify'].includes(align)) {
        out.style.textAlign = align;
      }
      if (opts?.preserveHeadingColor && (mappedTag === 'h1' || mappedTag === 'h2')) {
        const color = el.style?.color;
        if (color) out.style.color = color;
      }
    } else if (mappedTag === 'td' || mappedTag === 'th') {
      const cs = el.getAttribute('colspan');
      const rs = el.getAttribute('rowspan');
      if (cs && Number(cs) > 1) out.setAttribute('colspan', cs);
      if (rs && Number(rs) > 1) out.setAttribute('rowspan', rs);
    } else if (mappedTag === 'img') {
      const src = el.getAttribute('src');
      if (src) out.setAttribute('src', src);
      const alt = el.getAttribute('alt');
      if (alt) out.setAttribute('alt', alt);
      return out;
    }

    for (const ch of Array.from(el.childNodes)) {
      const c = cleanNode(ch);
      if (c) out.appendChild(c);
    }

    // Strip redundant leading bullet chars inside <li> (e.g., "<li>- Text</li>" -> "<li>Text</li>")
    if (mappedTag === 'li') {
      stripLeadingBulletFromElement(out);
    }

    return out;
  };

  const outRoot = document.createElement('div');
  for (const child of Array.from(container.childNodes)) {
    const cleaned = cleanNode(child);
    if (cleaned) outRoot.appendChild(cleaned);
  }

  // Remove empty stray paragraphs at start/end
  const isNodeEmpty = (el: Element): boolean => {
    if (el.tagName.toLowerCase() === 'hr' || el.tagName.toLowerCase() === 'img' || el.tagName.toLowerCase() === 'table') {
      return false;
    }
    return (el.textContent || '').replace(/\u00a0/g, ' ').trim() === '';
  };

  while (outRoot.firstElementChild && outRoot.firstElementChild.tagName.toLowerCase() === 'p' && isNodeEmpty(outRoot.firstElementChild)) {
    outRoot.removeChild(outRoot.firstElementChild);
  }
  while (outRoot.lastElementChild && outRoot.lastElementChild.tagName.toLowerCase() === 'p' && isNodeEmpty(outRoot.lastElementChild)) {
    outRoot.removeChild(outRoot.lastElementChild);
  }

  return outRoot.innerHTML.trim();
}

function stripLeadingBulletFromElement(el: HTMLElement): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const firstText = walker.nextNode() as Text | null;
  if (!firstText || !firstText.nodeValue) return;
  const cleaned = firstText.nodeValue.replace(/^[\s•●▪◦▸►\-–—+]+(?=\S)/, '');
  if (cleaned !== firstText.nodeValue) {
    firstText.nodeValue = cleaned;
  }
}

/**
 * Lấy nội dung bên trong thẻ <p> đầu tiên (bỏ dấu gạch đầu dòng thừa) để chèn gọn thành 1 mục <li>
 * khi con trỏ đang nằm trong danh sách gạch đầu dòng.
 */
function extractSingleLineInnerHtml(cleanHtml: string): string {
  if (typeof document === 'undefined') return cleanHtml;
  const div = document.createElement('div');
  div.innerHTML = cleanHtml;
  const first = div.firstElementChild as HTMLElement | null;
  if (first && div.children.length === 1 && (first.tagName.toLowerCase() === 'p' || first.tagName.toLowerCase() === 'li')) {
    stripLeadingBulletFromElement(first);
    return first.innerHTML.trim();
  }
  stripLeadingBulletFromElement(div);
  return div.innerHTML.trim();
}

function isMultiBlockHtml(cleanHtml: string): boolean {
  if (typeof document === 'undefined') return /<(ul|ol|table|h1|h2|h3|hr)\b/i.test(cleanHtml);
  const div = document.createElement('div');
  div.innerHTML = cleanHtml;
  if (div.children.length > 1) return true;
  const only = div.firstElementChild;
  if (!only) return false;
  return ['ul', 'ol', 'table', 'h1', 'h2', 'h3', 'hr'].includes(only.tagName.toLowerCase());
}

/**
 * Tìm vị trí cuối danh sách <ul> ngay dưới tiêu đề "I. Mục đích – Yêu cầu" (nếu có trong văn bản)
 * để chèn mục tiêu mới thẳng vào đúng mục MĐYC mà không bị rơi lung tung vào giữa câu hay tiêu đề.
 */
function findAimsListInsertPos(editor: Editor): { pos: number; insideList: boolean } | null {
  const doc = editor.state.doc;
  let seenAimsHeading = false;
  let aimsHeadingEnd = -1;

  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    let offset = 0;
    for (let j = 0; j < i; j++) offset += doc.child(j).nodeSize;

    const text = child.textContent.trim().toLowerCase();
    if (!seenAimsHeading) {
      if (text.includes('mục đích') && (text.includes('yêu cầu') || text.startsWith('i.'))) {
        seenAimsHeading = true;
        aimsHeadingEnd = offset + child.nodeSize;
      }
      continue;
    }

    // Found the bulletList/orderedList right after "I. Mục đích – Yêu cầu"
    if (child.type.name === 'bulletList' || child.type.name === 'orderedList') {
      // Position right before the closing token of the list (to insert a new <li>)
      return { pos: offset + child.nodeSize - 1, insideList: true };
    }
    // If we hit section II before seeing a list, insert right after the I. MĐYC paragraph
    if (text.startsWith('ii.') || text.includes('chuẩn bị')) {
      return { pos: aimsHeadingEnd, insideList: false };
    }
  }

  if (seenAimsHeading && aimsHeadingEnd > 0) {
    return { pos: aimsHeadingEnd, insideList: false };
  }
  return null;
}

/**
 * Chèn gợi ý vào Tiptap Word Editor một cách THÔNG MINH & CHUẨN HÓA ĐỊNH DẠNG:
 * 1. Luôn làm sạch HTML (bỏ font/size/màu nền/màu chữ lạc tông, bỏ khoảng trắng thừa, bỏ gạch đầu dòng kép).
 * 2. Không bao giờ cắt ngang giữa câu, giữa tiêu đề (H1/H2/H3), hay lồng danh sách <ul> vào trong <li>.
 * 3. Nếu đang đứng trong danh sách (<ul>/<ol>) và chèn 1 dòng gợi ý → tự thêm thành 1 <li> mới cùng cấp, không tạo "• - ".
 * 4. Nếu đang đứng trong danh sách và chèn khối lớn (có tiêu đề/bảng/nhiều đoạn) → tự nhảy ra ngay sau danh sách rồi chèn ở cấp gốc.
 * 5. Nếu đang đứng trong ô bảng (<td>/<th>) và chèn bảng/khung tiết lớn → tự nhảy ra ngay sau bảng để không vỡ bố cục bảng.
 * 6. Tự xóa stored marks (đậm/nghiêng/màu) sau khi chèn để gõ tiếp không bị dính định dạng.
 */
export function smartInsertIntoEditor(
  editor: Editor,
  rawHtml: string,
  options: SmartInsertOptions = {}
): string {
  const cleanHtml = normalizeSuggestionHtml(rawHtml);
  if (!cleanHtml) return editor.getHTML();

  const detectedMulti = isMultiBlockHtml(cleanHtml);
  const mode: Exclude<InsertMode, 'auto'> =
    options.mode && options.mode !== 'auto' ? options.mode : detectedMulti ? 'block' : 'line';

  // 1) Smart placement for "+ Chèn vào MĐYC"
  if (options.preferredSection === 'aims') {
    const aimsTarget = findAimsListInsertPos(editor);
    if (aimsTarget) {
      const inner = extractSingleLineInnerHtml(cleanHtml);
      if (aimsTarget.insideList) {
        editor
          .chain()
          .focus()
          .insertContentAt(aimsTarget.pos, `<li><p>${inner}</p></li>`, { updateSelection: true })
          .unsetAllMarks()
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertContentAt(aimsTarget.pos, `<ul><li><p>${inner}</p></li></ul>`, { updateSelection: true })
          .unsetAllMarks()
          .run();
      }
      return editor.getHTML();
    }
  }

  const { state } = editor;
  const { $from } = state.selection;

  // Locate enclosing structural ancestors
  let listDepth = -1;
  let listItemDepth = -1;
  let tableDepth = -1;
  let cellDepth = -1;
  let headingDepth = -1;

  for (let d = $from.depth; d >= 1; d--) {
    const name = $from.node(d).type.name;
    if ((name === 'bulletList' || name === 'orderedList') && listDepth === -1) listDepth = d;
    if (name === 'listItem' && listItemDepth === -1) listItemDepth = d;
    if (name === 'table' && tableDepth === -1) tableDepth = d;
    if ((name === 'tableCell' || name === 'tableHeader') && cellDepth === -1) cellDepth = d;
    if (name === 'heading' && headingDepth === -1) headingDepth = d;
  }

  // 2) Single-line insertion ('line' or 'mt')
  if (mode === 'line' || mode === 'mt') {
    const inner = extractSingleLineInnerHtml(cleanHtml);

    // 2a) Cursor inside a list item -> append cleanly as a sibling <li> (no double bullets, no split sentence)
    if (listItemDepth !== -1) {
      const curLi = $from.node(listItemDepth);
      const isLiEmpty = curLi.textContent.trim() === '';
      if (isLiEmpty) {
        const start = $from.start(listItemDepth);
        const end = $from.end(listItemDepth);
        editor
          .chain()
          .focus()
          .insertContentAt({ from: start, to: end }, `<p>${inner}</p>`, { updateSelection: true })
          .unsetAllMarks()
          .run();
      } else {
        const afterLi = $from.after(listItemDepth);
        editor
          .chain()
          .focus()
          .insertContentAt(afterLi, `<li><p>${inner}</p></li>`, { updateSelection: true })
          .unsetAllMarks()
          .run();
      }
      return editor.getHTML();
    }

    // 2b) Cursor inside a table cell -> insert clean paragraph at end of current block in cell
    if (cellDepth !== -1) {
      const curBlock = $from.parent;
      const isBlockEmpty = curBlock.textContent.trim() === '';
      const lineHtml = mode === 'mt' ? `<p>${inner}</p>` : `<p>- ${inner}</p>`;
      if (isBlockEmpty) {
        editor
          .chain()
          .focus()
          .insertContentAt({ from: $from.before($from.depth), to: $from.after($from.depth) }, lineHtml, {
            updateSelection: true,
          })
          .unsetAllMarks()
          .run();
      } else {
        const afterBlock = $from.after($from.depth);
        editor
          .chain()
          .focus()
          .insertContentAt(afterBlock, lineHtml, { updateSelection: true })
          .unsetAllMarks()
          .run();
      }
      return editor.getHTML();
    }

    // 2c) Cursor inside a Heading or centered line -> jump right AFTER that block so heading isn't split/inherited
    if (headingDepth !== -1) {
      const afterHeading = $from.after(headingDepth);
      const lineHtml = mode === 'mt' ? `<p>${inner}</p>` : `<p>- ${inner}</p>`;
      editor
        .chain()
        .focus()
        .insertContentAt(afterHeading, lineHtml, { updateSelection: true })
        .unsetAllMarks()
        .run();
      return editor.getHTML();
    }

    // 2d) Normal paragraph -> replace if empty, else insert cleanly as a new paragraph right after (never mid-word)
    const curBlock = $from.parent;
    const isEmpty = curBlock.textContent.trim() === '';
    const lineHtml = mode === 'mt' ? `<p>${inner}</p>` : `<p>- ${inner}</p>`;
    if (isEmpty && $from.depth >= 1) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: $from.before($from.depth), to: $from.after($from.depth) }, lineHtml, {
          updateSelection: true,
        })
        .unsetAllMarks()
        .run();
    } else {
      const afterPos = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
      editor
        .chain()
        .focus()
        .insertContentAt(afterPos, lineHtml, { updateSelection: true })
        .unsetAllMarks()
        .run();
    }
    return editor.getHTML();
  }

  // 3) Multi-block snippet insertion ('block')
  const containsTableOrHeading = /<(table|h1|h2|h3|hr)\b/i.test(cleanHtml);

  // Determine the safest block boundary to insert without nesting lists or breaking tables/headings
  let insertPos = state.doc.content.size;

  if (tableDepth !== -1 && containsTableOrHeading) {
    // Never nest a table or heading inside a table cell -> jump cleanly after the table
    insertPos = $from.after(tableDepth);
  } else if (tableDepth !== -1 && cellDepth !== -1) {
    // Simple paragraphs/bullets inside a table cell -> insert right after current block in cell
    insertPos = $from.after($from.depth);
  } else if (listDepth !== -1) {
    // Never nest a block snippet inside a <li> -> jump cleanly after the outermost list
    let topListDepth = listDepth;
    for (let d = listDepth - 1; d >= 1; d--) {
      const n = $from.node(d).type.name;
      if (n === 'bulletList' || n === 'orderedList') topListDepth = d;
    }
    insertPos = $from.after(topListDepth);
  } else if (headingDepth !== -1) {
    insertPos = $from.after(headingDepth);
  } else if ($from.depth >= 1) {
    const topNode = $from.node(1);
    if (topNode.type.name === 'paragraph' && topNode.textContent.trim() === '') {
      // Replace the empty paragraph cleanly
      editor
        .chain()
        .focus()
        .insertContentAt({ from: $from.before(1), to: $from.after(1) }, cleanHtml, { updateSelection: true })
        .unsetAllMarks()
        .run();
      return editor.getHTML();
    }
    insertPos = $from.after(1);
  }

  editor
    .chain()
    .focus()
    .insertContentAt(insertPos, cleanHtml, { updateSelection: true })
    .unsetAllMarks()
    .run();

  return editor.getHTML();
}

/**
 * Chuẩn hóa lại toàn bộ định dạng trang Word hiện tại về chuẩn BGD
 * (Times New Roman 13pt, bỏ font/size/màu nền dán từ nguồn ngoài, bỏ gạch đầu dòng kép "• - ").
 */
export function normalizeWholeEditorDocument(editor: Editor): string {
  const cleaned = normalizeSuggestionHtml(editor.getHTML(), { preserveHeadingColor: true });
  editor.commands.setContent(cleaned || '<p></p>', { emitUpdate: true });
  return editor.getHTML();
}
