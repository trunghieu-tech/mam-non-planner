import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  DayPlan,
  LessonPlan,
  ObjectiveItem,
  WeeklyPlanDocument,
} from '../../shared/types';
import { buildLessonFromSuggestion, fmtDateVN, syncWeekDates } from '../utils/helpers';

export type OutlineSection =
  | 'cover'
  | 'theme'
  | 'shared'
  | 'week-table'
  | 'day-0'
  | 'day-1'
  | 'day-2'
  | 'day-3'
  | 'day-4';

interface Props {
  plan: WeeklyPlanDocument;
  ageObjectives: ObjectiveItem[];
  activeSection: OutlineSection;
  onNavigate: (sec: OutlineSection) => void;
  onChange: (updated: WeeklyPlanDocument) => void;
  onAskAssistantForSubject: (subjectCode: string) => void;
}

const SUBJECT_PRESETS = [
  { code: 'PTVĐ', full: 'HOẠT ĐỘNG THỂ DỤC GIỜ HỌC', domain: 'LĨNH VỰC PHÁT TRIỂN THỂ CHẤT' },
  { code: 'MTXQ', full: 'HOẠT ĐỘNG KHÁM PHÁ KHOA HỌC / MTXQ', domain: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC' },
  { code: 'LQVT', full: 'HOẠT ĐỘNG LÀM QUEN VỚI TOÁN', domain: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC' },
  { code: 'LQVH', full: 'HOẠT ĐỘNG LÀM QUEN VĂN HỌC', domain: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ' },
  { code: 'LQCC', full: 'HOẠT ĐỘNG LÀM QUEN CHỮ CÁI', domain: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ' },
  { code: 'GDAN', full: 'HOẠT ĐỘNG ÂM NHẠC', domain: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ' },
  { code: 'Tạo hình', full: 'HOẠT ĐỘNG TẠO HÌNH', domain: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ' },
  { code: 'NBTN', full: 'NHẬN BIẾT TẬP NÓI', domain: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC' },
  { code: 'KNS', full: 'GIÁO DỤC KỸ NĂNG SỐNG / XÃ HỘI', domain: 'LĨNH VỰC PHÁT TRIỂN TÌNH CẢM – XÃ HỘI' },
];

const linesToArray = (v: string) => v.split('\n');

export const WritingCanvas: React.FC<Props> = ({
  plan,
  ageObjectives,
  activeSection,
  onNavigate,
  onChange,
  onAskAssistantForSubject,
}) => {
  const updateDay = (idx: number, patch: Partial<DayPlan>) => {
    onChange({
      ...plan,
      days: plan.days.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    });
  };

  const updateMainLesson = (dayIdx: number, lesIdx: number, patch: Partial<LessonPlan>) => {
    const day = plan.days[dayIdx];
    updateDay(dayIdx, {
      mainLessons: day.mainLessons.map((l, i) => (i === lesIdx ? { ...l, ...patch } : l)),
    });
  };

  const addMainLesson = (dayIdx: number) => {
    const preset = SUBJECT_PRESETS[0];
    const les = buildLessonFromSuggestion('Nhập tên đề tài...', preset.code, preset.full, preset.domain, '');
    const day = plan.days[dayIdx];
    updateDay(dayIdx, { mainLessons: [...day.mainLessons, les] });
  };

  const toggleMtInTheme = (domainIdx: number, code: string) => {
    const next = plan.themeObjectives.map((b, i) => {
      if (i !== domainIdx) return b;
      const exists = b.mtCodes.includes(code);
      return { ...b, mtCodes: exists ? b.mtCodes.filter((c) => c !== code) : [...b.mtCodes, code] };
    });
    onChange({ ...plan, themeObjectives: next });
  };

  // =========================================================================
  // SECTION 1: COVER & GENERAL INFO
  // =========================================================================
  if (activeSection === 'cover') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">Phần 1 • Trang bìa hồ sơ</div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Thông tin chung & Bìa Kế hoạch Giáo dục</h1>
          <p className="mt-1 text-xs text-slate-500">
            Nhập một lần tại đây — hệ thống tự đồng bộ vào trang bìa chuẩn Nghị định 30/2020/NĐ-CP, 5 ngày trong tuần và khối chữ ký BGH.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Đơn vị chủ quản (UBND / Phòng GD&ĐT)</label>
            <input
              value={plan.governingBody}
              onChange={(e) => onChange({ ...plan, governingBody: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Tên Trường Mầm non</label>
            <input
              value={plan.schoolName}
              onChange={(e) => onChange({ ...plan, schoolName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Chủ đề lớn</label>
            <input
              value={plan.themeName}
              onChange={(e) => onChange({ ...plan, themeName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Chủ đề nhánh Tuần {plan.weekNumber}</label>
            <input
              value={plan.subThemeName}
              onChange={(e) => onChange({ ...plan, subThemeName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-600">Tên lớp</label>
              <input
                value={plan.className}
                onChange={(e) => onChange({ ...plan, className: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tuần thứ</label>
              <input
                type="number"
                min={1}
                value={plan.weekNumber}
                onChange={(e) => onChange({ ...plan, weekNumber: Number(e.target.value) || 1 })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Năm học</label>
              <input
                value={plan.schoolYear}
                onChange={(e) => onChange({ ...plan, schoolYear: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600">Ngày Thứ hai đầu tuần</label>
              <input
                type="date"
                value={plan.weekStartDate}
                onChange={(e) => onChange(syncWeekDates(plan, e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(syncWeekDates(plan, plan.weekStartDate))}
              className="inline-flex items-center gap-1 rounded-xl border border-[#1D4ED8] bg-[#DBEAFE] px-3 py-2 text-xs font-semibold text-[#1D4ED8]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ T2–T6
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Giáo viên phụ trách (ký tên)</label>
            <input
              value={plan.teacherName}
              onChange={(e) => onChange({ ...plan, teacherName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Đại diện Ban Giám hiệu ký duyệt</label>
            <input
              value={plan.principalName}
              onChange={(e) => onChange({ ...plan, principalName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={plan.includeThemeSection}
            onChange={(e) => onChange({ ...plan, includeThemeSection: e.target.checked })}
            className="h-4 w-4 accent-[#1D4ED8]"
          />
          Kèm phần Kế hoạch Chủ đề (Mục tiêu 5 lĩnh vực, Mạng nội dung, Mạng hoạt động) khi xuất file Word — thường bật cho Tuần 1 của mỗi chủ đề.
        </label>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            onClick={() => onNavigate('theme')}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Tiếp: Mục tiêu & Mạng Chủ đề <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SECTION 2: THEME OBJECTIVES + NETWORKS
  // =========================================================================
  if (activeSection === 'theme') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">Phần 2 • Kế hoạch Chủ đề</div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Mục tiêu Chủ đề, Mạng Nội dung & Mạng Hoạt động</h1>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">I. Mục tiêu Chủ đề (5 Lĩnh vực + Mã MT chuẩn)</h2>
          {plan.themeObjectives.map((block, bIdx) => (
            <div key={block.domainKey} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-sm font-bold text-[#1D4ED8]">{block.domainTitle}</div>
              <textarea
                rows={3}
                value={block.customGoals.join('\n')}
                onChange={(e) => {
                  const next = plan.themeObjectives.map((b, i) =>
                    i === bIdx ? { ...b, customGoals: linesToArray(e.target.value) } : b
                  );
                  onChange({ ...plan, themeObjectives: next });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-relaxed focus:border-[#1D4ED8] focus:outline-none"
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {block.mtCodes.map((code) => {
                  const obj = ageObjectives.find((o) => o.code === code);
                  return (
                    <span
                      key={code}
                      title={obj?.description}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      {code}
                      <button onClick={() => toggleMtInTheme(bIdx, code)} className="ml-0.5 text-blue-200 hover:text-white">
                        ×
                      </button>
                    </span>
                  );
                })}
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      toggleMtInTheme(bIdx, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="rounded-lg border border-dashed border-[#1D4ED8] bg-white px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]"
                >
                  <option value="">+ Chọn mã MT...</option>
                  {ageObjectives
                    .filter((o) => !block.mtCodes.includes(o.code))
                    .map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code}: {o.description.slice(0, 68)}...
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">II. Mạng Nội dung ({plan.contentNetwork.length} nhánh tuần)</h2>
            <button
              onClick={() =>
                onChange({
                  ...plan,
                  contentNetwork: [
                    ...plan.contentNetwork,
                    { id: `br_${Date.now()}`, branchTitle: `Tuần ${plan.contentNetwork.length + 1}: Nhánh mới`, items: ['Nội dung...'] },
                  ],
                })
              }
              className="inline-flex items-center gap-1 rounded-lg bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm nhánh
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {plan.contentNetwork.map((br, idx) => (
              <div key={br.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <input
                  value={br.branchTitle}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      contentNetwork: plan.contentNetwork.map((b, i) => (i === idx ? { ...b, branchTitle: e.target.value } : b)),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-[#1E3A8A]"
                />
                <textarea
                  rows={5}
                  value={br.items.join('\n')}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      contentNetwork: plan.contentNetwork.map((b, i) => (i === idx ? { ...b, items: linesToArray(e.target.value) } : b)),
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-bold text-slate-900">III. Mạng Hoạt động (5 Lĩnh vực)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {plan.activityNetwork.map((an, idx) => (
              <div key={an.domainKey} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-xs font-bold text-[#1D4ED8]">{an.domainTitle}</div>
                <textarea
                  rows={4}
                  value={an.items.join('\n')}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      activityNetwork: plan.activityNetwork.map((a, i) => (i === idx ? { ...a, items: linesToArray(e.target.value) } : a)),
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between border-t border-slate-100 pt-4">
          <button
            onClick={() => onNavigate('cover')}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" /> Trang bìa
          </button>
          <button
            onClick={() => onNavigate('shared')}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Tiếp: Khối dùng chung tuần <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SECTION 3: SHARED WEEKLY ROUTINES
  // =========================================================================
  if (activeSection === 'shared') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">Phần 3 • Dùng chung 5 ngày</div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Lễ giáo, Thể dục sáng, HĐ Ngoài trời & 5 Góc chơi</h1>
          <p className="mt-1 text-xs text-slate-500">
            Soạn một lần tại đây — hệ thống tự kế thừa sang cả 5 ngày Thứ 2–Thứ 6 và Bảng tổng hợp tuần.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-700">Lễ giáo cả tuần</label>
            <textarea
              rows={3}
              value={plan.etiquetteNotes.join('\n')}
              onChange={(e) => onChange({ ...plan, etiquetteNotes: linesToArray(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs leading-relaxed"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Lao động vệ sinh cả tuần</label>
            <textarea
              rows={3}
              value={plan.laborHygieneNotes.join('\n')}
              onChange={(e) => onChange({ ...plan, laborHygieneNotes: linesToArray(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs leading-relaxed"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700">Nội dung Đón trẻ (dùng chung 5 ngày)</label>
          <textarea
            rows={3}
            value={plan.welcomeRoutineNotes.join('\n')}
            onChange={(e) => onChange({ ...plan, welcomeRoutineNotes: linesToArray(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs leading-relaxed"
          />
        </div>

        <div className="space-y-2.5 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-[#1D4ED8]">Thể dục sáng (5 nhóm động tác)</h2>
          {plan.morningExercise.moves.map((mv, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#1D4ED8] px-2 py-0.5 text-[11px] font-bold text-white">{mv.group}</span>
                <input
                  value={mv.name}
                  onChange={(e) => {
                    const moves = plan.morningExercise.moves.map((m, i) => (i === idx ? { ...m, name: e.target.value } : m));
                    onChange({ ...plan, morningExercise: { ...plan.morningExercise, moves } });
                  }}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold"
                />
              </div>
              <input
                value={mv.steps}
                onChange={(e) => {
                  const moves = plan.morningExercise.moves.map((m, i) => (i === idx ? { ...m, steps: e.target.value } : m));
                  onChange({ ...plan, morningExercise: { ...plan.morningExercise, moves } });
                }}
                placeholder="Mô tả nhịp chi tiết..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2.5 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-[#1D4ED8]">Hoạt động 5 Góc chơi trong tuần</h2>
          {plan.cornerTable.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  value={c.cornerName}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      cornerTable: plan.cornerTable.map((x, i) => (i === idx ? { ...x, cornerName: e.target.value } : x)),
                    })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#1E3A8A]"
                />
                <input
                  value={c.contents.join('; ')}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      cornerTable: plan.cornerTable.map((x, i) =>
                        i === idx ? { ...x, contents: e.target.value.split(';').map((s) => s.trim()) } : x
                      ),
                    })
                  }
                  placeholder="Nội dung chơi..."
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs md:col-span-2"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t border-slate-100 pt-4">
          <button
            onClick={() => onNavigate('theme')}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" /> Kế hoạch Chủ đề
          </button>
          <button
            onClick={() => onNavigate('day-0')}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Bắt đầu soạn Thứ hai <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SECTION 4: WEEKLY OVERVIEW TABLE (click any day to jump right into writing)
  // =========================================================================
  if (activeSection === 'week-table') {
    return (
      <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">Tổng quan lịch tuần</div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            Bảng tổng hợp Kế hoạch Tuần {plan.weekNumber} ({fmtDateVN(plan.weekStartDate)} – {fmtDateVN(plan.weekEndDate)})
          </h1>
          <p className="mt-1 text-xs text-slate-500">Bấm trực tiếp vào bất kỳ ngày nào bên dưới để mở trang soạn giáo án chi tiết.</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#1D4ED8] text-white">
                <th className="p-2.5 font-bold">Thứ / Ngày</th>
                <th className="p-2.5 font-bold">Hoạt động có chủ đích</th>
                <th className="p-2.5 font-bold">HĐ ngoài trời</th>
                <th className="p-2.5 font-bold">Hoạt động chiều</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {plan.days.map((d, idx) => (
                <tr
                  key={d.dayOfWeek}
                  onClick={() => onNavigate(`day-${idx}` as OutlineSection)}
                  className="cursor-pointer transition hover:bg-[#F0FAF8]"
                >
                  <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                    {d.dayLabel}
                    <div className="text-[11px] font-normal text-slate-400">{fmtDateVN(d.dateStr)}</div>
                  </td>
                  <td className="p-3">
                    {d.mainLessons.length === 0 ? (
                      <span className="italic text-slate-400">Chưa có tiết — bấm để soạn</span>
                    ) : (
                      <div className="space-y-1">
                        {d.mainLessons.map((l) => (
                          <div key={l.id}>
                            <span className="mr-1 rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                              {l.subjectCode}
                            </span>
                            <span className="font-semibold text-slate-800">{l.topicTitle}</span>
                            {l.linkedMtCodes.length > 0 && (
                              <span className="ml-1 text-[10px] text-amber-700">({l.linkedMtCodes.join(', ')})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">{d.outdoorObservation}</td>
                  <td className="p-3 text-slate-600">
                    {d.extracurricularTitle && <div className="font-semibold text-slate-800">{d.extracurricularTitle}</div>}
                    {d.afternoonLesson && <div>{d.afternoonLesson.topicTitle}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SECTION 5: DAILY LESSON AUTHORING CANVAS (THE HEART OF THE APP!)
  // =========================================================================
  const dayIdx = Number(activeSection.replace('day-', '')) || 0;
  const day = plan.days[dayIdx] || plan.days[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs sm:p-9">
      {/* Document-style Day Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
              Hoạt động tích hợp trong ngày • Tuần {plan.weekNumber}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {day.dayLabel}, {fmtDateVN(day.dateStr)}
            </h1>
          </div>
          <button
            onClick={() => addMainLesson(dayIdx)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#1E40AF]"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm tiết học mới
          </button>
        </div>

        {/* Subtle inherited routines strip */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400">Tự động kế thừa từ tuần:</span>
          <button
            onClick={() => onNavigate('shared')}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 hover:bg-[#DBEAFE] hover:text-[#1D4ED8]"
          >
            A. Đón trẻ & Thể dục sáng ({plan.morningExercise.moves.length} động tác)
          </button>
          <button
            onClick={() => onNavigate('shared')}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 hover:bg-[#DBEAFE] hover:text-[#1D4ED8]"
          >
            D. Hoạt động góc ({plan.cornerTable.length} góc)
          </button>
        </div>
      </div>

      {/* B. Hoạt động ngoài trời */}
      <section className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          B. Hoạt động ngoài trời (Quan sát có mục đích của {day.dayLabel})
        </label>
        <input
          value={day.outdoorObservation}
          onChange={(e) => updateDay(dayIdx, { outdoorObservation: e.target.value })}
          placeholder="VD: Quan sát khung cảnh Trường Mầm non / Đồ chơi sân trường..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
        />
      </section>

      {/* C. Hoạt động có chủ đích (Main Lesson Editor) */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8]">
            C. Hoạt động có chủ đích ({day.mainLessons.length} tiết)
          </div>
        </div>

        {day.mainLessons.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">Chưa có tiết học nào cho {day.dayLabel}.</p>
            <p className="mt-1 text-xs text-slate-400">
              Bạn có thể bấm “Thêm tiết học mới” hoặc chọn gợi ý từ bảng Trợ lý bên phải để chèn nhanh!
            </p>
          </div>
        )}

        {day.mainLessons.map((les, lIdx) => (
          <article
            key={les.id}
            className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/30 p-5 transition focus-within:border-[#1D4ED8]/60 focus-within:bg-white"
          >
            {/* Lesson top bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-xs font-bold text-white">
                  Tiết {lIdx + 1}
                </span>
                <select
                  value={les.subjectCode}
                  onChange={(e) => {
                    const found = SUBJECT_PRESETS.find((p) => p.code === e.target.value);
                    updateMainLesson(dayIdx, lIdx, {
                      subjectCode: e.target.value,
                      subjectFullTitle: found?.full || les.subjectFullTitle,
                      domainTitle: found?.domain || les.domainTitle,
                    });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
                >
                  {SUBJECT_PRESETS.map((p) => (
                    <option key={p.code} value={p.code}>{p.code} — {p.full.replace('HOẠT ĐỘNG ', '')}</option>
                  ))}
                </select>
                {les.linkedMtCodes.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    {c}
                    <button
                      onClick={() =>
                        updateMainLesson(dayIdx, lIdx, {
                          linkedMtCodes: les.linkedMtCodes.filter((x) => x !== c),
                        })
                      }
                      className="text-amber-700 hover:text-amber-950"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onAskAssistantForSubject(les.subjectCode)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-blue-100"
                >
                  <Sparkles className="h-3 w-3" /> Gợi ý {les.subjectCode}
                </button>
                <button
                  onClick={() => updateDay(dayIdx, { mainLessons: day.mainLessons.filter((_, i) => i !== lIdx) })}
                  title="Xóa tiết học"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Topic title - prominent document-style input */}
            <div>
              <input
                value={les.topicTitle}
                onChange={(e) => updateMainLesson(dayIdx, lIdx, { topicTitle: e.target.value })}
                placeholder="Nhập tên đề tài..."
                className="w-full border-b border-transparent bg-transparent text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:border-[#1D4ED8] focus:outline-none"
              />
              <input
                value={les.subTopics.join(' | ')}
                onChange={(e) =>
                  updateMainLesson(dayIdx, lIdx, {
                    subTopics: e.target.value ? e.target.value.split('|').map((s) => s.trim()) : [],
                  })
                }
                placeholder="+ Nội dung kết hợp (VD: Nghe hát: Ngày đầu tiên đi học | TCAN: Tai ai thính)"
                className="mt-1 w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-400 focus:text-slate-800 focus:outline-none"
              />
            </div>

            {/* I. Mục đích - Yêu cầu & II. Chuẩn bị */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700">I. Mục đích – Yêu cầu</label>
                <textarea
                  rows={4}
                  value={les.aims.join('\n')}
                  onChange={(e) => updateMainLesson(dayIdx, lIdx, { aims: linesToArray(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">II. Chuẩn bị (cô & trẻ)</label>
                <textarea
                  rows={4}
                  value={les.preparation.join('\n')}
                  onChange={(e) => updateMainLesson(dayIdx, lIdx, { preparation: linesToArray(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {/* III. Tổ chức hoạt động */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">III. Tổ chức hoạt động</label>
                <button
                  onClick={() =>
                    updateMainLesson(dayIdx, lIdx, {
                      steps: [
                        ...les.steps,
                        { title: `Hoạt động ${les.steps.length + 1}: ...`, details: [''] },
                      ],
                    })
                  }
                  className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
                >
                  + Thêm bước hoạt động
                </button>
              </div>
              {les.steps.map((st, sIdx) => (
                <div key={sIdx} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={st.title}
                      onChange={(e) => {
                        const steps = les.steps.map((x, i) => (i === sIdx ? { ...x, title: e.target.value } : x));
                        updateMainLesson(dayIdx, lIdx, { steps });
                      }}
                      className="flex-1 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    {les.steps.length > 1 && (
                      <button
                        onClick={() =>
                          updateMainLesson(dayIdx, lIdx, {
                            steps: les.steps.filter((_, i) => i !== sIdx),
                          })
                        }
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={st.details.join('\n')}
                    onChange={(e) => {
                      const steps = les.steps.map((x, i) => (i === sIdx ? { ...x, details: linesToArray(e.target.value) } : x));
                      updateMainLesson(dayIdx, lIdx, { steps });
                    }}
                    className="mt-1.5 w-full rounded-lg bg-slate-50/70 p-2 text-xs leading-relaxed text-slate-700 focus:bg-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* E. Hoạt động chiều */}
      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">E. Hoạt động chiều</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Hoạt động ngoại khóa (HĐNK, nếu có)</label>
            <input
              value={day.extracurricularTitle}
              onChange={(e) => updateDay(dayIdx, { extracurricularTitle: e.target.value })}
              placeholder="VD: HĐNK: Học nhảy Aerobic / Toán Soroban"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Đề tài rèn luyện / giáo án chiều</label>
            <input
              value={day.afternoonLesson?.topicTitle || ''}
              onChange={(e) => {
                const cur = day.afternoonLesson || {
                  id: `aft_${Date.now()}`,
                  slotType: 'AFTERNOON' as const,
                  domainTitle: 'HOẠT ĐỘNG CHIỀU',
                  subjectCode: 'KNS',
                  subjectFullTitle: 'HOẠT ĐỘNG CHIỀU',
                  topicTitle: '',
                  subTopics: [],
                  linkedMtCodes: [],
                  aims: ['Củng cố kiến thức và rèn kỹ năng cho trẻ.'],
                  preparation: ['Đồ dùng, tranh ảnh liên quan.'],
                  steps: [{ title: 'Tiến hành', details: ['Cô hướng dẫn trẻ thực hành theo nhóm và cá nhân.'] }],
                };
                updateDay(dayIdx, { afternoonLesson: { ...cur, topicTitle: e.target.value } });
              }}
              placeholder="VD: Thực hành 6 bước rửa tay / Ôn bài thơ trong tuần..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* Đánh giá cuối ngày (3 tiêu chí BGD) */}
      <section className="space-y-2.5 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            F. Đánh giá cuối ngày (3 tiêu chí chuẩn BGD)
          </div>
          <span className="text-[11px] text-slate-400">Để trống nếu muốn in dòng chấm viết tay</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">1. Tình trạng sức khỏe</label>
            <textarea
              rows={2}
              value={day.evalHealth}
              onChange={(e) => updateDay(dayIdx, { evalHealth: e.target.value })}
              placeholder="Sĩ số, sức khỏe trẻ..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">2. Cảm xúc, thái độ, hành vi</label>
            <textarea
              rows={2}
              value={day.evalEmotionBehavior}
              onChange={(e) => updateDay(dayIdx, { evalEmotionBehavior: e.target.value })}
              placeholder="Hứng thú, nề nếp..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">3. Kiến thức, kỹ năng</label>
            <textarea
              rows={2}
              value={day.evalKnowledgeSkill}
              onChange={(e) => updateDay(dayIdx, { evalKnowledgeSkill: e.target.value })}
              placeholder="Mức độ tiếp thu, trẻ cần lưu ý..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* Smooth Day-to-Day Footer Pager */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          onClick={() => onNavigate(dayIdx > 0 ? (`day-${dayIdx - 1}` as OutlineSection) : 'shared')}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          {dayIdx > 0 ? plan.days[dayIdx - 1].dayLabel : 'Khối dùng chung tuần'}
        </button>
        {dayIdx < 4 ? (
          <button
            onClick={() => onNavigate(`day-${dayIdx + 1}` as OutlineSection)}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Soạn tiếp: {plan.days[dayIdx + 1].dayLabel} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onNavigate('week-table')}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Xem lại Bảng tổng hợp Tuần <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
