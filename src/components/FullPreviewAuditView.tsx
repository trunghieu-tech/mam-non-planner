import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { X } from 'lucide-react';
import type { ObjectivesDataset, WeeklyPlanDocument } from '../../shared/types';
import { smartInsertIntoEditor, type SmartInsertOptions } from '../utils/editorInsert';
import { runQualityChecks } from '../utils/helpers';
import {
  buildActivityLineHtml,
  buildInitialWordHtml,
  buildLessonSnippetHtml,
  buildMtLineHtml,
  buildShortLessonLineHtml,
} from '../utils/planToHtml';
import { WordEditor, type CursorContext, type DocHeadingItem } from './WordEditor';
import { AssistantPanel } from './AssistantPanel';

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  crawledTotalDocs: number;
  structuredRevision: number;
  onFullHtmlChange: (html: string, isManualEdit?: boolean) => void;
  onExportFullDocx: (latestHtml?: string) => void;
  onExportParentDocx: () => void;
  onExportXlsx: () => void;
  onOpenFullLibrary: (tab: 'bank' | 'crawled') => void;
  onNotify: (msg: string) => void;
}

export const FullPreviewAuditView: React.FC<Props> = ({
  plan,
  dataset,
  crawledTotalDocs,
  structuredRevision,
  onFullHtmlChange,
  onExportFullDocx,
  onExportParentDocx,
  onExportXlsx,
  onOpenFullLibrary,
  onNotify,
}) => {
  const [headings, setHeadings] = useState<DocHeadingItem[]>([]);
  const [rightMode, setRightMode] = useState<'audit' | 'assistant'>('audit');
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [cursorContext, setCursorContext] = useState<CursorContext>({
    sectionHeading: 'Trang bìa / Đầu văn bản',
    inTable: false,
  });
  const editorRef = useRef<Editor | null>(null);

  const compiledHtml = useMemo(
    () => buildInitialWordHtml(plan, dataset.objectives),
    [plan, dataset.objectives, structuredRevision]
  );

  const usedMtCodes = useMemo(() => {
    const src = plan.editorHtml || compiledHtml;
    return new Set(src.match(/\bMT\d{1,3}\b/g) || []);
  }, [plan.editorHtml, compiledHtml]);

  const checks = useMemo(() => runQualityChecks(plan), [plan]);
  const passCount = checks.filter((c) => c.ok).length;

  // Whenever structured plan data changed in Steps 1–3, auto-refresh the compiled A4 preview unless manual edits are locked!
  const lastSyncedRevRef = useRef<number>(structuredRevision);
  useEffect(() => {
    if (editorRef.current && lastSyncedRevRef.current !== structuredRevision) {
      lastSyncedRevRef.current = structuredRevision;
      if (!plan.hasManualFullDocEdits) {
        editorRef.current.commands.setContent(compiledHtml, { emitUpdate: false });
        onFullHtmlChange(compiledHtml, false);
      }
    }
  }, [structuredRevision, compiledHtml, plan.hasManualFullDocEdits, onFullHtmlChange]);

  const handleEditorReady = useCallback((ed: Editor | null) => {
    editorRef.current = ed;
  }, []);

  const handleResyncNow = () => {
    if (!editorRef.current) return;
    const fresh = buildInitialWordHtml(plan, dataset.objectives);
    editorRef.current.commands.setContent(fresh, { emitUpdate: false });
    onFullHtmlChange(fresh, false);
    onNotify('Đã đồng bộ lại toàn bộ 7 phần A4 từ Lịch tuần & các Tiết học!');
  };

  const jumpToHeading = (pos: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      ed.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    } catch {
      ed.chain().focus().run();
    }
  };

  const insertAtCursor = (html: string, label: string, opts?: SmartInsertOptions) => {
    const ed = editorRef.current;
    if (!ed) return;
    const nextHtml = smartInsertIntoEditor(ed, html, opts);
    onFullHtmlChange(nextHtml, true);
    onNotify(`Đã chèn ${label} chuẩn định dạng vào bản A4!`);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#E8ECEB]">
      {/* LEFT: LIVE A4 DOCUMENT OUTLINE */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-3.5 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#1D4ED8]">
            Mục lục bản in A4 ({headings.length})
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            Bấm mục bất kỳ để nhảy nhanh trên bản hoàn chỉnh
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => jumpToHeading(h.pos)}
              title={h.text}
              className={`block w-full truncate rounded-md py-1.5 text-left text-xs transition hover:bg-[#DBEAFE] hover:text-[#1D4ED8] ${
                h.level === 1
                  ? 'px-2 font-bold text-slate-900'
                  : h.level === 2
                  ? 'pl-4 pr-2 font-semibold text-slate-700'
                  : 'pl-6 pr-2 text-[11px] text-slate-500'
              }`}
            >
              {h.text}
            </button>
          ))}
        </div>
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleResyncNow}
            className="w-full rounded-xl border border-blue-200 bg-[#EFF6FF] px-3 py-2 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
          >
            Đồng bộ lại từ Bước 1–3
          </button>
        </div>
      </aside>

      {/* CENTER: FULL AUTO-ASSEMBLED A4 WORD DOCUMENT */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Always-accessible compact Audit & Parent Schedule strip on smaller viewports (< lg) */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold ${
                passCount === checks.length
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              Kiểm duyệt BGD: {passCount}/{checks.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onExportParentDocx}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Lịch Phụ huynh (.docx)
            </button>
            <button
              onClick={() => setMobileRightOpen(true)}
              className="rounded-lg bg-[#1D4ED8] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              Kiểm duyệt &amp; Xuất
            </button>
          </div>
        </div>

        {plan.hasManualFullDocEdits && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-950">
            <span>
              <strong>Khóa an toàn Bước 4:</strong> Đang giữ nội dung gõ chỉnh sửa tay riêng trên trang A4 tổng hợp (không bị ghi đè tự động).
            </span>
            <button
              type="button"
              onClick={handleResyncNow}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
            >
              Đồng bộ mới lại từ Bước 1–3
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          <WordEditor
            planId={`full_${plan.id}_${plan.hasManualFullDocEdits ? 'locked' : structuredRevision}`}
            initialHtml={
              plan.hasManualFullDocEdits && plan.editorHtml ? plan.editorHtml : compiledHtml
            }
            onHtmlChange={(html) => onFullHtmlChange(html, true)}
            onOutlineChange={setHeadings}
            onCursorContextChange={setCursorContext}
            onEditorReady={handleEditorReady}
          />
        </div>
      </main>

      {/* RIGHT: 6-POINT BGD QUALITY AUDIT + DUAL EXPORT (SIDEBAR ON LG+, SLIDE-OVER DRAWER ON < LG) */}
      <aside
        className={`${
          mobileRightOpen
            ? 'fixed inset-y-0 right-0 z-50 flex w-[350px] max-w-[92vw] shadow-2xl'
            : 'hidden'
        } shrink-0 flex-col border-l border-slate-200 bg-white lg:static lg:z-auto lg:flex lg:w-[340px] lg:shadow-none xl:w-[370px]`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-2.5">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setRightMode('audit')}
              className={`rounded-lg py-1.5 transition ${
                rightMode === 'audit' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Kiểm duyệt ({passCount}/{checks.length})
            </button>
            <button
              onClick={() => setRightMode('assistant')}
              className={`rounded-lg py-1.5 transition ${
                rightMode === 'assistant' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Chèn gợi ý
            </button>
          </div>
          {mobileRightOpen && (
            <button
              onClick={() => setMobileRightOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {rightMode === 'audit' ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* Dual Export Action Cards */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Xuất hồ sơ sử dụng ngay
              </div>

              <button
                onClick={() =>
                  onExportFullDocx(editorRef.current ? editorRef.current.getHTML() : compiledHtml)
                }
                className="block w-full rounded-2xl bg-[#1D4ED8] p-3.5 text-left text-white shadow-sm transition hover:bg-[#1E40AF]"
              >
                <div className="text-xs font-bold">Xuất Giáo án đầy đủ (.docx chuẩn BGD)</div>
                <div className="mt-0.5 text-[11px] text-blue-100">
                  Đủ 7 phần • Khổ A4 NĐ 30/2020 • Nộp Tổ trưởng &amp; BGH
                </div>
              </button>

              <button
                onClick={onExportParentDocx}
                className="block w-full rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-left text-amber-950 transition hover:bg-amber-100/80"
              >
                <div className="text-xs font-bold">Xuất Tờ Lịch Tuần 1 trang (.docx)</div>
                <div className="mt-0.5 text-[11px] text-amber-800">
                  Gọn 1 trang A4 ngang • Dán bảng tin lớp / gửi Zalo Phụ huynh
                </div>
              </button>

              <button
                onClick={onExportXlsx}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Xuất thêm bảng tổng hợp Excel (.xlsx)
              </button>
            </div>

            {/* 6-Point Quality Audit Checklist */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Rà soát 6 tiêu chí chuẩn BGD
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    passCount === checks.length
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  Đạt {passCount}/{checks.length}
                </span>
              </div>

              {checks.map((c, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-2.5 text-xs ${
                    c.ok
                      ? 'border-blue-200/70 bg-blue-50/40'
                      : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{c.label}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        c.ok ? 'bg-blue-100 text-blue-800' : 'bg-amber-200 text-amber-950'
                      }`}
                    >
                      {c.ok ? 'Đạt' : 'Cần bổ sung'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <AssistantPanel
              plan={plan}
              dataset={dataset}
              crawledTotalDocs={crawledTotalDocs}
              usedMtCodes={usedMtCodes}
              cursorContext={cursorContext}
              onClose={() => setRightMode('audit')}
              onInsertMtLine={(obj) => insertAtCursor(buildMtLineHtml(obj), obj.code, { mode: 'mt' })}
              onInsertActivityLine={(obj, act) =>
                insertAtCursor(buildActivityLineHtml(obj, act), `hoạt động ${obj.code}`, { mode: 'line' })
              }
              onInsertShortLessonLine={(topic, subj, mt) =>
                insertAtCursor(buildShortLessonLineHtml(topic, subj, mt), `dòng [${subj}]`, { mode: 'line' })
              }
              onInsertLessonFrame={(topic, subj, mt, obj) =>
                insertAtCursor(
                  buildLessonSnippetHtml(topic, subj, mt, obj),
                  `giáo án “${topic.slice(0, 35)}”`,
                  { mode: 'block' }
                )
              }
              onOpenFullLibrary={onOpenFullLibrary}
            />
          </div>
        )}
      </aside>
    </div>
  );
};
