import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Plus,
  Sparkles,
  Star,
  Table2,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AgeGroupId,
  AnnualPlanDocument,
  ObjectiveItem,
  ObjectivesDataset,
  ThemeMonthAllocation,
  WeeklyPlanDocument,
  WeeklyTimetableTemplate,
} from '../../shared/types';
import { buildDefaultTimetable } from '../../shared/annualCurriculum';
import { addDaysISO, createBlankPlan, domainToKey, fmtDateVN } from '../utils/helpers';
import { detectSchoolHolidayOrEvent } from '../utils/holidaysVN';

const DAY_HEADERS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

function getTimetableSubjectsForGrade(ageGroupId: AgeGroupId): string[] {
  if (ageGroupId === 'NHA_TRE_24_36T') {
    return ['PTVĐ', 'NBTN', 'GDAN', 'LQVH', 'Tạo hình', 'KNS'];
  }
  if (ageGroupId === 'LA_5_6T') {
    return ['PTVĐ', 'MTXQ', 'LQVT', 'LQVH', 'LQCC', 'GDAN', 'Tạo hình', 'KNS'];
  }
  return ['PTVĐ', 'MTXQ', 'LQVT', 'LQVH', 'GDAN', 'Tạo hình', 'KNS'];
}

interface Props {
  annualPlan: AnnualPlanDocument;
  allPlans: WeeklyPlanDocument[];
  dataset: ObjectivesDataset;
  onSwitchGrade: (ageGroupId: AgeGroupId) => void;
  onSaveAnnualPlan: (next: AnnualPlanDocument, msg?: string) => void;
  onCreateOrOpenWeek: (plan: WeeklyPlanDocument, isExisting: boolean) => void;
}

const STATUS_BADGE: Record<WeeklyPlanDocument['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-600' },
  PENDING_REVIEW: { label: 'Chờ BGH duyệt', cls: 'bg-amber-100 text-amber-800' },
  NEEDS_REVISION: { label: 'Cần sửa lại', cls: 'bg-rose-100 text-rose-800' },
  APPROVED: { label: 'Đã ký duyệt ✓', cls: 'bg-emerald-100 text-emerald-800' },
};

export const AnnualCurriculumView: React.FC<Props> = ({
  annualPlan,
  allPlans,
  dataset,
  onSwitchGrade,
  onSaveAnnualPlan,
  onCreateOrOpenWeek,
}) => {
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showTimetablePanel, setShowTimetablePanel] = useState(false);
  const [showYearOverview, setShowYearOverview] = useState(false);
  const [showCustomMtForm, setShowCustomMtForm] = useState(false);
  const [customMtDesc, setCustomMtDesc] = useState('');
  const [customMtDomain, setCustomMtDomain] = useState('I. Giáo dục phát triển thể chất');
  const [customMtMonthId, setCustomMtMonthId] = useState<string>(annualPlan.themes[0]?.id || '');
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [showUntaughtModal, setShowUntaughtModal] = useState(false);
  const [expandedThemeId, setExpandedThemeId] = useState<string>(annualPlan.themes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'Nam' | 'Nữ'>('Nữ');

  const activeTimetable: WeeklyTimetableTemplate = useMemo(
    () => annualPlan.timetable || buildDefaultTimetable(annualPlan.ageGroupId),
    [annualPlan.timetable, annualPlan.ageGroupId]
  );

  const toggleTimetableSubject = (weekKind: 'oddWeek' | 'evenWeek', dayIdx: number, subj: string) => {
    const nextRows = activeTimetable[weekKind].map((arr, idx) => {
      if (idx !== dayIdx) return arr;
      return arr.includes(subj) ? arr.filter((s) => s !== subj) : [...arr, subj];
    });
    onSaveAnnualPlan({
      ...annualPlan,
      timetable: { ...activeTimetable, [weekKind]: nextRows },
    });
  };

  const handleBulkPasteStudents = () => {
    const lines = bulkPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const added = lines.map((line, i) => {
      const cols = line.split(/\t|[,;|]/).map((c) => c.trim()).filter(Boolean);
      const fullName = cols[0] || line;
      const genderCol = cols.find((c) => /^(nam|nữ|nu)$/i.test(c));
      const dobCol = cols.find((c) => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(c));
      return {
        id: `stu_bulk_${Date.now()}_${i}`,
        fullName,
        gender: (genderCol && /nam/i.test(genderCol) ? 'Nam' : 'Nữ') as 'Nam' | 'Nữ',
        dob: dobCol || undefined,
      };
    });
    onSaveAnnualPlan(
      {
        ...annualPlan,
        profile: {
          ...annualPlan.profile,
          students: [...annualPlan.profile.students, ...added],
        },
      },
      `Đã nhập nhanh ${added.length} bé từ danh sách dán vào!`
    );
    setBulkPasteText('');
    setShowBulkPaste(false);
  };

  const toggleAssessmentStar = (themeId: string, code: string) => {
    onSaveAnnualPlan({
      ...annualPlan,
      themes: annualPlan.themes.map((t) => {
        if (t.id !== themeId) return t;
        const cur = t.assessmentMtCodes || [];
        const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
        return { ...t, assessmentMtCodes: next };
      }),
    });
  };

  const customObjectives = annualPlan.customObjectives || [];
  const customCodesSet = useMemo(
    () => new Set(customObjectives.map((o) => o.code)),
    [customObjectives]
  );

  const gradeObjectives = useMemo(
    () => [
      ...dataset.objectives.filter(
        (o) => o.ageGroupId === annualPlan.ageGroupId && !customCodesSet.has(o.code)
      ),
      ...customObjectives,
    ],
    [dataset.objectives, annualPlan.ageGroupId, customObjectives, customCodesSet]
  );

  const handleAddCustomObjective = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = customMtDesc.trim();
    if (!desc) return;
    const maxNum = gradeObjectives.reduce((mx, o) => {
      const n = parseInt(o.code.replace(/\D/g, ''), 10) || 0;
      return n > mx ? n : mx;
    }, 0);
    const nextCode = `MT${maxNum + 1}`;
    const targetTheme =
      annualPlan.themes.find((t) => t.id === customMtMonthId) || annualPlan.themes[0];
    const newObj: ObjectiveItem = {
      id: `custom_${annualPlan.ageGroupId}_${Date.now()}`,
      ageGroupId: annualPlan.ageGroupId,
      ageGroupName:
        dataset.ageGroups.find((g) => g.id === annualPlan.ageGroupId)?.name || '',
      code: nextCode,
      domain: customMtDomain,
      subGroup: 'Mục tiêu phát triển mở rộng của lớp',
      description: desc,
      month: targetTheme?.monthLabel || 'Tháng 9',
      theme: targetTheme?.themeName || '',
      source: 'Mục tiêu phát triển mở rộng',
      eduContent: desc,
      activities: [],
    };
    onSaveAnnualPlan(
      {
        ...annualPlan,
        customObjectives: [...customObjectives, newObj],
        themes: annualPlan.themes.map((t) =>
          t.id === targetTheme?.id
            ? {
                ...t,
                plannedMtCodes: [...t.plannedMtCodes, nextCode],
                assessmentMtCodes: [...(t.assessmentMtCodes || []), nextCode],
              }
            : t
        ),
      },
      `Đã phát triển thêm ${nextCode} vào ${targetTheme?.monthLabel}!`
    );
    setCustomMtDesc('');
    setShowCustomMtForm(false);
  };

  // Các tháng chưa chọn bất kỳ Ngôi sao Đánh giá ★ nào (Cảnh báo vàng YC-046)
  const monthsMissingStars = useMemo(
    () => annualPlan.themes.filter((t) => (t.assessmentMtCodes || []).length === 0),
    [annualPlan.themes]
  );

  const objByCode = useMemo(
    () => new Map(gradeObjectives.map((o) => [o.code, o])),
    [gradeObjectives]
  );

  const gradePlans = useMemo(
    () => allPlans.filter((p) => p.ageGroupId === annualPlan.ageGroupId),
    [allPlans, annualPlan.ageGroupId]
  );

  // Tập hợp tất cả các mã MT đã được đưa vào ít nhất 1 Kế hoạch Tuần của khối/lớp này trong năm
  const taughtMtCodes = useMemo(() => {
    const s = new Set<string>();
    for (const p of gradePlans) {
      p.themeObjectives.forEach((b) => b.mtCodes.forEach((c) => s.add(c)));
      p.days.forEach((d) => {
        d.mainLessons.forEach((l) => l.linkedMtCodes.forEach((c) => s.add(c)));
        if (d.afternoonLesson) d.afternoonLesson.linkedMtCodes.forEach((c) => s.add(c));
      });
    }
    return s;
  }, [gradePlans]);

  const plannedMtSet = useMemo(() => {
    const s = new Set<string>();
    annualPlan.themes.forEach((t) => t.plannedMtCodes.forEach((c) => s.add(c)));
    return s;
  }, [annualPlan.themes]);

  const untaughtObjectives = useMemo(
    () => gradeObjectives.filter((o) => !taughtMtCodes.has(o.code)),
    [gradeObjectives, taughtMtCodes]
  );

  // Tính số thứ tự tuần tích lũy từ đầu năm học (Tuần 1 -> Tuần 34/35)
  const cumulativeWeekOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const th of annualPlan.themes) {
      offsets.push(acc);
      acc += th.totalWeeks;
    }
    return offsets;
  }, [annualPlan.themes]);

  const findExistingWeekPlan = (theme: ThemeMonthAllocation, subIdx: number, cumWeekNum: number) => {
    const subTitle = (theme.subThemes[subIdx] || '').trim().toLowerCase();
    return gradePlans.find(
      (p) =>
        (p.annualThemeId === theme.id && p.weekNumber === cumWeekNum) ||
        (subTitle && p.subThemeName.trim().toLowerCase() === subTitle) ||
        (p.weekStartDate === addDaysISO(theme.startDate, subIdx * 7))
    );
  };

  const handleInitWeekFromTheme = (theme: ThemeMonthAllocation, subIdx: number, cumWeekNum: number) => {
    const existing = findExistingWeekPlan(theme, subIdx, cumWeekNum);
    if (existing) {
      onCreateOrOpenWeek(existing, true);
      return;
    }

    const mondayIso = addDaysISO(theme.startDate, subIdx * 7);
    const subThemeName = theme.subThemes[subIdx] || `${theme.themeName} – Nhánh ${subIdx + 1}`;
    const prof = annualPlan.profile;
    const isNhaTre = annualPlan.ageGroupId === 'NHA_TRE_24_36T';

    const blank = createBlankPlan({
      ageGroupId: annualPlan.ageGroupId,
      className: prof.className,
      teacherName: prof.teacherName,
      schoolName: prof.schoolName,
      governingBody: prof.governingBody,
      principalName: prof.principalName,
      themeName: theme.themeName,
      subThemeName,
      weekNumber: cumWeekNum,
      weekStartDate: mondayIso,
    });

    // Phân bổ các mã MT của Chủ đề tháng này vào đúng từng lĩnh vực phát triển!
    // Ưu tiên rải đều theo tuần nhánh nhưng vẫn gắn đầy đủ mục tiêu chủ đề cho Tuần đầu chủ đề
    const chunkSize = Math.max(3, Math.ceil(theme.plannedMtCodes.length / Math.max(1, theme.totalWeeks)));
    const sliceStart = subIdx * chunkSize;
    const weekMtSlice =
      subIdx === 0
        ? theme.plannedMtCodes
        : theme.plannedMtCodes.slice(sliceStart, sliceStart + chunkSize).length > 0
        ? theme.plannedMtCodes.slice(sliceStart, sliceStart + chunkSize)
        : theme.plannedMtCodes.slice(0, 5);

    const mtByDom = new Map<string, Set<string>>();
    blank.themeObjectives.forEach((b) => mtByDom.set(b.domainKey, new Set()));

    for (const code of weekMtSlice) {
      const obj = objByCode.get(code);
      if (!obj) continue;
      const rawDk = domainToKey(obj.domain);
      const dk = isNhaTre && rawDk === 'PTTM' ? 'PT_TCKNXH' : rawDk;
      if (!mtByDom.has(dk)) mtByDom.set(dk, new Set());
      mtByDom.get(dk)!.add(code);
    }

    // Đảm bảo có ít nhất MT1 nếu hoàn toàn rỗng
    const updatedThemeObjectives = blank.themeObjectives.map((b) => ({
      ...b,
      mtCodes: Array.from(mtByDom.get(b.domainKey) || []),
    }));

    // Kế thừa toàn bộ Mạng Nội dung các nhánh tuần của Chủ đề tháng này!
    const inheritedNetwork = theme.subThemes.map((st, idx) => ({
      id: `br_${theme.id}_${idx + 1}`,
      branchTitle: `Tuần ${cumWeekNum - subIdx + idx}: ${st}`,
      items: [
        `Khám phá kiến thức, kỹ năng trọng tâm nhánh “${st}”`,
        `Hoạt động văn học, tạo hình, âm nhạc và vui chơi góc gắn với “${st}”`,
      ],
    }));

    // Tự động đánh dấu ngày nghỉ Lễ chính thức nếu tuần này trùng dịp Lễ
    const updatedDays = blank.days.map((d) => {
      const marker = detectSchoolHolidayOrEvent(d.dateStr);
      if (marker?.isDayOff) {
        return {
          ...d,
          isHoliday: true,
          holidayName: marker.label,
          outdoorObservation: `${marker.label} — Nghỉ theo quy định nhà nước.`,
        };
      }
      if (marker && !marker.isDayOff) {
        return {
          ...d,
          holidayName: marker.label,
          outdoorObservation: `Hoạt động chào mừng ${marker.label} & trò chuyện chủ đề “${subThemeName}”.`,
        };
      }
      return d;
    });

    const linkedPlan: WeeklyPlanDocument = {
      ...blank,
      annualThemeId: theme.id,
      includeThemeSection: subIdx === 0,
      themeTotalWeeks: theme.totalWeeks,
      themeStartDate: theme.startDate,
      themeEndDate: addDaysISO(theme.startDate, theme.totalWeeks * 7 - 3),
      themeObjectives: updatedThemeObjectives,
      contentNetwork: inheritedNetwork,
      days: updatedDays,
    };

    onCreateOrOpenWeek(linkedPlan, false);
  };

  const updateProfileField = (field: keyof AnnualPlanDocument['profile'], value: string) => {
    onSaveAnnualPlan({
      ...annualPlan,
      profile: { ...annualPlan.profile, [field]: value },
    });
  };

  const handleAddStudent = () => {
    const clean = newStudentName.trim();
    if (!clean) return;
    const nextStudents = [
      ...annualPlan.profile.students,
      {
        id: `stu_${Date.now()}`,
        fullName: clean,
        gender: newStudentGender,
      },
    ];
    onSaveAnnualPlan(
      { ...annualPlan, profile: { ...annualPlan.profile, students: nextStudents } },
      `Đã thêm bé "${clean}" vào danh sách lớp!`
    );
    setNewStudentName('');
  };

  const handleRemoveStudent = (id: string) => {
    const nextStudents = annualPlan.profile.students.filter((s) => s.id !== id);
    onSaveAnnualPlan({
      ...annualPlan,
      profile: { ...annualPlan.profile, students: nextStudents },
    });
  };

  const updateThemeField = (
    themeId: string,
    updater: (t: ThemeMonthAllocation) => ThemeMonthAllocation
  ) => {
    onSaveAnnualPlan({
      ...annualPlan,
      themes: annualPlan.themes.map((t) => (t.id === themeId ? updater(t) : t)),
    });
  };

  const totalGradeMts = gradeObjectives.length;
  const taughtPct = totalGradeMts > 0 ? Math.round((taughtMtCodes.size / totalGradeMts) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#F6F8F7] px-5 py-4 lg:px-7 lg:py-5">
      <div className="mx-auto max-w-[1360px] space-y-4">
        {/* TOP SUMMARY: GRADE SWITCHER + FULL-YEAR MT COVERAGE + CLASS PROFILE BUTTON */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[#E6F4F1] px-2.5 py-1 text-xs font-bold text-[#0B6E5C]">
                  Kế hoạch Năm học {annualPlan.profile.schoolYear}
                </span>
                <span className="text-xs text-slate-500">
                  {annualPlan.profile.schoolName} · Lớp <strong>{annualPlan.profile.className}</strong> · GV:{' '}
                  <strong>{annualPlan.profile.teacherName}</strong>
                </span>
              </div>
              <h1 className="mt-1.5 text-lg font-bold text-slate-900">
                Phân phối Chương trình 9 Tháng (34–35 Tuần) &amp; Liên thông Chủ đề → Tuần
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Chọn bất kỳ nhánh tuần nào bên dưới để khởi tạo hoặc mở ngay Kế hoạch Tuần (tự kế thừa thông tin lớp, mạng chủ đề và các mã MT của tháng).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {dataset.ageGroups.map((ag) => {
                  const active = ag.id === annualPlan.ageGroupId;
                  return (
                    <button
                      key={ag.id}
                      onClick={() => onSwitchGrade(ag.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        active ? 'bg-[#0B6E5C] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {ag.short}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowYearOverview((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  showYearOverview
                    ? 'border-[#0B6E5C] bg-[#E6F4F1] text-[#0B6E5C]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" /> Dự kiến Chủ đề năm
              </button>

              <button
                onClick={() => setShowCustomMtForm((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  showCustomMtForm
                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-rose-600" /> + Phát triển MT
              </button>

              <button
                onClick={() => setShowTimetablePanel((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  showTimetablePanel
                    ? 'border-[#0B6E5C] bg-[#E6F4F1] text-[#0B6E5C]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Thời khóa biểu (Lẻ / Chẵn)
              </button>

              <button
                onClick={() => setShowProfilePanel((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  showProfilePanel
                    ? 'border-[#0B6E5C] bg-[#E6F4F1] text-[#0B6E5C]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Hồ sơ Lớp &amp; DS Trẻ ({annualPlan.profile.students.length} bé)
              </button>
            </div>
          </div>

          {/* Live Year-Wide MT Coverage Bar */}
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3.5 md:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Độ phủ phân phối khung năm học</div>
              <div className="mt-0.5 text-sm font-bold text-slate-900">
                {plannedMtSet.size} / {totalGradeMts} mã MT chuẩn BGD (100%)
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Đã đưa vào Kế hoạch Tuần thực tế</span>
                <span className="font-bold text-[#0B6E5C]">{taughtPct}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#0B6E5C] transition-all"
                  style={{ width: `${Math.min(100, taughtPct)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Đã dạy <strong>{taughtMtCodes.size}</strong> / {totalGradeMts} MT · Đã tạo{' '}
                <strong>{gradePlans.length}</strong> tuần
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <button
                onClick={() => setShowUntaughtModal((v) => !v)}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {showUntaughtModal
                  ? 'Ẩn danh sách MT chưa dạy'
                  : `Rà soát ${untaughtObjectives.length} MT chưa dạy trong năm`}
              </button>
            </div>
          </div>

          {/* Cảnh báo Vàng khi có Tháng chưa chọn Ngôi sao Đánh giá ★ (YC-046) */}
          {monthsMissingStars.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Cảnh báo phân phối đánh giá:</strong> Chưa chọn Mã MT đánh giá (★) cho{' '}
                  {monthsMissingStars.map((m) => m.monthLabel).join(', ')}. Cô bấm vào tháng đó và tích ngôi sao ★ cho ít nhất 1 mục tiêu nhé!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedThemeId(monthsMissingStars[0].id)}
                className="font-bold text-amber-900 underline"
              >
                Mở {monthsMissingStars[0].monthLabel} ngay →
              </button>
            </div>
          )}

          {/* Biểu mẫu Phát triển Mục tiêu mở rộng của lớp (YC-044, hiển thị chữ đỏ chuẩn GoKids) */}
          {showCustomMtForm && (
            <form
              onSubmit={handleAddCustomObjective}
              className="mt-4 space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/40 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-rose-900">
                  Phát triển thêm Mục tiêu giáo dục mở rộng riêng của Lớp (hiển thị nhãn đỏ phân biệt với MT gốc BGD)
                </div>
              </div>
              <div className="grid gap-2.5 md:grid-cols-12">
                <select
                  value={customMtDomain}
                  onChange={(e) => setCustomMtDomain(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold md:col-span-4"
                >
                  <option value="I. Giáo dục phát triển thể chất">I. Phát triển thể chất</option>
                  <option value="II. Giáo dục phát triển nhận thức">II. Phát triển nhận thức</option>
                  <option value="III. Giáo dục phát triển ngôn ngữ">III. Phát triển ngôn ngữ</option>
                  {annualPlan.ageGroupId === 'NHA_TRE_24_36T' ? (
                    <option value="IV. Tình cảm & KNXH">IV. Tình cảm, KNXH &amp; Thẩm mỹ</option>
                  ) : (
                    <>
                      <option value="IV. Giáo dục phát triển tình cảm và kỹ năng xã hội">
                        IV. Tình cảm &amp; KNXH
                      </option>
                      <option value="V. Giáo dục phát triển thẩm mỹ">V. Phát triển thẩm mỹ</option>
                    </>
                  )}
                </select>
                <select
                  value={customMtMonthId}
                  onChange={(e) => setCustomMtMonthId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold md:col-span-2"
                >
                  {annualPlan.themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.monthLabel}
                    </option>
                  ))}
                </select>
                <input
                  value={customMtDesc}
                  onChange={(e) => setCustomMtDesc(e.target.value)}
                  placeholder="Nhập nội dung mục tiêu mở rộng (VD: Trẻ nhận biết khu vực nguy hiểm quanh trường)..."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs md:col-span-5"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800 md:col-span-1"
                >
                  + Thêm
                </button>
              </div>
            </form>
          )}

          {/* Bảng Tổng hợp Dự kiến Chủ đề & Sự kiện cả năm 9 tháng x Tuần 1..4 (YC-045) */}
          {showYearOverview && (
            <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase text-[#0B6E5C]">
                Bảng Tổng hợp Dự kiến Chủ đề, Nhánh tuần &amp; Sự kiện Năm học {annualPlan.profile.schoolYear}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#0B6E5C] text-white">
                      <th className="border-r border-emerald-700/50 px-3 py-2 font-bold">Tháng / Chủ đề chính</th>
                      <th className="border-r border-emerald-700/50 px-2.5 py-2 font-bold">Tuần 1</th>
                      <th className="border-r border-emerald-700/50 px-2.5 py-2 font-bold">Tuần 2</th>
                      <th className="border-r border-emerald-700/50 px-2.5 py-2 font-bold">Tuần 3</th>
                      <th className="border-r border-emerald-700/50 px-2.5 py-2 font-bold">Tuần 4</th>
                      <th className="px-2.5 py-2 font-bold">Ngày hội / Sự kiện tháng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {annualPlan.themes.map((th) => (
                      <tr key={th.id} className="hover:bg-slate-50/70">
                        <td className="border-r border-slate-200 bg-slate-50/60 px-3 py-2">
                          <div className="font-bold text-[#074F42]">{th.monthLabel}</div>
                          <div className="text-[11px] font-semibold text-slate-800">{th.themeName}</div>
                        </td>
                        {[0, 1, 2, 3].map((wIdx) => {
                          const sub = wIdx < th.totalWeeks ? th.subThemes[wIdx] : '';
                          const ws = addDaysISO(th.startDate, wIdx * 7);
                          const we = addDaysISO(ws, 4);
                          return (
                            <td key={wIdx} className="border-r border-slate-200 px-2.5 py-2 align-top">
                              {sub ? (
                                <>
                                  <div className="font-semibold text-slate-800">{sub}</div>
                                  <div className="text-[10px] text-slate-400">
                                    ({fmtDateVN(ws).slice(0, 5)} – {fmtDateVN(we).slice(0, 5)})
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-1.5 align-top">
                          <input
                            value={th.festivalNote || ''}
                            onChange={(e) =>
                              updateThemeField(th.id, (t) => ({ ...t, festivalNote: e.target.value }))
                            }
                            placeholder="VD: Khai giảng, Tết Trung thu..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 text-[11px] focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Collapsible Untaught MTs Inspector */}
          {showUntaughtModal && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="text-xs font-bold text-amber-950">
                Danh sách {untaughtObjectives.length} mã MT của khối chưa xuất hiện trong Kế hoạch Tuần nào:
              </div>
              {untaughtObjectives.length === 0 ? (
                <p className="mt-1 text-xs text-emerald-700 font-semibold">
                  Tuyệt vời! Lớp đã bao phủ đủ 100% mục tiêu năm học của khối tuổi này.
                </p>
              ) : (
                <div className="mt-2.5 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {untaughtObjectives.map((o) => (
                    <div key={o.id} className="rounded-lg border border-amber-200/80 bg-white p-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                          {o.code}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {o.month} · {o.domain}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-800">{o.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Odd/Even Weekly Timetable Template (YC-036) */}
          {showTimetablePanel && (
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-[#F8FCFB] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#074F42]">
                    Thời khóa biểu mẫu Tuần lẻ / Tuần chẵn (liên kết trực tiếp sang “Tự động xếp lịch” ở Bước 1)
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Bấm chọn môn học cho từng thứ — hệ thống tự áp dụng cho mọi Tuần lẻ (Tuần 1, 3, 5...) và Tuần chẵn (Tuần 2, 4, 6...) cả năm học.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onSaveAnnualPlan(
                        {
                          ...annualPlan,
                          timetable: {
                            oddWeek: activeTimetable.oddWeek,
                            evenWeek: activeTimetable.oddWeek.map((d) => [...d]),
                          },
                        },
                        'Đã sao chép khung Tuần lẻ sang Tuần chẵn!'
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#0B6E5C] hover:text-[#0B6E5C]"
                  >
                    <Copy className="h-3 w-3" /> Copy Tuần lẻ → Tuần chẵn
                  </button>
                  <button
                    onClick={() =>
                      onSaveAnnualPlan(
                        { ...annualPlan, timetable: buildDefaultTimetable(annualPlan.ageGroupId) },
                        'Đã khôi phục Thời khóa biểu chuẩn theo độ tuổi!'
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Khôi phục chuẩn khối
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="w-36 border-r border-slate-200 px-3 py-2 text-left font-bold">
                        Phiên chế tuần
                      </th>
                      {DAY_HEADERS.map((dh) => (
                        <th key={dh} className="border-r border-slate-200 px-2.5 py-2 text-center font-bold last:border-r-0">
                          {dh}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(
                      [
                        { key: 'oddWeek', label: 'Tuần lẻ (T1, 3, 5...)' },
                        { key: 'evenWeek', label: 'Tuần chẵn (T2, 4, 6...)' },
                      ] as const
                    ).map((row) => (
                      <tr key={row.key}>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3 py-2.5 font-bold text-[#074F42]">
                          {row.label}
                        </td>
                        {DAY_HEADERS.map((_, dIdx) => {
                          const picked = activeTimetable[row.key][dIdx] || [];
                          const available = getTimetableSubjectsForGrade(annualPlan.ageGroupId);
                          return (
                            <td key={dIdx} className="border-r border-slate-200 p-2 align-top last:border-r-0">
                              <div className="flex flex-wrap gap-1">
                                {available.map((subj) => {
                                  const on = picked.includes(subj);
                                  return (
                                    <button
                                      key={subj}
                                      type="button"
                                      onClick={() => toggleTimetableSubject(row.key, dIdx, subj)}
                                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${
                                        on
                                          ? 'bg-[#0B6E5C] text-white'
                                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      {subj}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Collapsible Class Profile & Student Roster */}
          {showProfilePanel && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-emerald-200 bg-[#F8FCFB] p-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-6">
                <div className="text-xs font-bold text-[#074F42]">
                  1. Thông tin cố định của Lớp (tự động điền cho mọi Tuần mới &amp; Phiếu Đánh giá)
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Tên trường</span>
                    <input
                      value={annualPlan.profile.schoolName}
                      onChange={(e) => updateProfileField('schoolName', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Đơn vị chủ quản</span>
                    <input
                      value={annualPlan.profile.governingBody}
                      onChange={(e) => updateProfileField('governingBody', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Tên lớp</span>
                    <input
                      value={annualPlan.profile.className}
                      onChange={(e) => updateProfileField('className', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Năm học</span>
                    <input
                      value={annualPlan.profile.schoolYear}
                      onChange={(e) => updateProfileField('schoolYear', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Giáo viên phụ trách</span>
                    <input
                      value={annualPlan.profile.teacherName}
                      onChange={(e) => updateProfileField('teacherName', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold text-slate-600">Đại diện BGH ký duyệt</span>
                    <input
                      value={annualPlan.profile.principalName}
                      onChange={(e) => updateProfileField('principalName', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2.5 lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#074F42]">
                    2. Danh sách Trẻ của Lớp ({annualPlan.profile.students.length} bé — liên thông sang Đánh giá trẻ)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBulkPaste((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B6E5C] hover:bg-[#E6F4F1]"
                  >
                    <ClipboardPaste className="h-3 w-3" /> {showBulkPaste ? 'Đóng dán nhanh' : 'Dán nhanh từ Excel'}
                  </button>
                </div>

                {showBulkPaste && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-2.5">
                    <div className="text-[11px] text-slate-600">
                      Copy cột danh sách trẻ từ Excel rồi dán vào đây (mỗi bé 1 dòng, VD: <code>Nguyễn Gia Bảo, Nam, 15/04/2022</code> hoặc chỉ cần gõ tên):
                    </div>
                    <textarea
                      rows={4}
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder={'Nguyễn Gia Bảo\tNam\t15/04/2022\nTrần Minh Thư\tNữ\t20/08/2022'}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBulkPaste(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkPasteStudents}
                        className="rounded-lg bg-[#0B6E5C] px-3 py-1 text-xs font-bold text-white hover:bg-[#085A4B]"
                      >
                        Nhập hàng loạt vào lớp
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddStudent();
                      }
                    }}
                    placeholder="Nhập họ tên bé mới..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as 'Nam' | 'Nữ')}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                  <button
                    onClick={handleAddStudent}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085A4B]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm bé
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                  {annualPlan.profile.students.map((st, idx) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      <span>
                        <strong className="text-slate-500">{idx + 1}.</strong>{' '}
                        <span className="font-semibold text-slate-800">{st.fullName}</span>{' '}
                        <span className="text-[11px] text-slate-400">
                          ({st.gender || '—'}{st.dob ? ` · ${st.dob}` : ''})
                        </span>
                        {st.note && (
                          <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                            {st.note}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveStudent(st.id)}
                        className="text-slate-300 hover:text-rose-600"
                        title="Xóa khỏi danh sách"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 9-MONTH THEME & WEEKLY BRANCH MATRIX */}
        <div className="space-y-3">
          {annualPlan.themes.map((theme, tIdx) => {
            const isOpen = expandedThemeId === theme.id;
            const weekOffset = cumulativeWeekOffsets[tIdx] || 0;
            const taughtInTheme = theme.plannedMtCodes.filter((c) => taughtMtCodes.has(c)).length;

            return (
              <div
                key={theme.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition"
              >
                <div
                  onClick={() => setExpandedThemeId(isOpen ? '' : theme.id)}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/70"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[#0B6E5C] px-3 py-1.5 text-xs font-bold text-white">
                      <CalendarRange className="h-3.5 w-3.5" /> {theme.monthLabel}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        Chủ đề {theme.order}: {theme.themeName}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {theme.totalWeeks} tuần (Tuần {weekOffset + 1} → Tuần {weekOffset + theme.totalWeeks}) · Bắt đầu{' '}
                        {fmtDateVN(theme.startDate)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      ★ Đánh giá: {(theme.assessmentMtCodes || []).length} MT
                    </span>
                    <span className="rounded-full bg-[#E6F4F1] px-3 py-1 text-xs font-semibold text-[#0B6E5C]">
                      MT tháng: {taughtInTheme}/{theme.plannedMtCodes.length} đã lên tuần
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    {/* Editable Theme Name, Start Date & Week Count (Cài đặt phiên chế tuần 3/4/5 tuần chuẩn GoKids) */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <label className="text-xs md:col-span-2">
                        <span className="font-semibold text-slate-600">Tên Chủ đề lớn ({theme.monthLabel})</span>
                        <input
                          value={theme.themeName}
                          onChange={(e) =>
                            updateThemeField(theme.id, (t) => ({ ...t, themeName: e.target.value.toUpperCase() }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="font-semibold text-slate-600">Thứ Hai tuần đầu Chủ đề</span>
                        <input
                          type="date"
                          value={theme.startDate}
                          onChange={(e) =>
                            updateThemeField(theme.id, (t) => ({ ...t, startDate: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="font-semibold text-slate-600">Phiên chế tuần trong tháng</span>
                        <select
                          value={theme.totalWeeks}
                          onChange={(e) => {
                            const nextCount = Number(e.target.value) || 4;
                            updateThemeField(theme.id, (t) => {
                              const nextSubs = Array.from({ length: nextCount }).map(
                                (_, idx) => t.subThemes[idx] || `Nhánh tuần ${idx + 1} (${t.monthLabel})`
                              );
                              return { ...t, totalWeeks: nextCount, subThemes: nextSubs };
                            });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value={3}>3 tuần / tháng</option>
                          <option value={4}>4 tuần / tháng</option>
                          <option value={5}>5 tuần / tháng</option>
                        </select>
                      </label>
                    </div>

                    {/* Planned MTs of this Month + Assessment Star Toggle (YC-037) */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-700">
                          Mục tiêu phân phối trong {theme.monthLabel} ({theme.plannedMtCodes.length} mã MT):
                        </div>
                        <span className="text-[11px] text-amber-800">
                          Bấm ngôi sao <strong>★</strong> trên từng mã MT để chọn/bỏ làm <strong>Mục tiêu Đánh giá tháng</strong>
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {theme.plannedMtCodes.map((code) => {
                          const obj = objByCode.get(code);
                          const done = taughtMtCodes.has(code);
                          const isStarred = (theme.assessmentMtCodes || []).includes(code);
                          const isCustom = customCodesSet.has(code);
                          return (
                            <span
                              key={code}
                              title={obj ? `${code}: ${obj.description}` : code}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                isCustom
                                  ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-300'
                                  : done
                                  ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300'
                                  : isStarred
                                  ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-300'
                                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAssessmentStar(theme.id, code);
                                }}
                                title={
                                  isStarred
                                    ? 'Đang chọn là MT Đánh giá tháng (bấm để bỏ)'
                                    : 'Chọn làm MT Đánh giá trong tháng này'
                                }
                                className="rounded p-0.5 transition hover:scale-110"
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${
                                    isStarred
                                      ? 'fill-amber-400 text-amber-500'
                                      : 'text-slate-300 hover:text-amber-400'
                                  }`}
                                />
                              </button>
                              {done && <CheckCircle2 className="h-3 w-3 text-emerald-700" />}
                              {code}
                              {obj && (
                                <span className="max-w-[180px] truncate font-normal text-slate-500">
                                  · {obj.description}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weekly Branches Grid — 1-Click Init / Open */}
                    <div>
                      <div className="mb-2 text-xs font-bold text-slate-700">
                        Các tuần nhánh thuộc Chủ đề này (bấm để khởi tạo hoặc mở Kế hoạch Tuần):
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        {theme.subThemes.slice(0, theme.totalWeeks).map((subName, wIdx) => {
                          const cumWeek = weekOffset + wIdx + 1;
                          const wStart = addDaysISO(theme.startDate, wIdx * 7);
                          const wEnd = addDaysISO(wStart, 4);
                          const existing = findExistingWeekPlan(theme, wIdx, cumWeek);

                          return (
                            <div
                              key={wIdx}
                              className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                                existing
                                  ? 'border-emerald-300 bg-white'
                                  : 'border-slate-200 bg-white hover:border-[#0B6E5C]'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-[#0B6E5C]">
                                    Tuần {cumWeek} (Nhánh {wIdx + 1})
                                  </span>
                                  {existing ? (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        STATUS_BADGE[existing.status]?.cls || STATUS_BADGE.DRAFT.cls
                                      }`}
                                    >
                                      {STATUS_BADGE[existing.status]?.label || 'Bản nháp'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Chưa tạo</span>
                                  )}
                                </div>
                                <input
                                  value={subName}
                                  onChange={(e) => {
                                    const nextSubs = [...theme.subThemes];
                                    nextSubs[wIdx] = e.target.value;
                                    updateThemeField(theme.id, (t) => ({ ...t, subThemes: nextSubs }));
                                  }}
                                  className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#0B6E5C] focus:outline-none"
                                />
                                <div className="mt-1.5 text-[11px] text-slate-400">
                                  {fmtDateVN(wStart)} → {fmtDateVN(wEnd)}
                                </div>
                              </div>

                              <button
                                onClick={() => handleInitWeekFromTheme(theme, wIdx, cumWeek)}
                                className={`mt-3 w-full rounded-xl py-2 text-xs font-semibold transition ${
                                  existing
                                    ? 'bg-[#E6F4F1] text-[#0B6E5C] hover:bg-emerald-200/70'
                                    : 'bg-[#0B6E5C] text-white hover:bg-[#085A4B]'
                                }`}
                              >
                                {existing ? `Mở Kế hoạch Tuần ${cumWeek} →` : `+ Khởi tạo Tuần ${cumWeek}`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
