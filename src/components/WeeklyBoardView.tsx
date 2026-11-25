import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgeGroupId,
  AnnualPlanDocument,
  DayPlan,
  DomainKey,
  LessonPlan,
  ObjectiveItem,
  ObjectivesDataset,
  WeeklyPlanDocument,
} from '../../shared/types';
import { normalizePlainSuggestion } from '../utils/editorInsert';
import { domainToKey, fmtDateVN, syncWeekDates } from '../utils/helpers';
import { detectSchoolHolidayOrEvent } from '../utils/holidaysVN';
import { buildPedagogicalLessonPlan, lessonPlanToRichHtml, resolveSubjectMeta } from '../utils/subjectTemplates';
import { DOMAIN_VISUALS, getSubjectVisual } from '../utils/visualMeta';
import { QuickLessonPickerModal } from './QuickLessonPickerModal';
import { MtByGradeGuidePanel } from './MtByGradeGuidePanel';
import { AutoFillWeekModal } from './AutoFillWeekModal';
import { StepHintBanner } from './StepHintBanner';

interface Props {
  plan: WeeklyPlanDocument;
  annualPlan?: AnnualPlanDocument | null;
  allPlans?: WeeklyPlanDocument[];
  dataset: ObjectivesDataset;
  onUpdatePlan: (next: WeeklyPlanDocument, toastMsg?: string) => void;
  onSaveAnnualPlan?: (next: AnnualPlanDocument, msg?: string) => void;
  onSwitchGrade: (ageGroupId: AgeGroupId) => void;
  onOpenGuide: () => void;
  onOpenLessonEditor: (dayIndex: number, target: { kind: 'main'; lessonId: string } | { kind: 'afternoon' }) => void;
  onGoToStep: (step: 'board' | 'shared' | 'focus' | 'preview') => void;
}

export const WeeklyBoardView: React.FC<Props> = ({
  plan,
  annualPlan,
  allPlans = [],
  dataset,
  onUpdatePlan,
  onSaveAnnualPlan,
  onSwitchGrade,
  onOpenGuide,
  onOpenLessonEditor,
  onGoToStep,
}) => {
  const [boardMode, setBoardMode] = useState<'week' | 'month'>('week');
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ dayIdx: number; slotType: 'MAIN' | 'AFTERNOON' } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ fromDayIdx: number; lessonId: string } | null>(null);
  const [showMetaEdit, setShowMetaEdit] = useState(false);
  // Mặc định ẩn bảng MT bên trái để Lưới 5 ngày rộng thoáng; mở gọn như ngăn kéo khi cô cần!
  const [showMtGuide, setShowMtGuide] = useState(false);
  const [guideFocusMt, setGuideFocusMt] = useState<string>('');
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [previewLesson, setPreviewLesson] = useState<{ dayIdx: number; lesson: LessonPlan } | null>(null);

  const isNhaTre = plan.ageGroupId === 'NHA_TRE_24_36T';
  const activeDomainVisuals = useMemo(
    () => (isNhaTre ? DOMAIN_VISUALS.filter((d) => d.key !== 'PTTM') : DOMAIN_VISUALS),
    [isNhaTre]
  );

  const ageObjByCode = useMemo(() => {
    const map = new Map<string, ObjectiveItem>();
    dataset.objectives
      .filter((o) => o.ageGroupId === plan.ageGroupId)
      .forEach((o) => map.set(o.code, o));
    (annualPlan?.customObjectives || []).forEach((o) => map.set(o.code, o));
    return map;
  }, [dataset.objectives, plan.ageGroupId, annualPlan?.customObjectives]);

  const matchedAnnualTheme = useMemo(() => {
    if (!annualPlan) return null;
    return (
      annualPlan.themes.find((t) => t.id === plan.annualThemeId) ||
      annualPlan.themes.find(
        (t) => t.themeName.trim().toLowerCase() === plan.themeName.trim().toLowerCase()
      ) ||
      annualPlan.themes[0] ||
      null
    );
  }, [annualPlan, plan.annualThemeId, plan.themeName]);

  // Tính chỉ số tuần trong tháng (0..3) của kế hoạch tuần hiện tại
  const currentMonthWeekIdx = useMemo(() => {
    if (!matchedAnnualTheme) return 0;
    const subIdx = matchedAnnualTheme.subThemes.findIndex(
      (s) => s.trim().toLowerCase() === plan.subThemeName.trim().toLowerCase()
    );
    return subIdx >= 0 ? subIdx : (plan.weekNumber - 1) % Math.max(1, matchedAnnualTheme.totalWeeks);
  }, [matchedAnnualTheme, plan.subThemeName, plan.weekNumber]);

  const getWeekMtAllocation = (wIdx: number): string[] => {
    if (!matchedAnnualTheme) return [];
    const saved = matchedAnnualTheme.weeklyMtAllocation?.[String(wIdx)];
    if (Array.isArray(saved)) return saved;
    // Mặc định chia đều các MT của tháng xuống các tuần nhánh để giáo viên có sẵn gợi ý
    return matchedAnnualTheme.plannedMtCodes.filter(
      (_, i) => i % Math.max(1, matchedAnnualTheme.totalWeeks) === wIdx
    );
  };

  const toggleMonthWeekMt = (wIdx: number, mtCode: string) => {
    if (!annualPlan || !matchedAnnualTheme || !onSaveAnnualPlan) return;
    const nextAlloc: Record<string, string[]> = {};
    for (let i = 0; i < matchedAnnualTheme.totalWeeks; i++) {
      nextAlloc[String(i)] = [...getWeekMtAllocation(i)];
    }
    const cur = nextAlloc[String(wIdx)] || [];
    nextAlloc[String(wIdx)] = cur.includes(mtCode)
      ? cur.filter((c) => c !== mtCode)
      : [...cur, mtCode];

    onSaveAnnualPlan({
      ...annualPlan,
      themes: annualPlan.themes.map((t) =>
        t.id === matchedAnnualTheme.id ? { ...t, weeklyMtAllocation: nextAlloc } : t
      ),
    });
  };

  const handleSyncMonthToCurrentWeek = () => {
    const codes = getWeekMtAllocation(currentMonthWeekIdx);
    const byDomain = new Map<DomainKey, Set<string>>();
    plan.themeObjectives.forEach((b) => byDomain.set(b.domainKey, new Set(b.mtCodes)));
    codes.forEach((c) => {
      const obj = ageObjByCode.get(c);
      if (!obj) return;
      const rawDk = domainToKey(obj.domain);
      const dk: DomainKey = isNhaTre && rawDk === 'PTTM' ? 'PT_TCKNXH' : rawDk;
      if (!byDomain.has(dk)) byDomain.set(dk, new Set());
      byDomain.get(dk)!.add(c);
    });
    const nextBlocks = plan.themeObjectives.map((b) => ({
      ...b,
      mtCodes: Array.from(byDomain.get(b.domainKey) || []),
    }));
    onUpdatePlan(
      { ...plan, themeObjectives: nextBlocks },
      `Đã đồng bộ ${codes.length} mã MT của Nhánh tuần ${currentMonthWeekIdx + 1} từ KHGD Tháng sang KHGD Tuần!`
    );
    setBoardMode('week');
  };

  const otherSameGradePlans = useMemo(
    () => allPlans.filter((p) => p.ageGroupId === plan.ageGroupId && p.id !== plan.id),
    [allPlans, plan.ageGroupId, plan.id]
  );

  const handleCopyFromWeek = (srcPlan: WeeklyPlanDocument) => {
    const copiedDays = plan.days.map((d, idx) => {
      const srcDay = srcPlan.days[idx];
      if (!srcDay || d.isHoliday) return d;
      return {
        ...d,
        outdoorObservation: srcDay.outdoorObservation,
        extracurricularTitle: srcDay.extracurricularTitle,
        mainLessons: srcDay.mainLessons.map((l, lIdx) => ({
          ...JSON.parse(JSON.stringify(l)),
          id: `copy_${Date.now()}_${idx}_${lIdx}`,
        })),
        afternoonLesson: srcDay.afternoonLesson
          ? {
              ...JSON.parse(JSON.stringify(srcDay.afternoonLesson)),
              id: `copy_aft_${Date.now()}_${idx}`,
            }
          : null,
      };
    });
    setShowCopyMenu(false);
    onUpdatePlan(
      { ...plan, days: copiedDays },
      `Đã sao chép khung hoạt động từ Tuần ${srcPlan.weekNumber} (${srcPlan.subThemeName})!`
    );
  };

  const scheduledTopicsSet = useMemo(() => {
    const s = new Set<string>();
    plan.days.forEach((d) => {
      d.mainLessons.forEach((l) => s.add(l.topicTitle.trim().toLowerCase().slice(0, 45)));
      if (d.afternoonLesson) s.add(d.afternoonLesson.topicTitle.trim().toLowerCase().slice(0, 45));
    });
    return s;
  }, [plan.days]);

  const domainAnalysis = useMemo(() => {
    const lessonCounts: Record<DomainKey, number> = {
      PTTC: 0,
      PTNT: 0,
      PTNN: 0,
      PT_TCKNXH: 0,
      PTTM: 0,
    };
    const mtCounts: Record<DomainKey, number> = {
      PTTC: 0,
      PTNT: 0,
      PTNN: 0,
      PT_TCKNXH: 0,
      PTTM: 0,
    };
    for (const blk of plan.themeObjectives) {
      mtCounts[blk.domainKey] = (mtCounts[blk.domainKey] || 0) + blk.mtCodes.length;
    }
    const warnings: string[] = [];
    plan.days.forEach((d) => {
      if (d.isHoliday) return;
      if (d.mainLessons.length === 0) {
        warnings.push(`${d.dayLabel} chưa có tiết chính`);
      } else if (
        d.mainLessons.length >= 2 &&
        d.mainLessons.every((l) => resolveSubjectMeta(l.subjectCode).rhythm === 'CALM')
      ) {
        warnings.push(`${d.dayLabel} có 2 tiết tĩnh liên tiếp`);
      }
      d.mainLessons.forEach((l) => {
        // Ưu tiên tính lĩnh vực theo mã MT thật đã gắn (đồng bộ 100% giữa Bước 1, Bước 2 và Bước 4!)
        const linkedObj = l.linkedMtCodes?.[0] ? ageObjByCode.get(l.linkedMtCodes[0]) : undefined;
        const meta = resolveSubjectMeta(l.subjectCode);
        const rawKey: DomainKey = linkedObj ? domainToKey(linkedObj.domain) : meta.domainKey;
        const effectiveKey: DomainKey = isNhaTre && rawKey === 'PTTM' ? 'PT_TCKNXH' : rawKey;
        lessonCounts[effectiveKey] = (lessonCounts[effectiveKey] || 0) + 1;
      });
    });
    return { lessonCounts, mtCounts, warnings };
  }, [plan, ageObjByCode, isNhaTre]);

  const updateDay = (dayIdx: number, updater: (d: DayPlan) => DayPlan, toast?: string) => {
    const nextDays = plan.days.map((d, i) => (i === dayIdx ? updater(d) : d));
    onUpdatePlan({ ...plan, days: nextDays }, toast);
  };

  const handleAddLesson = (
    dayIdx: number,
    slotType: 'MAIN' | 'AFTERNOON',
    lesson: LessonPlan,
    attachMt?: { domainKey: string; mtCode: string }
  ) => {
    let nextThemeObjs = plan.themeObjectives;
    if (attachMt?.mtCode) {
      nextThemeObjs = plan.themeObjectives.map((blk) => {
        if (blk.domainKey === attachMt.domainKey && !blk.mtCodes.includes(attachMt.mtCode)) {
          return { ...blk, mtCodes: [...blk.mtCodes, attachMt.mtCode] };
        }
        return blk;
      });
    }
    const nextDays = plan.days.map((d, idx) => {
      if (idx !== dayIdx) return d;
      if (slotType === 'MAIN') {
        return { ...d, mainLessons: [...d.mainLessons, lesson] };
      }
      return { ...d, afternoonLesson: lesson };
    });
    onUpdatePlan(
      { ...plan, themeObjectives: nextThemeObjs, days: nextDays },
      `Đã xếp [${lesson.subjectCode}] vào ${plan.days[dayIdx].dayLabel}`
    );
    setPickerTarget(null);
  };

  const handleMoveMainLesson = (fromDayIdx: number, toDayIdx: number, lessonId: string) => {
    if (fromDayIdx === toDayIdx || toDayIdx < 0 || toDayIdx >= plan.days.length) return;
    const moving = plan.days[fromDayIdx].mainLessons.find((l) => l.id === lessonId);
    if (!moving) return;
    const nextDays = plan.days.map((d, idx) => {
      if (idx === fromDayIdx) return { ...d, mainLessons: d.mainLessons.filter((l) => l.id !== lessonId) };
      if (idx === toDayIdx) return { ...d, mainLessons: [...d.mainLessons, moving] };
      return d;
    });
    onUpdatePlan({ ...plan, days: nextDays }, `Đã chuyển sang ${plan.days[toDayIdx].dayLabel}`);
  };

  const handleDeleteMainLesson = (dayIdx: number, lessonId: string) => {
    updateDay(
      dayIdx,
      (d) => ({ ...d, mainLessons: d.mainLessons.filter((l) => l.id !== lessonId) }),
      'Đã gỡ tiết học khỏi lịch tuần'
    );
  };

  const handleToggleMtFromGuide = (domainKey: DomainKey, code: string) => {
    const exists = plan.themeObjectives.some((b) => b.mtCodes.includes(code));
    const nextBlocks = plan.themeObjectives.map((blk) => {
      if (blk.domainKey !== domainKey) return blk;
      return {
        ...blk,
        mtCodes: exists ? blk.mtCodes.filter((c) => c !== code) : [...blk.mtCodes, code],
      };
    });
    onUpdatePlan(
      { ...plan, themeObjectives: nextBlocks },
      exists ? `Đã bỏ ${code}` : `Đã gắn ${code} vào mục tiêu tuần`
    );
  };

  const handleScheduleFromMtGuide = (
    dayIdx: number,
    topic: string,
    subject: string,
    mtCode: string,
    obj: ObjectiveItem
  ) => {
    const built = buildPedagogicalLessonPlan({
      topicTitle: topic,
      subjectCode: subject,
      ageGroupId: plan.ageGroupId,
      slotType: 'MAIN',
      mtCode,
      obj,
    });
    const dk: DomainKey =
      isNhaTre && domainToKey(obj.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(obj.domain);
    handleAddLesson(dayIdx, 'MAIN', built, { domainKey: dk, mtCode });
  };

  const handleAddCornerFromGuide = (cornerSubType: string, topic: string) => {
    const clean = normalizePlainSuggestion(topic);
    if (!clean) return;
    const targetNorm = cornerSubType.toLowerCase();
    let targetIdx = plan.cornerTable.findIndex((c) =>
      c.cornerName.toLowerCase().includes(targetNorm.replace('góc ', '').split(' ')[0])
    );
    if (targetIdx < 0) targetIdx = 0;
    const nextCorners = plan.cornerTable.map((c, idx) => {
      if (idx !== targetIdx) return c;
      const list = c.contents.map(normalizePlainSuggestion).filter(Boolean);
      if (list.some((x) => x.toLowerCase() === clean.toLowerCase())) return c;
      return { ...c, contents: [...list, clean] };
    });
    onUpdatePlan(
      { ...plan, cornerTable: nextCorners },
      `Đã thêm vào ${plan.cornerTable[targetIdx]?.cornerName || 'Bảng 5 Góc'}`
    );
  };

  const handleAddRoutineOrOutdoorFromGuide = (slotType: string, topic: string) => {
    const clean = normalizePlainSuggestion(topic);
    if (!clean) return;
    if (slotType === 'OUTDOOR') {
      const nextOut = plan.outdoorTable.map((r, i) =>
        i === 0 ? { ...r, title: `${normalizePlainSuggestion(r.title)}; ${clean}` } : r
      );
      onUpdatePlan({ ...plan, outdoorTable: nextOut }, 'Đã thêm vào HĐ Ngoài trời tuần');
    } else if (slotType === 'TDS') {
      const list = plan.morningExercise.aims.map(normalizePlainSuggestion).filter(Boolean);
      onUpdatePlan(
        { ...plan, morningExercise: { ...plan.morningExercise, aims: [...list, clean] } },
        'Đã đưa vào Thể dục sáng tuần'
      );
    } else {
      const list = plan.etiquetteNotes.map(normalizePlainSuggestion).filter(Boolean);
      onUpdatePlan({ ...plan, etiquetteNotes: [...list, clean] }, 'Đã thêm vào Lễ giáo tuần');
    }
  };

  const ageMeta = dataset.ageGroups.find((g) => g.id === plan.ageGroupId);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-[#F6F8F7]">
      {/* MAIN SPACIOUS 5-DAY TIMETABLE AREA */}
      <div className="flex-1 overflow-y-auto px-5 py-4 lg:px-7 lg:py-5">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {/* Calm 1-line Contextual Onboarding Hint */}
          <StepHintBanner
            storageKey="step2_board_v2"
            text="Bước 2: Phân bổ MT ở KHGD Tháng rồi xếp tiết học Thứ Hai → Thứ Sáu. Cô có thể bấm “Gợi ý theo Mục tiêu”, “Tự động xếp lịch” hoặc “+ Thêm tiết” trên từng ngày."
            onOpenGuide={onOpenGuide}
          />

          {/* Clean, Airy Plan Summary Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1.5 inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBoardMode('week')}
                    className={`rounded-lg px-3 py-1 transition ${
                      boardMode === 'week'
                        ? 'bg-[#0B6E5C] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    KHGD Tuần (Thứ 2 → Thứ 6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardMode('month')}
                    className={`rounded-lg px-3 py-1 transition ${
                      boardMode === 'month'
                        ? 'bg-[#0B6E5C] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    KHGD Tháng ({matchedAnnualTheme?.monthLabel || 'Phân bổ Tuần 1..4'})
                  </button>
                </div>
                <h1 className="text-lg font-bold text-slate-900">
                  Tuần {plan.weekNumber}: {plan.subThemeName}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {ageMeta?.name} · Lớp {plan.className} · {fmtDateVN(plan.weekStartDate)} – {fmtDateVN(plan.weekEndDate)} · GV: {plan.teacherName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {boardMode === 'month' ? (
                  <button
                    type="button"
                    onClick={handleSyncMonthToCurrentWeek}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ sang KHGD Tuần {plan.weekNumber}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowMtGuide((v) => !v)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                        showMtGuide
                          ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                          : 'border-[#0B6E5C]/35 bg-[#E6F4F1] text-[#0B6E5C] hover:bg-emerald-100'
                      }`}
                    >
                      {showMtGuide ? 'Đóng gợi ý Mục tiêu' : `Gợi ý theo Mục tiêu (${ageMeta?.short})`}
                    </button>
                    <button
                      onClick={() => setShowAutoFill(true)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-[#0B6E5C] hover:text-[#0B6E5C]"
                    >
                      Tự động xếp lịch
                    </button>
                    {otherSameGradePlans.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCopyMenu((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5 text-slate-400" /> Copy từ tuần khác
                        </button>
                        {showCopyMenu && (
                          <div className="absolute right-0 top-10 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                              Chọn tuần nguồn cùng khối:
                            </div>
                            {otherSameGradePlans.map((sp) => (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => handleCopyFromWeek(sp)}
                                className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-[#E6F4F1] hover:text-[#0B6E5C]"
                              >
                                Tuần {sp.weekNumber}: {sp.subThemeName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => setShowMetaEdit((v) => !v)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {showMetaEdit ? 'Đóng sửa bìa' : 'Sửa bìa & ngày'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline Cover & Date Editor (hidden until clicked) */}
            {showMetaEdit && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs">
                  <span className="font-semibold text-slate-600">Chủ đề lớn</span>
                  <input
                    value={plan.themeName}
                    onChange={(e) => onUpdatePlan({ ...plan, themeName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0B6E5C] focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold text-slate-600">Chủ đề nhánh tuần</span>
                  <input
                    value={plan.subThemeName}
                    onChange={(e) => onUpdatePlan({ ...plan, subThemeName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0B6E5C] focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold text-slate-600">Ngày Thứ Hai đầu tuần</span>
                  <input
                    type="date"
                    value={plan.weekStartDate}
                    onChange={(e) =>
                      onUpdatePlan(syncWeekDates(plan, e.target.value), 'Đã đồng bộ ngày Thứ 2 → Thứ 6')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0B6E5C] focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold text-slate-600">Lớp &amp; Giáo viên</span>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      value={plan.className}
                      onChange={(e) => onUpdatePlan({ ...plan, className: e.target.value })}
                      className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      value={plan.teacherName}
                      onChange={(e) => onUpdatePlan({ ...plan, teacherName: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2 lg:col-span-4">
                  <input
                    type="checkbox"
                    checked={plan.includeThemeSection}
                    onChange={(e) => onUpdatePlan({ ...plan, includeThemeSection: e.target.checked })}
                    className="h-4 w-4 accent-[#0B6E5C]"
                  />
                  Kèm phần Kế hoạch Chủ đề (chỉ cần bật ở Tuần 1 của mỗi chủ đề)
                </label>
              </div>
            )}

            {/* Calm, Low-Noise Domain Balance Line */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {activeDomainVisuals.map((dv) => {
                  const lCount =
                    isNhaTre && dv.key === 'PT_TCKNXH'
                      ? (domainAnalysis.lessonCounts.PT_TCKNXH || 0) + (domainAnalysis.lessonCounts.PTTM || 0)
                      : domainAnalysis.lessonCounts[dv.key] || 0;
                  const lbl = isNhaTre && dv.key === 'PT_TCKNXH' ? 'TC–KNXH & TM' : dv.short;
                  return (
                    <span key={dv.key} className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${dv.dotClass}`} />
                      <span>{lbl}:</span>
                      <strong className="text-slate-900">{lCount}</strong>
                    </span>
                  );
                })}
              </div>

              {domainAnalysis.warnings.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> {domainAnalysis.warnings[0]}
                </span>
              )}
            </div>

            {/* HỘP CẢNH BÁO ĐỎ KIỂU GOKIDS (YC-037): Mục tiêu Đánh giá (★) của tháng chưa gắn vào tiết học trong các tuần của tháng */}
            {(() => {
              if (!annualPlan) return null;
              const matchedTheme =
                annualPlan.themes.find((t) => t.id === plan.annualThemeId) ||
                annualPlan.themes.find(
                  (t) => t.themeName.trim().toLowerCase() === plan.themeName.trim().toLowerCase()
                );
              const starCodes = matchedTheme?.assessmentMtCodes || [];
              if (starCodes.length === 0) return null;

              const taughtInThemePlans = new Set<string>();
              const themePlans = [
                plan,
                ...allPlans.filter(
                  (p) =>
                    p.id !== plan.id &&
                    p.ageGroupId === plan.ageGroupId &&
                    (p.annualThemeId === matchedTheme?.id ||
                      p.themeName.trim().toLowerCase() === matchedTheme?.themeName.trim().toLowerCase())
                ),
              ];
              themePlans.forEach((tp) => {
                tp.days.forEach((d) => {
                  if (d.isHoliday) return;
                  d.mainLessons.forEach((l) => l.linkedMtCodes.forEach((c) => taughtInThemePlans.add(c)));
                  d.afternoonLesson?.linkedMtCodes.forEach((c) => taughtInThemePlans.add(c));
                });
              });
              const missingStars = starCodes.filter((c) => !taughtInThemePlans.has(c));
              if (missingStars.length === 0) return null;

              return (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs text-rose-900">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">★ Mục tiêu đánh giá của {matchedTheme?.monthLabel} chưa gắn tiết dạy:</span>
                    {missingStars.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setGuideFocusMt(code);
                          setShowMtGuide(true);
                        }}
                        title={`Bấm để lọc ngay ${code} và xếp tiết dạy 1 chạm`}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-600 hover:text-white"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGuideFocusMt('');
                      setShowMtGuide(true);
                    }}
                    className="text-[11px] font-bold text-rose-700 hover:underline"
                  >
                    Mở gợi ý xếp tiết →
                  </button>
                </div>
              );
            })()}
          </div>

          {/* CHẾ ĐỘ BẢNG KHGD THÁNG — PHÂN BỔ MT THÁNG XUỐNG TUẦN 1..4 (YC-047) */}
          {boardMode === 'month' && matchedAnnualTheme ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Kế hoạch Giáo dục {matchedAnnualTheme.monthLabel} — Chủ đề: {matchedAnnualTheme.themeName}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tick chọn tuần thực hiện cho từng Mã MT trong tháng (cột đang tô xanh là{' '}
                    <strong>Nhánh tuần {currentMonthWeekIdx + 1}: {plan.subThemeName}</strong>), sau đó bấm{' '}
                    <strong>“Đồng bộ sang KHGD Tuần {plan.weekNumber}”</strong>.
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#0B6E5C] text-white">
                      <th className="w-20 border-r border-emerald-700/50 px-3 py-2.5 text-center font-bold">
                        Mã MT
                      </th>
                      <th className="border-r border-emerald-700/50 px-3 py-2.5 font-bold">
                        Mục tiêu &amp; Nội dung giáo dục trong {matchedAnnualTheme.monthLabel}
                      </th>
                      {Array.from({ length: matchedAnnualTheme.totalWeeks }).map((_, wIdx) => (
                        <th
                          key={wIdx}
                          className={`w-28 border-r border-emerald-700/50 px-2.5 py-2 text-center font-bold last:border-r-0 ${
                            wIdx === currentMonthWeekIdx ? 'bg-emerald-900/60' : ''
                          }`}
                        >
                          <div>Tuần {wIdx + 1}</div>
                          <div className="mt-0.5 truncate text-[10px] font-normal text-emerald-100">
                            {matchedAnnualTheme.subThemes[wIdx] || ''}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {matchedAnnualTheme.plannedMtCodes.map((code) => {
                      const obj = ageObjByCode.get(code);
                      const isStar = (matchedAnnualTheme.assessmentMtCodes || []).includes(code);
                      return (
                        <tr key={code} className="hover:bg-slate-50/70">
                          <td className="border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#0B6E5C]">
                            <div>{code}</div>
                            {isStar && (
                              <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                                ★ Đánh giá
                              </span>
                            )}
                          </td>
                          <td className="border-r border-slate-100 px-3 py-2.5">
                            <div className="font-semibold text-slate-900">
                              {obj?.description || `Mục tiêu ${code}`}
                            </div>
                            {obj?.eduContent && (
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                Nội dung: {obj.eduContent}
                              </div>
                            )}
                          </td>
                          {Array.from({ length: matchedAnnualTheme.totalWeeks }).map((_, wIdx) => {
                            const checked = getWeekMtAllocation(wIdx).includes(code);
                            const isCurCol = wIdx === currentMonthWeekIdx;
                            return (
                              <td
                                key={wIdx}
                                className={`border-r border-slate-100 p-2 text-center last:border-r-0 ${
                                  isCurCol ? 'bg-emerald-50/40' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleMonthWeekMt(wIdx, code)}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border font-bold transition ${
                                    checked
                                      ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                                      : 'border-slate-300 bg-white text-transparent hover:border-[#0B6E5C]'
                                  }`}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <>
          {/* EMPTY-WEEK 1-CLICK QUICK-START CARD */}
          {plan.days.every((d) => d.mainLessons.length === 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-[#F2F9F7] px-5 py-3.5">
              <div>
                <div className="text-sm font-bold text-[#074F42]">
                  Tuần mới chưa có tiết học — bắt đầu nhanh trong 1 chạm
                </div>
                <p className="mt-0.5 text-xs text-[#0B6E5C]">
                  Hệ thống sẽ tự chọn bộ tiết học cân đối {isNhaTre ? '4' : '5'} lĩnh vực khớp chủ đề <strong>{plan.subThemeName}</strong> từ kho dữ liệu thật, cô có thể đổi từng bài sau.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAutoFill(true)}
                  className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#085A4B]"
                >
                  Tự động xếp lịch theo Chủ đề
                </button>
                <button
                  onClick={() => setShowMtGuide(true)}
                  className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B6E5C] hover:bg-emerald-50"
                >
                  Tự chọn theo Mục tiêu
                </button>
              </div>
            </div>
          )}

          {/* SPACIOUS 5-COLUMN TIMETABLE */}
          <div
            className={`grid grid-cols-1 gap-3.5 md:grid-cols-2 ${
              showMtGuide ? 'xl:grid-cols-3' : 'xl:grid-cols-5'
            }`}
          >
            {plan.days.map((day, dayIdx) => {
              const autoMarker = detectSchoolHolidayOrEvent(day.dateStr);
              const holidayLabel = day.isHoliday
                ? day.holidayName || autoMarker?.label || 'Nghỉ Lễ'
                : autoMarker?.label || '';
              return (
              <div
                key={day.dayOfWeek}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragInfo && !day.isHoliday) {
                    handleMoveMainLesson(dragInfo.fromDayIdx, dayIdx, dragInfo.lessonId);
                    setDragInfo(null);
                  }
                }}
                className={`flex flex-col rounded-2xl border ${
                  day.isHoliday ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200/90 bg-white'
                }`}
              >
                {/* Clean Day Header + Optional Holiday Toggle */}
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-slate-900">{day.dayLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{fmtDateVN(day.dateStr).slice(0, 5)}</span>
                      <button
                        onClick={() =>
                          updateDay(
                            dayIdx,
                            (d) => ({
                              ...d,
                              isHoliday: !d.isHoliday,
                              holidayName: !d.isHoliday
                                ? d.holidayName || autoMarker?.label || 'Nghỉ Lễ / Sự kiện trường'
                                : undefined,
                            }),
                            day.isHoliday ? `Đã mở lại lịch học ${day.dayLabel}` : `Đã đánh dấu ${day.dayLabel} là ngày nghỉ Lễ`
                          )
                        }
                        title="Đánh dấu / Bỏ đánh dấu ngày nghỉ Lễ (không bắt buộc xếp tiết chính)"
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                          day.isHoliday
                            ? 'bg-amber-200 text-amber-950'
                            : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                      >
                        {day.isHoliday ? 'Nghỉ Lễ ✓' : 'Nghỉ?'}
                      </button>
                    </div>
                  </div>
                  {holidayLabel && (
                    <div className="mt-1 rounded-md bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      {holidayLabel}
                    </div>
                  )}
                </div>

                {day.isHoliday ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
                    <div className="text-xs font-bold text-amber-900">
                      {day.holidayName || 'Ngày nghỉ Lễ / Nghỉ bù'}
                    </div>
                    <p className="mt-1 text-[11px] text-amber-700">
                      Trẻ nghỉ học theo quy định — hệ thống tự miễn kiểm tra tiết học cho ngày này.
                    </p>
                  </div>
                ) : (
                <div className="flex flex-1 flex-col gap-3 p-3.5">
                  {/* MAIN LESSONS — Clean white cards, clear 13px text, hover-only utility icons */}
                  <div className="space-y-2.5">
                    {day.mainLessons.map((les) => {
                      const sv = getSubjectVisual(les.subjectCode);
                      return (
                        <div
                          key={les.id}
                          draggable
                          onDragStart={() => setDragInfo({ fromDayIdx: dayIdx, lessonId: les.id })}
                          className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-[#0B6E5C]/60 hover:shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${sv.chipClass}`}>
                                {les.subjectCode}
                              </span>
                              {les.linkedMtCodes?.[0] && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {les.linkedMtCodes[0]}
                                </span>
                              )}
                            </div>

                            {/* Secondary actions appear ONLY on hover to keep the board spotless */}
                            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                              <button
                                onClick={() => setPreviewLesson({ dayIdx, lesson: les })}
                                title="Xem nhanh"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {dayIdx > 0 && (
                                <button
                                  onClick={() => handleMoveMainLesson(dayIdx, dayIdx - 1, les.id)}
                                  title="Chuyển sang ngày trước"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {dayIdx < plan.days.length - 1 && (
                                <button
                                  onClick={() => handleMoveMainLesson(dayIdx, dayIdx + 1, les.id)}
                                  title="Chuyển sang ngày sau"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMainLesson(dayIdx, les.id)}
                                title="Xóa tiết"
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <p
                            title={les.topicTitle}
                            className="mt-2 line-clamp-3 text-[13px] leading-snug font-semibold text-slate-900"
                          >
                            {les.topicTitle}
                          </p>

                          <div className="mt-2.5 flex justify-end">
                            <button
                              onClick={() => onOpenLessonEditor(dayIdx, { kind: 'main', lessonId: les.id })}
                              className="text-xs font-semibold text-[#0B6E5C] hover:underline"
                            >
                              Soạn bài →
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => setPickerTarget({ dayIdx, slotType: 'MAIN' })}
                      className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0B6E5C] hover:bg-[#F2F9F7] hover:text-[#0B6E5C]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm tiết
                    </button>
                  </div>

                  {/* Calm Outdoor & Afternoon Sections */}
                  <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-3">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">Ngoài trời</div>
                      <textarea
                        rows={2}
                        value={day.outdoorObservation}
                        onChange={(e) =>
                          updateDay(dayIdx, (d) => ({ ...d, outdoorObservation: e.target.value }))
                        }
                        placeholder="Nội dung quan sát..."
                        className="mt-1 w-full resize-none rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-1.5 text-xs leading-snug text-slate-700 focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">Hoạt động chiều</div>
                      {day.afternoonLesson ? (
                        <div className="group mt-1 rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-medium text-slate-800">
                              {day.afternoonLesson.topicTitle}
                            </span>
                            <button
                              onClick={() => updateDay(dayIdx, (d) => ({ ...d, afternoonLesson: null }), 'Đã xóa HĐ chiều')}
                              className="opacity-0 text-slate-400 hover:text-rose-600 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => onOpenLessonEditor(dayIdx, { kind: 'afternoon' })}
                            className="mt-1.5 text-[11px] font-semibold text-[#0B6E5C] hover:underline"
                          >
                            Soạn chiều →
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickerTarget({ dayIdx, slotType: 'AFTERNOON' })}
                          className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs font-medium text-slate-400 hover:border-[#0B6E5C] hover:text-[#0B6E5C]"
                        >
                          + Thêm HĐ chiều
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </div>
              );
            })}
          </div>

          {/* Simple Next-Step Footer */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => onGoToStep('shared')}
              className="rounded-xl bg-[#0B6E5C] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#085A4B]"
            >
              Tiếp tục: Bước 3 – Hoạt động cả tuần →
            </button>
          </div>
          </>
          )}
        </div>
      </div>

      {/* NON-DIMMED SIDE-BY-SIDE SPLIT PANE ON DESKTOP (DRAWER ONLY ON MOBILE/TABLET) */}
      {showMtGuide && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/25 lg:static lg:z-auto lg:w-[410px] lg:shrink-0 lg:bg-transparent">
          <div className="h-full w-full max-w-[430px] shadow-2xl lg:max-w-none lg:shadow-none">
            <MtByGradeGuidePanel
              plan={plan}
              dataset={dataset}
              focusMtCode={guideFocusMt}
              onToggleMt={handleToggleMtFromGuide}
              onScheduleLessonToDay={handleScheduleFromMtGuide}
              onAddCornerIdea={handleAddCornerFromGuide}
              onAddRoutineOrOutdoor={handleAddRoutineOrOutdoorFromGuide}
              onSwitchGrade={onSwitchGrade}
              onClose={() => {
                setGuideFocusMt('');
                setShowMtGuide(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {pickerTarget && (
        <QuickLessonPickerModal
          dayLabel={plan.days[pickerTarget.dayIdx].dayLabel}
          slotType={pickerTarget.slotType}
          ageGroupId={plan.ageGroupId}
          themeName={plan.themeName}
          subThemeName={plan.subThemeName}
          weekStartDate={plan.weekStartDate}
          monthPlannedMtCodes={matchedAnnualTheme?.plannedMtCodes}
          scheduledTopics={scheduledTopicsSet}
          dataset={dataset}
          onSelect={(lesson, attachMt) =>
            handleAddLesson(pickerTarget.dayIdx, pickerTarget.slotType, lesson, attachMt)
          }
          onClose={() => setPickerTarget(null)}
        />
      )}

      {showAutoFill && (
        <AutoFillWeekModal
          plan={plan}
          dataset={dataset}
          timetable={annualPlan?.timetable}
          onApply={(nextPlan, msg) => {
            onUpdatePlan(nextPlan, msg);
            setShowAutoFill(false);
          }}
          onClose={() => setShowAutoFill(false)}
        />
      )}

      {previewLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs font-semibold text-[#0B6E5C]">
                  {plan.days[previewLesson.dayIdx]?.dayLabel} · {previewLesson.lesson.subjectCode}
                </div>
                <div className="text-base font-bold text-slate-900">{previewLesson.lesson.topicTitle}</div>
              </div>
              <button onClick={() => setPreviewLesson(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 text-[14px] leading-relaxed text-slate-900 [&_h3]:mb-1 [&_h3]:text-center [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#0B6E5C] [&_p]:my-1.5 [&_ul]:ml-5 [&_ul]:list-disc"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              dangerouslySetInnerHTML={{ __html: lessonPlanToRichHtml(previewLesson.lesson) }}
            />
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                onClick={() => setPreviewLesson(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  const t = previewLesson;
                  setPreviewLesson(null);
                  onOpenLessonEditor(t.dayIdx, { kind: 'main', lessonId: t.lesson.id });
                }}
                className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#085A4B]"
              >
                Mở soạn trên Word →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
