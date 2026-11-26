import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DayPlan,
  LessonMediaAttachment,
  LessonPlan,
  ObjectivesDataset,
  SavedLessonTemplate,
  SharedMediaResource,
  WeeklyPlanDocument,
} from '../../shared/types';
import { fmtDateVN } from '../utils/helpers';
import { smartInsertIntoEditor, type SmartInsertOptions } from '../utils/editorInsert';
import {
  buildPedagogicalLessonPlan,
  DAILY_EVAL_PRESETS,
  getSubjectsForAgeGroup,
  lessonPlanToRichHtml,
  resolveSubjectMeta,
} from '../utils/subjectTemplates';
import { getSubjectVisual } from '../utils/visualMeta';
import { WordEditor } from './WordEditor';
import { FocusedAssistant } from './FocusedAssistant';
import { QuickLessonPickerModal } from './QuickLessonPickerModal';

export type FocusTarget =
  | { dayIdx: number; kind: 'main'; lessonId: string }
  | { dayIdx: number; kind: 'afternoon' }
  | { dayIdx: number; kind: 'eval' }
  | { dayIdx: number; kind: 'dayBook' };

interface Props {
  plan: WeeklyPlanDocument;
  allPlans?: WeeklyPlanDocument[];
  dataset: ObjectivesDataset;
  initialTarget: FocusTarget | null;
  onUpdatePlan: (next: WeeklyPlanDocument, toastMsg?: string) => void;
  onOpenFullLibrary: (tab: 'bank' | 'crawled' | 'works' | 'media') => void;
  onGoToPreview: () => void;
}

export const FocusedWordStudio: React.FC<Props> = ({
  plan,
  allPlans = [],
  dataset,
  initialTarget,
  onUpdatePlan,
  onOpenFullLibrary,
  onGoToPreview,
}) => {
  const defaultTarget = useMemo<FocusTarget>(() => {
    for (let i = 0; i < plan.days.length; i++) {
      if (plan.days[i].mainLessons.length > 0) {
        return { dayIdx: i, kind: 'main', lessonId: plan.days[i].mainLessons[0].id };
      }
    }
    return { dayIdx: 0, kind: 'eval' };
  }, [plan.id]);

  const [target, setTarget] = useState<FocusTarget>(initialTarget || defaultTarget);
  const [showAssistant, setShowAssistant] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [templatesRevision, setTemplatesRevision] = useState(1);
  const [savingTpl, setSavingTpl] = useState(false);
  const [showMediaBar, setShowMediaBar] = useState(false);
  const [mediaSuggestions, setMediaSuggestions] = useState<SharedMediaResource[]>([]);
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaKind, setNewMediaKind] = useState<LessonMediaAttachment['kind']>('VIDEO');

  // Hộp thoại Xuất Sổ Kế hoạch Giáo dục Ngày theo khoảng ngày (YC-050, nâng cấp chuẩn Vietec f_49m15s)
  const [showDailyExportModal, setShowDailyExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState(plan.weekStartDate);
  const [exportToDate, setExportToDate] = useState(plan.weekEndDate);
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [exportContinuous, setExportContinuous] = useState(false);
  const [incChildDailyEval, setIncChildDailyEval] = useState(true);
  const [incGvEval, setIncGvEval] = useState(true);
  const [incBghCmt, setIncBghCmt] = useState(true);
  const [incSign, setIncSign] = useState(true);
  const [exportingDaily, setExportingDaily] = useState(false);

  const [pickerDay, setPickerDay] = useState<{ dayIdx: number; slotType: 'MAIN' | 'AFTERNOON' } | null>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    setExportFromDate(plan.weekStartDate);
    setExportToDate(plan.weekEndDate);
  }, [plan.weekStartDate, plan.weekEndDate]);

  // Danh sách tuần tự tất cả các tiết (Chính + Chiều) để chuyển nhanh ← Tiết trước / Tiết sau →
  const orderedLessonTargets = useMemo<FocusTarget[]>(() => {
    const list: FocusTarget[] = [];
    plan.days.forEach((d, dayIdx) => {
      d.mainLessons.forEach((l) => list.push({ dayIdx, kind: 'main', lessonId: l.id }));
      if (d.afternoonLesson) list.push({ dayIdx, kind: 'afternoon' });
    });
    return list;
  }, [plan.days]);

  const currentLessonOrderIdx = useMemo(() => {
    return orderedLessonTargets.findIndex((t) => {
      if (t.dayIdx !== target.dayIdx || t.kind !== target.kind) return false;
      if (t.kind === 'main' && target.kind === 'main') return t.lessonId === target.lessonId;
      return true;
    });
  }, [orderedLessonTargets, target]);

  useEffect(() => {
    if (initialTarget) setTarget(initialTarget);
  }, [initialTarget]);

  const activeDay: DayPlan = plan.days[target.dayIdx] || plan.days[0];
  const activeLesson: LessonPlan | null = useMemo(() => {
    if (target.kind === 'main') {
      return activeDay.mainLessons.find((l) => l.id === target.lessonId) || activeDay.mainLessons[0] || null;
    }
    if (target.kind === 'afternoon') {
      return activeDay.afternoonLesson;
    }
    return null;
  }, [activeDay, target]);

  const activeLessonKey = activeLesson
    ? `${plan.id}_${target.dayIdx}_${target.kind}_${activeLesson.id}`
    : `${plan.id}_${target.dayIdx}_eval`;

  const initialLessonHtml = useMemo(() => {
    if (!activeLesson) return '';
    return lessonPlanToRichHtml(activeLesson);
  }, [activeLessonKey]);

  const handleEditorReady = useCallback((ed: Editor | null) => {
    editorRef.current = ed;
  }, []);

  const updateActiveLesson = useCallback(
    (updater: (les: LessonPlan) => LessonPlan, toast?: string) => {
      if (!activeLesson) return;
      const nextDays = plan.days.map((d, idx) => {
        if (idx !== target.dayIdx) return d;
        if (target.kind === 'main') {
          return {
            ...d,
            mainLessons: d.mainLessons.map((l) => (l.id === activeLesson.id ? updater(l) : l)),
          };
        }
        if (target.kind === 'afternoon' && d.afternoonLesson) {
          return { ...d, afternoonLesson: updater(d.afternoonLesson) };
        }
        return d;
      });
      onUpdatePlan({ ...plan, days: nextDays }, toast);
    },
    [activeLesson, plan, target, onUpdatePlan]
  );

  const handleLessonHtmlChange = useCallback(
    (html: string) => {
      updateActiveLesson((les) => ({ ...les, richHtml: html }));
    },
    [updateActiveLesson]
  );

  const handleRegeneratePedagogy = () => {
    if (!activeLesson) return;
    const obj = dataset.objectives.find(
      (o) => o.ageGroupId === plan.ageGroupId && o.code === activeLesson.linkedMtCodes?.[0]
    );
    const fresh = buildPedagogicalLessonPlan({
      topicTitle: activeLesson.topicTitle,
      subjectCode: activeLesson.subjectCode,
      ageGroupId: plan.ageGroupId,
      slotType: activeLesson.slotType,
      mtCode: activeLesson.linkedMtCodes?.[0],
      obj,
      subTopics: activeLesson.subTopics,
    });
    const freshHtml = fresh.richHtml || lessonPlanToRichHtml(fresh);
    updateActiveLesson(
      (les) => ({
        ...les,
        aims: fresh.aims,
        preparation: fresh.preparation,
        steps: fresh.steps,
        richHtml: freshHtml,
      }),
      `Đã tạo lại khung sư phạm chuẩn môn ${resolveSubjectMeta(activeLesson.subjectCode).shortLabel}!`
    );
    if (editorRef.current) {
      editorRef.current.commands.setContent(freshHtml, { emitUpdate: false });
    }
  };

  const handleSaveAsLessonTemplate = async () => {
    if (!activeLesson) return;
    setSavingTpl(true);
    try {
      const currentHtml = editorRef.current?.getHTML() || lessonPlanToRichHtml(activeLesson);
      const payload: SavedLessonTemplate = {
        id: `tpl_${Date.now()}`,
        ageGroupId: plan.ageGroupId,
        subjectCode: resolveSubjectMeta(activeLesson.subjectCode).code,
        topicTitle: activeLesson.topicTitle || 'Bài giảng mẫu',
        linkedMtCodes: activeLesson.linkedMtCodes || [],
        richHtml: currentHtml,
        createdBy: plan.teacherName || 'Giáo viên lớp',
        createdAt: new Date().toISOString(),
      };
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setTemplatesRevision((r) => r + 1);
        updateActiveLesson(
          (les) => ({ ...les, richHtml: currentHtml }),
          `Đã lưu “${payload.topicTitle.slice(0, 35)}” vào Thư viện Bài giảng mẫu của tôi!`
        );
      }
    } finally {
      setSavingTpl(false);
    }
  };

  const handleApplySavedTemplate = (tpl: SavedLessonTemplate) => {
    if (!activeLesson) return;
    editorRef.current?.commands.setContent(tpl.richHtml, { emitUpdate: false });
    const meta = resolveSubjectMeta(tpl.subjectCode);
    updateActiveLesson(
      (les) => ({
        ...les,
        subjectCode: meta.code,
        subjectFullTitle: meta.fullTitle,
        domainTitle: meta.domainTitle,
        topicTitle: tpl.topicTitle,
        linkedMtCodes: tpl.linkedMtCodes?.length ? tpl.linkedMtCodes : les.linkedMtCodes,
        richHtml: tpl.richHtml,
      }),
      `Đã áp dụng bài giảng mẫu “${tpl.topicTitle.slice(0, 35)}”!`
    );
  };

  const dayUnresolvedComments = useMemo(
    () =>
      (plan.reviewComments || []).filter(
        (c) =>
          !c.resolved &&
          c.targetSection.trim().toLowerCase() === activeDay.dayLabel.trim().toLowerCase()
      ),
    [plan.reviewComments, activeDay.dayLabel]
  );

  const handleMarkDayCommentsFixed = () => {
    const targetIds = new Set(dayUnresolvedComments.map((c) => c.id));
    const nextComments = (plan.reviewComments || []).map((c) =>
      targetIds.has(c.id) ? { ...c, resolved: true } : c
    );
    const anyLeft = nextComments.some((c) => !c.resolved);
    onUpdatePlan(
      {
        ...plan,
        reviewComments: nextComments,
        status: !anyLeft && plan.status === 'NEEDS_REVISION' ? 'PENDING_REVIEW' : plan.status,
      },
      `Đã đánh dấu hoàn tất sửa theo góp ý của BGH cho ${activeDay.dayLabel}!`
    );
  };

  const handleInsertHtmlAtCursor = (html: string, label: string, opts?: SmartInsertOptions) => {
    const ed = editorRef.current;
    if (!ed) return;
    const nextHtml = smartInsertIntoEditor(ed, html, opts);
    updateActiveLesson(
      (les) => ({ ...les, richHtml: nextHtml }),
      `Đã chèn ${label} chuẩn định dạng vào tiết đang soạn!`
    );
  };

  const handleToggleLessonMt = (mtCode: string) => {
    if (!activeLesson) return;
    const exists = activeLesson.linkedMtCodes.includes(mtCode);
    updateActiveLesson(
      (les) => ({
        ...les,
        linkedMtCodes: exists
          ? les.linkedMtCodes.filter((c) => c !== mtCode)
          : [...les.linkedMtCodes, mtCode],
      }),
      exists ? `Đã bỏ ${mtCode} khỏi tiết này.` : `Đã gắn ${mtCode} vào tiết này!`
    );
  };

  const updateDayEval = (
    field: 'evalHealth' | 'evalEmotionBehavior' | 'evalKnowledgeSkill' | 'evalAdjustment',
    value: string
  ) => {
    const nextDays = plan.days.map((d, i) => (i === target.dayIdx ? { ...d, [field]: value } : d));
    onUpdatePlan({ ...plan, days: nextDays });
  };

  useEffect(() => {
    if (!showMediaBar || !activeLesson) return;
    const subj = resolveSubjectMeta(activeLesson.subjectCode).code;
    fetch(`/api/media?ageGroupId=${plan.ageGroupId}&subjectCode=${subj}`)
      .then((r) => r.json())
      .then((d) => setMediaSuggestions(d.items || []))
      .catch(() => setMediaSuggestions([]));
  }, [showMediaBar, activeLesson?.id, activeLesson?.subjectCode, plan.ageGroupId]);

  const handleAttachMediaItem = (item: Omit<LessonMediaAttachment, 'id'>) => {
    if (!activeLesson || !item.title.trim() || !item.url.trim()) return;
    const attached: LessonMediaAttachment = {
      id: `lmed_${Date.now()}`,
      kind: item.kind,
      title: item.title.trim(),
      url: item.url.trim(),
    };
    updateActiveLesson(
      (les) => ({ ...les, mediaItems: [...(les.mediaItems || []), attached] }),
      `Đã đính kèm học liệu “${attached.title.slice(0, 30)}” vào tiết học!`
    );
    setNewMediaTitle('');
    setNewMediaUrl('');
  };

  const handleRemoveMediaItem = (id: string) => {
    updateActiveLesson((les) => ({
      ...les,
      mediaItems: (les.mediaItems || []).filter((m) => m.id !== id),
    }));
  };

  const handleExportDailyRangeDocx = async () => {
    setExportingDaily(true);
    try {
      const sameGradePlans = allPlans.filter((p) => p.ageGroupId === plan.ageGroupId);
      const sourcePlans = sameGradePlans.length > 0 ? sameGradePlans : [plan];
      const res = await fetch('/api/export/daily-plans-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plans: sourcePlans.map((p) => (p.id === plan.id ? plan : p)),
          options: {
            fromDate: exportFromDate,
            toDate: exportToDate,
            orientation: exportOrientation,
            continuous: exportContinuous,
            includeDailyChildEval: incChildDailyEval,
            includeGvEval: incGvEval,
            includeBghComments: incBghCmt,
            includeSignature: incSign,
          },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SoGiaoAnNgay_${plan.className.replace(/\s+/g, '')}_${exportFromDate}_den_${exportToDate}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setShowDailyExportModal(false);
      }
    } finally {
      setExportingDaily(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#E8ECEB]">
      {/* LEFT COMPACT WEEK-ITEM NAVIGATOR (hidden in Zen Focus Mode) */}
      {!zenMode && (
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-3.5 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#1D4ED8]">
            Danh sách tiết trong Tuần {plan.weekNumber}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            Bấm từng tiết để soạn gọn trên trang Word (không phải cuộn 25 trang)
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {plan.days.map((day, dIdx) => (
            <div key={day.dayOfWeek} className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-700">
                  {day.dayLabel} <span className="font-normal text-slate-400">({fmtDateVN(day.dateStr).slice(0, 5)})</span>
                </span>
                <button
                  onClick={() => setPickerDay({ dayIdx: dIdx, slotType: 'MAIN' })}
                  title={`Thêm tiết chính cho ${day.dayLabel}`}
                  className="rounded p-0.5 text-[#1D4ED8] hover:bg-[#DBEAFE]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {day.mainLessons.map((les) => {
                const sv = getSubjectVisual(les.subjectCode);
                const isSelected =
                  target.dayIdx === dIdx && target.kind === 'main' && target.lessonId === les.id;
                return (
                  <button
                    key={les.id}
                    onClick={() => setTarget({ dayIdx: dIdx, kind: 'main', lessonId: les.id })}
                    className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                      isSelected
                        ? 'border-[#1D4ED8] bg-[#DBEAFE] shadow-2xs'
                        : 'border-transparent bg-slate-50/80 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${sv.chipClass}`}>
                      {les.subjectCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[11px] leading-snug font-semibold text-slate-800">
                        {les.topicTitle}
                      </div>
                    </div>
                  </button>
                );
              })}

              {day.afternoonLesson && (
                <button
                  onClick={() => setTarget({ dayIdx: dIdx, kind: 'afternoon' })}
                  className={`flex w-full items-center rounded-xl border px-2.5 py-1.5 text-left transition ${
                    target.dayIdx === dIdx && target.kind === 'afternoon'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-transparent bg-indigo-50/40 hover:bg-indigo-50'
                  }`}
                >
                  <span className="truncate text-[11px] font-medium text-indigo-900">
                    Chiều: {day.afternoonLesson.topicTitle}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTarget({ dayIdx: dIdx, kind: 'dayBook' })}
                  className={`flex-1 rounded-lg px-2 py-1 text-left text-[10px] font-semibold transition ${
                    target.dayIdx === dIdx && target.kind === 'dayBook'
                      ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Sổ trọn ngày
                </button>
                <button
                  onClick={() => setTarget({ dayIdx: dIdx, kind: 'eval' })}
                  className={`flex flex-1 items-center justify-between rounded-lg px-2 py-1 text-left text-[10px] font-semibold transition ${
                    target.dayIdx === dIdx && target.kind === 'eval'
                      ? 'bg-amber-100 text-amber-900'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span>Nhận xét</span>
                  {(day.evalHealth || day.evalEmotionBehavior || day.evalKnowledgeSkill) && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-slate-100 p-3">
          <button
            onClick={() => setShowDailyExportModal(true)}
            className="w-full rounded-xl border border-blue-200 bg-[#EFF6FF] py-2 text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE]"
          >
            Xuất Sổ Ngày (.docx)
          </button>
          <button
            onClick={onGoToPreview}
            className="w-full rounded-xl bg-[#1D4ED8] py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Xem trọn bộ A4 &amp; Xuất Word →
          </button>
        </div>
      </aside>
      )}

      {/* CENTER FOCUSED EDITOR */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {target.kind === 'dayBook' ? (
          /* SỔ KẾ HOẠCH GIÁO DỤC NGÀY (LIÊN KẾT TỰ ĐỘNG TỪ TUẦN — YC-050) */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase text-[#1D4ED8]">
                    Sổ Kế hoạch Giáo dục Ngày (tự động tổng hợp từ Lịch tuần &amp; Hoạt động cả tuần)
                  </div>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                    {activeDay.dayLabel}, ngày {fmtDateVN(activeDay.dateStr)} • Lớp {plan.className}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDailyExportModal(true)}
                  className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E40AF]"
                >
                  Xuất Sổ Giáo án Ngày (.docx)
                </button>
              </div>

              {activeDay.isHoliday ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-xs font-bold text-amber-900">
                  ★ {activeDay.holidayName || 'Nghỉ Lễ / Sự kiện trường'} — Trẻ nghỉ học theo quy định.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#1D4ED8] text-white">
                        <th className="w-44 border-r border-blue-700/50 px-3.5 py-2.5 font-bold">
                          Thời điểm sinh hoạt
                        </th>
                        <th className="border-r border-blue-700/50 px-3.5 py-2.5 font-bold">
                          Nội dung tổ chức trong ngày
                        </th>
                        <th className="w-56 px-3.5 py-2.5 font-bold">Nhận xét GV / BGH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          1. Đón trẻ &amp; Thể dục sáng
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 space-y-1 text-slate-700">
                          <div>• {plan.welcomeRoutineNotes[0] || 'Đón trẻ ân cần, trao đổi nhanh với phụ huynh.'}</div>
                          <div>
                            • <strong>Thể dục sáng:</strong> {plan.morningExercise.moves.map((m) => m.name).join(' · ')}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-slate-400 italic">Theo nề nếp tuần</td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          2. Trò chuyện sáng
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 text-slate-700">
                          • {(plan.morningTalkNotes && plan.morningTalkNotes[0]) || `Trò chuyện cùng trẻ về nhánh chủ đề “${plan.subThemeName}”`}
                        </td>
                        <td className="px-3.5 py-3 text-slate-400 italic">Đàm thoại đầu giờ</td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          3. Hoạt động học
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 space-y-2">
                          {activeDay.mainLessons.length === 0 ? (
                            <span className="text-slate-400 italic">Chưa xếp tiết chính</span>
                          ) : (
                            activeDay.mainLessons.map((les) => (
                              <div key={les.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900">
                                    [{les.subjectCode}] {les.topicTitle}{' '}
                                    {les.linkedMtCodes?.[0] && (
                                      <span className="text-[#1D4ED8]">({les.linkedMtCodes.join(', ')})</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTarget({ dayIdx: target.dayIdx, kind: 'main', lessonId: les.id })
                                    }
                                    className="font-bold text-[#1D4ED8] hover:underline"
                                  >
                                    Mở soạn Word →
                                  </button>
                                </div>
                                <div className="mt-1.5 grid gap-2 border-t border-slate-200/70 pt-1.5 text-[11px] text-slate-600 md:grid-cols-3">
                                  <div>
                                    <strong className="text-slate-800">Mục đích:</strong>{' '}
                                    {les.aims[0] || 'Theo mục tiêu bài dạy'}
                                  </div>
                                  <div>
                                    <strong className="text-slate-800">Chuẩn bị:</strong>{' '}
                                    {les.preparation[0] || 'Đồ dùng cô và trẻ'}
                                  </div>
                                  <div>
                                    <strong className="text-slate-800">Cách tiến hành:</strong>{' '}
                                    {les.steps.map((s) => s.title).join(' → ') || 'Ổn định → Trọng tâm → Kết thúc'}
                                  </div>
                                </div>
                                {les.mediaItems && les.mediaItems.length > 0 && (
                                  <div className="mt-1 text-[11px] text-sky-700">
                                    • Học liệu Media: {les.mediaItems.map((m) => m.title).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          {dayUnresolvedComments.length > 0 ? (
                            <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">
                              <strong>BGH góp ý:</strong> {dayUnresolvedComments[0].content}
                            </div>
                          ) : (
                            <span className="text-[11px] text-blue-700 font-semibold">
                              {plan.status === 'APPROVED' ? '✓ BGH đã ký duyệt' : 'Không có góp ý'}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          4. Hoạt động ngoài trời
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 text-slate-700">
                          <div>• Quan sát: <strong>{activeDay.outdoorObservation}</strong></div>
                          {plan.outdoorTable[1] && <div className="mt-0.5">• {plan.outdoorTable[1].title}</div>}
                        </td>
                        <td className="px-3.5 py-3 text-slate-400">—</td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          5. Chơi góc &amp; Ăn ngủ vệ sinh
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 space-y-1 text-slate-700">
                          <div>• <strong>Góc chơi:</strong> {plan.cornerTable.map((c) => c.cornerName).join(', ')}</div>
                          <div>• <strong>Ăn – Ngủ – Vệ sinh:</strong> {plan.laborHygieneNotes[0] || 'Rửa tay đúng quy trình trước khi ăn, ngủ đúng giờ.'}</div>
                        </td>
                        <td className="px-3.5 py-3 text-slate-400">—</td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          6. Hoạt động chiều &amp; Nêu gương trả trẻ
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 space-y-1 text-slate-700">
                          {activeDay.afternoonLesson ? (
                            <div>
                              • <strong>HĐ Chiều [{activeDay.afternoonLesson.subjectCode}]:</strong>{' '}
                              {activeDay.afternoonLesson.topicTitle}
                            </div>
                          ) : (
                            <div>• Ôn luyện kỹ năng / Vui chơi nhẹ nhàng theo nhóm</div>
                          )}
                          <div>• <strong>Nêu gương – Trả trẻ:</strong> Bình xét Bé ngoan ({plan.praiseStandards[0] || 'Đi học ngoan, lễ phép'}).</div>
                        </td>
                        <td className="px-3.5 py-3 text-slate-400">—</td>
                      </tr>
                      <tr>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3.5 py-3 font-bold text-[#1E3A8A]">
                          7. Nhận xét &amp; Chỉnh sửa cuối ngày
                        </td>
                        <td className="border-r border-slate-200 px-3.5 py-3 space-y-1 text-slate-700" colSpan={2}>
                          <div>• <strong>Sức khỏe:</strong> {activeDay.evalHealth || '(Chưa ghi)'}</div>
                          <div>• <strong>Cảm xúc, hành vi:</strong> {activeDay.evalEmotionBehavior || '(Chưa ghi)'}</div>
                          <div>• <strong>Kiến thức, kỹ năng:</strong> {activeDay.evalKnowledgeSkill || '(Chưa ghi)'}</div>
                          <div>• <strong>Chỉnh sửa / Điều chỉnh kế hoạch:</strong> {activeDay.evalAdjustment || '(Không có điều chỉnh)'}</div>
                          <button
                            type="button"
                            onClick={() => setTarget({ dayIdx: target.dayIdx, kind: 'eval' })}
                            className="mt-1 inline-block font-bold text-[#1D4ED8] hover:underline"
                          >
                            Ghi / Chỉnh sửa nhận xét cuối ngày →
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : target.kind === 'eval' ? (
          /* 3-CRITERIA DAILY EVALUATION QUICK PAD */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="text-xs font-bold uppercase text-[#1D4ED8]">
                    Nhật ký Đánh giá cuối ngày (3 tiêu chí chuẩn Bộ GD&ĐT)
                  </div>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                    {activeDay.dayLabel}, ngày {fmtDateVN(activeDay.dateStr)}
                  </h2>
                </div>
                <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1D4ED8]">
                  Tự ghép cuối ngày trên Word A4
                </span>
              </div>

              {/* Criterion 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  1. Tình trạng sức khỏe của trẻ (sĩ số, ăn ngủ, biểu hiện cần lưu ý)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAILY_EVAL_PRESETS.health.map((txt, i) => (
                    <button
                      key={i}
                      onClick={() => updateDayEval('evalHealth', txt)}
                      className="rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-medium text-blue-900 hover:bg-blue-100"
                    >
                      + {txt.slice(0, 48)}...
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={activeDay.evalHealth}
                  onChange={(e) => updateDayEval('evalHealth', e.target.value)}
                  placeholder="Nhập hoặc bấm chọn nhanh mẫu câu ở trên (để trống nếu muốn in dòng chấm viết tay)..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              {/* Criterion 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  2. Trạng thái cảm xúc, thái độ, hành vi của trẻ
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAILY_EVAL_PRESETS.emotion.map((txt, i) => (
                    <button
                      key={i}
                      onClick={() => updateDayEval('evalEmotionBehavior', txt)}
                      className="rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-900 hover:bg-sky-100"
                    >
                      + {txt.slice(0, 48)}...
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={activeDay.evalEmotionBehavior}
                  onChange={(e) => updateDayEval('evalEmotionBehavior', e.target.value)}
                  placeholder="Nhập nhận xét cảm xúc, thái độ, nề nếp..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              {/* Criterion 3 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  3. Kiến thức, kỹ năng của trẻ (tỷ lệ đạt, trẻ cần rèn thêm vào ngày sau)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAILY_EVAL_PRESETS.knowledge.map((txt, i) => (
                    <button
                      key={i}
                      onClick={() => updateDayEval('evalKnowledgeSkill', txt)}
                      className="rounded-full border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                    >
                      + {txt.slice(0, 48)}...
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={activeDay.evalKnowledgeSkill}
                  onChange={(e) => updateDayEval('evalKnowledgeSkill', e.target.value)}
                  placeholder="Nhập nhận xét kiến thức, kỹ năng trẻ đạt được trong ngày..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              {/* Criterion 4: Chỉnh sửa / Lưu ý điều chỉnh kế hoạch (chuẩn Vietec KHGD ngày) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  4. Chỉnh sửa / Lưu ý điều chỉnh kế hoạch cho ngày tiếp theo
                </label>
                <textarea
                  rows={2}
                  value={activeDay.evalAdjustment || ''}
                  onChange={(e) => updateDayEval('evalAdjustment', e.target.value)}
                  placeholder="Ghi ngắn gọn nội dung cần điều chỉnh hoặc rèn bù vào hoạt động chiều / ngày kế tiếp..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>
          </div>
        ) : activeLesson ? (
          /* FOCUSED WORD EDITOR FOR THIS SINGLE LESSON */
          <>
            {/* Compact Synced Lesson Meta Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#F5F9FF] px-4 py-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#1D4ED8] px-2 py-0.5 text-[10px] font-bold text-white">
                  {activeDay.dayLabel}
                </span>
                <select
                  value={resolveSubjectMeta(activeLesson.subjectCode).code}
                  onChange={(e) => {
                    const m = resolveSubjectMeta(e.target.value);
                    updateActiveLesson((les) => ({
                      ...les,
                      subjectCode: m.code,
                      subjectFullTitle: m.fullTitle,
                      domainTitle: m.domainTitle,
                    }));
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800"
                >
                  {(() => {
                    const allowed = getSubjectsForAgeGroup(plan.ageGroupId);
                    const curMeta = resolveSubjectMeta(activeLesson.subjectCode);
                    const opts = allowed.some((s) => s.code === curMeta.code)
                      ? allowed
                      : [curMeta, ...allowed];
                    return opts.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.shortLabel}
                      </option>
                    ));
                  })()}
                </select>
                <input
                  value={activeLesson.topicTitle}
                  onChange={(e) =>
                    updateActiveLesson((les) => ({ ...les, topicTitle: e.target.value }))
                  }
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  placeholder="Tên đề tài tiết học..."
                />
              </div>

              <div className="flex items-center gap-1.5">
                {orderedLessonTargets.length > 1 && currentLessonOrderIdx >= 0 && (
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                    <button
                      disabled={currentLessonOrderIdx <= 0}
                      onClick={() => setTarget(orderedLessonTargets[currentLessonOrderIdx - 1])}
                      title="Chuyển về tiết trước"
                      className="p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-1.5 text-[10px] font-bold text-slate-600">
                      {currentLessonOrderIdx + 1}/{orderedLessonTargets.length}
                    </span>
                    <button
                      disabled={currentLessonOrderIdx >= orderedLessonTargets.length - 1}
                      onClick={() => setTarget(orderedLessonTargets[currentLessonOrderIdx + 1])}
                      title="Chuyển sang tiết kế tiếp"
                      className="p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowMediaBar((v) => !v)}
                  title="Đính kèm link Video YouTube / Slide PowerPoint / Tranh ảnh vào tiết học này"
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    showMediaBar || (activeLesson.mediaItems?.length || 0) > 0
                      ? 'border-sky-300 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Media ({activeLesson.mediaItems?.length || 0})
                </button>
                <button
                  onClick={handleSaveAsLessonTemplate}
                  disabled={savingTpl}
                  title="Lưu bài soạn hiện tại vào Thư viện Bài giảng mẫu cá nhân để dùng lại cho lớp khác / năm sau"
                  className="rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  {savingTpl ? 'Đang lưu...' : 'Lưu bài mẫu'}
                </button>
                <button
                  onClick={handleRegeneratePedagogy}
                  title="Tạo lại toàn bộ bố cục I / II / III theo đúng khung sư phạm chuẩn của môn này"
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                >
                  Khung chuẩn {resolveSubjectMeta(activeLesson.subjectCode).code}
                </button>
                <button
                  onClick={() =>
                    setZenMode((prev) => {
                      const next = !prev;
                      setShowAssistant(!next);
                      return next;
                    })
                  }
                  title={zenMode ? 'Thoát chế độ tập trung' : 'Chế độ tập trung toàn màn hình'}
                  className={`rounded-lg border p-1.5 transition ${
                    zenMode
                      ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {zenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setShowAssistant((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    showAssistant
                      ? 'border-[#1D4ED8]/30 bg-[#DBEAFE] text-[#1D4ED8]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Gợi ý môn
                </button>
              </div>
            </div>

            {/* Thanh đính kèm Học liệu Media trực quan cho tiết học (YC-051) */}
            {showMediaBar && (
              <div className="space-y-2 border-b border-sky-200 bg-sky-50/50 px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sky-950">Học liệu Media của tiết này:</span>
                  {(activeLesson.mediaItems || []).map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-900"
                    >
                      <a href={m.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {m.title} ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveMediaItem(m.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newMediaKind}
                    onChange={(e) => setNewMediaKind(e.target.value as LessonMediaAttachment['kind'])}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
                  >
                    <option value="VIDEO">Video / YouTube</option>
                    <option value="SLIDE">Slide PowerPoint</option>
                    <option value="AUDIO">Audio / Nhạc</option>
                    <option value="IMAGE">Tranh ảnh</option>
                    <option value="DOC">Tài liệu</option>
                  </select>
                  <input
                    value={newMediaTitle}
                    onChange={(e) => setNewMediaTitle(e.target.value)}
                    placeholder="Tên video / học liệu..."
                    className="w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px]"
                  />
                  <input
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="Dán link YouTube / Google Drive..."
                    className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAttachMediaItem({
                        kind: newMediaKind,
                        title: newMediaTitle,
                        url: newMediaUrl,
                      })
                    }
                    className="rounded-lg bg-[#1D4ED8] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#1E40AF]"
                  >
                    + Đính kèm
                  </button>
                  {mediaSuggestions.slice(0, 4).map((ms) => (
                    <button
                      key={ms.id}
                      type="button"
                      onClick={() =>
                        handleAttachMediaItem({
                          kind: ms.kind === 'ELEARNING' ? 'SLIDE' : ms.kind,
                          title: ms.title,
                          url: ms.url,
                        })
                      }
                      className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-[10px] font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      + [{ms.kind === 'SLIDE' ? 'PPT' : ms.kind === 'VIDEO' ? 'Clip' : ms.kind}] {ms.title.slice(0, 28)}...
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onOpenFullLibrary('media')}
                    className="rounded-lg border border-[#1D4ED8]/30 bg-white px-2.5 py-1 text-[10px] font-bold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                  >
                    Mở Kho PPT / Clip / Ảnh →
                  </button>
                </div>
              </div>
            )}

            {/* Banner nhắc góp ý BGH cho ngày đang mở + nút 1 chạm Báo BGH đã sửa xong (YC-039) */}
            {dayUnresolvedComments.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
                <div className="min-w-0 flex-1">
                  <span className="font-bold">Góp ý BGH cho {activeDay.dayLabel}:</span>{' '}
                  <span>“{dayUnresolvedComments[0].content}”</span>
                  {dayUnresolvedComments.length > 1 && (
                    <span className="ml-1 font-semibold text-amber-800">
                      (+{dayUnresolvedComments.length - 1} góp ý khác)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleMarkDayCommentsFixed}
                  className="shrink-0 rounded-lg bg-blue-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-800"
                >
                  Đã sửa xong – Báo BGH
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden">
              <WordEditor
                planId={activeLessonKey}
                initialHtml={initialLessonHtml}
                onHtmlChange={handleLessonHtmlChange}
                onOutlineChange={() => {}}
                onEditorReady={handleEditorReady}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {activeDay.dayLabel} chưa có tiết học nào.
            </p>
            <button
              onClick={() => setPickerDay({ dayIdx: target.dayIdx, slotType: 'MAIN' })}
              className="mt-3 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              + Thêm tiết chính cho {activeDay.dayLabel}
            </button>
          </div>
        )}
      </main>

      {/* RIGHT ZERO-NOISE SUBJECT-LOCKED ASSISTANT */}
      {showAssistant && activeLesson && target.kind !== 'eval' && target.kind !== 'dayBook' && (
        <div className="fixed inset-y-0 right-0 z-40 w-[340px] shrink-0 bg-white shadow-2xl lg:static lg:z-auto lg:block lg:shadow-none xl:w-[370px]">
          <FocusedAssistant
            plan={plan}
            dataset={dataset}
            subjectCode={activeLesson.subjectCode}
            linkedMtCodes={activeLesson.linkedMtCodes || []}
            templatesRevision={templatesRevision}
            onApplyTemplate={handleApplySavedTemplate}
            onAttachMedia={(item) => {
              handleAttachMediaItem(item);
              setShowMediaBar(true);
            }}
            onInsertHtml={handleInsertHtmlAtCursor}
            onToggleLessonMt={handleToggleLessonMt}
            onOpenFullLibrary={onOpenFullLibrary}
            onClose={() => setShowAssistant(false)}
          />
        </div>
      )}

      {/* Quick Picker when clicking + inside sidebar */}
      {pickerDay && (
        <QuickLessonPickerModal
          dayLabel={plan.days[pickerDay.dayIdx].dayLabel}
          slotType={pickerDay.slotType}
          ageGroupId={plan.ageGroupId}
          themeName={plan.themeName}
          subThemeName={plan.subThemeName}
          weekStartDate={plan.weekStartDate}
          dataset={dataset}
          onSelect={(lesson) => {
            const nextDays = plan.days.map((d, idx) =>
              idx === pickerDay.dayIdx
                ? { ...d, mainLessons: [...d.mainLessons, lesson] }
                : d
            );
            onUpdatePlan(
              { ...plan, days: nextDays },
              `Đã thêm [${lesson.subjectCode}] "${lesson.topicTitle.slice(0, 35)}"!`
            );
            setTarget({ dayIdx: pickerDay.dayIdx, kind: 'main', lessonId: lesson.id });
            setPickerDay(null);
          }}
          onClose={() => setPickerDay(null)}
        />
      )}

      {/* Modal Xuất Sổ Giáo án Ngày theo khoảng Từ ngày – Đến ngày (YC-050) */}
      {showDailyExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-sm font-bold text-slate-900">
                Xuất Sổ Kế hoạch Giáo dục Ngày (.docx)
              </div>
              <button
                onClick={() => setShowDailyExportModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-600">Từ ngày</span>
                  <input
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                  />
                </label>
                <label>
                  <span className="font-semibold text-slate-600">Đến ngày</span>
                  <input
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-600">Định dạng khổ giấy</span>
                  <select
                    value={exportOrientation}
                    onChange={(e) => setExportOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="portrait">Khổ dọc (A4 chuẩn)</option>
                    <option value="landscape">Khổ ngang (A4 rộng)</option>
                  </select>
                </label>
                <label>
                  <span className="font-semibold text-slate-600">Chế độ nối trang</span>
                  <select
                    value={exportContinuous ? 'continuous' : 'pagebreak'}
                    onChange={(e) => setExportContinuous(e.target.value === 'continuous')}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="pagebreak">Ngắt trang từng ngày</option>
                    <option value="continuous">In liên tiếp (tiết kiệm giấy)</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={incGvEval}
                    onChange={(e) => setIncGvEval(e.target.checked)}
                    className="h-4 w-4 accent-[#1D4ED8]"
                  />
                  Lấy mục Đánh giá / Nhận xét &amp; Chỉnh sửa cuối ngày của Giáo viên
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={incChildDailyEval}
                    onChange={(e) => setIncChildDailyEval(e.target.checked)}
                    className="h-4 w-4 accent-[#1D4ED8]"
                  />
                  Lấy thông tin đánh giá / lưu ý cá nhân trẻ hằng ngày
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={incBghCmt}
                    onChange={(e) => setIncBghCmt(e.target.checked)}
                    className="h-4 w-4 accent-[#1D4ED8]"
                  />
                  Lấy cột Nhận xét chuyên môn của Ban Giám hiệu
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={incSign}
                    onChange={(e) => setIncSign(e.target.checked)}
                    className="h-4 w-4 accent-[#1D4ED8]"
                  />
                  Gắn khung Chữ ký xác nhận cuối mỗi ngày
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDailyExportModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={exportingDaily}
                  onClick={handleExportDailyRangeDocx}
                  className="rounded-xl bg-[#1D4ED8] px-4 py-2 font-bold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  {exportingDaily ? 'Đang tạo file...' : 'Tải Sổ Ngày (.docx)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
