import React, { useEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  FilePlus2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  Printer,
  Redo2,
  RemoveFormatting,
  Replace,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react';
import {
  normalizeSuggestionHtml,
  normalizeWholeEditorDocument,
  smartInsertIntoEditor,
} from '../utils/editorInsert';
import { WORD_SNIPPETS } from '../utils/planToHtml';

// Custom FontSize extension on TextStyle
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export interface DocHeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

export interface CursorContext {
  sectionHeading: string;
  inTable: boolean;
}

interface Props {
  planId: string;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  onOutlineChange: (headings: DocHeadingItem[]) => void;
  onCursorContextChange?: (ctx: CursorContext) => void;
  onEditorReady: (editor: Editor | null) => void;
}

const TEXT_COLORS = [
  { label: 'Đen chuẩn', value: '#000000' },
  { label: 'Xanh BGD', value: '#0B6E5C' },
  { label: 'Đỏ nhấn mạnh', value: '#DC2626' },
  { label: 'Xanh dương', value: '#1D4ED8' },
  { label: 'Nâu cam', value: '#B45309' },
  { label: 'Xám ghi chú', value: '#475569' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Vàng', value: '#FEF08A' },
  { label: 'Xanh nhạt', value: '#D1FAE5' },
  { label: 'Hồng nhạt', value: '#FCE7F3' },
  { label: 'Xanh trời', value: '#E0F2FE' },
];

export const WordEditor: React.FC<Props> = ({
  planId,
  initialHtml,
  onHtmlChange,
  onOutlineChange,
  onCursorContextChange,
  onEditorReady,
}) => {
  const [zoom, setZoom] = useState(100);
  const [wordStats, setWordStats] = useState({ words: 0, chars: 0 });
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [showSnippetMenu, setShowSnippetMenu] = useState(false);
  const [showFindBar, setShowFindBar] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractCursorContext = (ed: Editor) => {
    if (!onCursorContextChange) return;
    const cursorPos = ed.state.selection.from;
    let nearestHeading = 'Trang bìa / Đầu văn bản';
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && pos <= cursorPos) {
        const txt = node.textContent.trim();
        if (txt) nearestHeading = txt;
      }
    });
    onCursorContextChange({
      sectionHeading: nearestHeading,
      inTable: ed.isActive('table'),
    });
  };

  const extractOutlineAndStats = (ed: Editor) => {
    const headings: DocHeadingItem[] = [];
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim();
        if (text) {
          headings.push({
            id: `h_${pos}`,
            level: Number(node.attrs.level || 2),
            text,
            pos,
          });
        }
      }
    });
    onOutlineChange(headings);
    const plain = ed.getText().trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    setWordStats({ words, chars: plain.length });
    extractCursorContext(ed);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: 'Bắt đầu soạn giáo án trực tiếp tại đây như Microsoft Word...',
      }),
    ],
    content: initialHtml,
    editorProps: {
      transformPastedHTML: (html) => normalizeSuggestionHtml(html),
    },
    onUpdate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML());
      extractOutlineAndStats(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      extractCursorContext(ed);
    },
    onCreate: ({ editor: ed }) => {
      extractOutlineAndStats(ed);
    },
  });

  useEffect(() => {
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  // Reload content when switching between different weekly plans
  const loadedPlanRef = useRef<string>(planId);
  useEffect(() => {
    if (editor && loadedPlanRef.current !== planId) {
      loadedPlanRef.current = planId;
      editor.commands.setContent(initialHtml, { emitUpdate: false });
      extractOutlineAndStats(editor);
    }
  }, [planId, initialHtml, editor]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    const curHtml = editor.getHTML();
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updated = curHtml.replace(new RegExp(escaped, 'g'), replaceText);
    editor.commands.setContent(updated, { emitUpdate: true });
  };

  if (!editor) {
    return <div className="p-8 text-center text-sm text-slate-400">Đang khởi tạo trình soạn thảo Word...</div>;
  }

  const inTable = editor.isActive('table');
  const btnCls = (active?: boolean) =>
    `inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition ${
      active
        ? 'bg-[#E6F4F1] text-[#0B6E5C] ring-1 ring-[#0B6E5C]/30 font-bold'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* =================================================================== */}
      {/* WORD FORMATTING RIBBON TOOLBAR                                      */}
      {/* =================================================================== */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1">
          {/* Undo / Redo */}
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Hoàn tác (Ctrl+Z)"
            className={`${btnCls()} disabled:opacity-35`}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Làm lại (Ctrl+Y)"
            className={`${btnCls()} disabled:opacity-35`}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Heading Style */}
          <select
            value={
              editor.isActive('heading', { level: 1 })
                ? 'h1'
                : editor.isActive('heading', { level: 2 })
                ? 'h2'
                : editor.isActive('heading', { level: 3 })
                ? 'h3'
                : 'p'
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'p') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
            }}
            title="Kiểu đoạn văn"
            className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 focus:border-[#0B6E5C] focus:outline-none"
          >
            <option value="p">Văn bản thường</option>
            <option value="h1">Tiêu đề lớn (H1)</option>
            <option value="h2">Mục lớn (H2)</option>
            <option value="h3">Tiểu mục (H3)</option>
          </select>

          {/* Font Family */}
          <select
            value={editor.getAttributes('textStyle').fontFamily || 'Times New Roman'}
            onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
            title="Phông chữ"
            className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 focus:border-[#0B6E5C] focus:outline-none"
          >
            <option value="Times New Roman">Times New Roman</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>

          {/* Font Size */}
          <select
            value={editor.getAttributes('textStyle').fontSize || '13pt'}
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
            title="Cỡ chữ (chuẩn BGD: 12pt–13pt)"
            className="h-7 w-16 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-xs font-medium text-slate-700 focus:border-[#0B6E5C] focus:outline-none"
          >
            {['11pt', '12pt', '13pt', '14pt', '16pt', '18pt'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Bold / Italic / Underline / Strike */}
          <button onClick={() => editor.chain().focus().toggleBold().run()} title="In đậm (Ctrl+B)" className={btnCls(editor.isActive('bold'))}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} title="In nghiêng (Ctrl+I)" className={btnCls(editor.isActive('italic'))}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} title="Gạch chân (Ctrl+U)" className={btnCls(editor.isActive('underline'))}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} title="Gạch ngang" className={btnCls(editor.isActive('strike'))}>
            <Strikethrough className="h-3.5 w-3.5" />
          </button>

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColorMenu((v) => !v);
                setShowHighlightMenu(false);
                setShowSnippetMenu(false);
              }}
              title="Màu chữ"
              className={btnCls(showColorMenu)}
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
            {showColorMenu && (
              <div className="absolute top-8 left-0 z-40 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => {
                      editor.chain().focus().setColor(c.value).run();
                      setShowColorMenu(false);
                    }}
                    className="h-5 w-5 rounded-full border border-slate-300 transition hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlight Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowHighlightMenu((v) => !v);
                setShowColorMenu(false);
                setShowSnippetMenu(false);
              }}
              title="Tô sáng chữ (Highlight)"
              className={btnCls(editor.isActive('highlight') || showHighlightMenu)}
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            {showHighlightMenu && (
              <div className="absolute top-8 left-0 z-40 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: c.value }).run();
                      setShowHighlightMenu(false);
                    }}
                    className="h-5 w-5 rounded border border-slate-300 transition hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <button
                  title="Bỏ tô sáng"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightMenu(false);
                  }}
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Alignment */}
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Căn trái" className={btnCls(editor.isActive({ textAlign: 'left' }))}>
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Căn giữa" className={btnCls(editor.isActive({ textAlign: 'center' }))}>
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Căn phải" className={btnCls(editor.isActive({ textAlign: 'right' }))}>
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Căn đều hai bên" className={btnCls(editor.isActive({ textAlign: 'justify' }))}>
            <AlignJustify className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Lists */}
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách gạch đầu dòng" className={btnCls(editor.isActive('bulletList'))}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách đánh số" className={btnCls(editor.isActive('orderedList'))}>
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Insert Table / Image / Page Break */}
          <button
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run()}
            title="Chèn bảng mới (3 hàng × 4 cột)"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <TableIcon className="h-3.5 w-3.5" /> Bảng
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Chèn hình ảnh minh họa vào giáo án"
            className={btnCls()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Chèn ngắt trang (Page Break)"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Minus className="h-3.5 w-3.5" /> Ngắt trang
          </button>

          {/* 1-Click Preschool Word Templates Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSnippetMenu((v) => !v);
                setShowColorMenu(false);
                setShowHighlightMenu(false);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#E6F4F1] px-2.5 text-xs font-semibold text-[#0B6E5C] hover:bg-emerald-100"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> Chèn mẫu Mầm non <ChevronDown className="h-3 w-3" />
            </button>
            {showSnippetMenu && (
              <div className="absolute top-8 left-0 z-40 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {Object.entries(WORD_SNIPPETS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => {
                      smartInsertIntoEditor(editor, item.html, { mode: 'block' });
                      setShowSnippetMenu(false);
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-[#E6F4F1] hover:text-[#0B6E5C]"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* Normalize formatting + Find & Replace + Print */}
          <button
            onClick={() => normalizeWholeEditorDocument(editor)}
            title="Chuẩn hóa toàn trang về đúng phông Times New Roman 13pt, xóa định dạng lỗi & gạch đầu dòng thừa"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 hover:bg-[#E6F4F1] hover:text-[#0B6E5C]"
          >
            <RemoveFormatting className="h-3.5 w-3.5" /> Chuẩn hóa
          </button>
          <button
            onClick={() => setShowFindBar((v) => !v)}
            title="Tìm và thay thế văn bản"
            className={btnCls(showFindBar)}
          >
            <Replace className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => window.print()} title="In trực tiếp (Ctrl+P)" className={btnCls()}>
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Contextual Table Tools Bar (appears automatically when cursor is inside a table!) */}
        {inTable && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-1.5 text-[11px]">
            <span className="font-bold text-[#0B6E5C]">Công cụ bảng:</span>
            <button onClick={() => editor.chain().focus().addRowBefore().run()} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">+ Hàng trên</button>
            <button onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">+ Hàng dưới</button>
            <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">+ Cột trái</button>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">+ Cột phải</button>
            <button onClick={() => editor.chain().focus().mergeCells().run()} className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-[#0B6E5C] hover:bg-emerald-100">Gộp ô</button>
            <button onClick={() => editor.chain().focus().splitCell().run()} className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-[#0B6E5C] hover:bg-emerald-100">Tách ô</button>
            <button onClick={() => editor.chain().focus().deleteRow().run()} className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 hover:bg-rose-100">Xóa hàng</button>
            <button onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 hover:bg-rose-100">Xóa cột</button>
            <button onClick={() => editor.chain().focus().deleteTable().run()} className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 hover:bg-rose-200">Xóa bảng</button>
          </div>
        )}

        {/* Find & Replace inline bar */}
        {showFindBar && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-1.5 text-xs">
            <input
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Tìm cụm từ..."
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs"
            />
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Thay thế bằng..."
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs"
            />
            <button
              onClick={handleReplaceAll}
              className="rounded-lg bg-[#0B6E5C] px-3 py-1 text-xs font-semibold text-white hover:bg-[#085A4B]"
            >
              Thay thế tất cả
            </button>
            <button onClick={() => setShowFindBar(false)} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* A4 WORD DOCUMENT PAPER CANVAS                                       */}
      {/* =================================================================== */}
      <div className="flex-1 overflow-y-auto bg-[#E8ECEB] px-4 py-6 sm:px-8">
        <div
          className="word-page mx-auto w-full max-w-[820px] rounded-xs px-8 py-10 transition-transform sm:px-14 sm:py-12"
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* =================================================================== */}
      {/* WORD-STYLE BOTTOM STATUS BAR                                        */}
      {/* =================================================================== */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <span>
            <strong>{wordStats.words.toLocaleString('vi-VN')}</strong> từ •{' '}
            <strong>{wordStats.chars.toLocaleString('vi-VN')}</strong> ký tự
          </span>
          <span className="hidden sm:inline">Khổ A4 (21 × 29,7 cm) • Lề chuẩn NĐ 30/2020/NĐ-CP • Times New Roman</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[85, 100, 115].map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded px-1.5 py-0.5 font-semibold ${
                zoom === z ? 'bg-[#E6F4F1] text-[#0B6E5C]' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {z}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
