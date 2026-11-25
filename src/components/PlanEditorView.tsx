import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  DayPlan,
  LessonPlan,
  ObjectiveItem,
  ObjectivesDataset,
  SuggestedActivity,
  WeeklyPlanDocument,
} from '../../shared/types';
import {
  buildLessonFromSuggestion,
  domainBadgeStyle,
  fmtDateVN,
  inferSubjectFromActivityType,
  normVN,
  runQualityChecks,
  syncWeekDates,
} from '../utils/helpers';
import { DocPreview } from './DocPreview';

interface CrawledMtEntry {
  docCount: number;
  lessonCount: number;
  topLessons: Array<{ subject: string; topic: string; school: string; score: number }>;
}

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  onChange: (updated: WeeklyPlanDocument) => void;
  onSave: (plan: WeeklyPlanDocument) => Promise<void>;
  onBack: () => void;
  onExportDocx: (plan: WeeklyPlanDocument) => void;
  onExportXlsx: (plan: WeeklyPlanDocument) => void;
  saving: boolean;
}

type EditorTab = 'general' | 'theme' | 'shared' | 'schedule' | 'preview';

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

export const PlanEditorView: React.FC<Props> = ({
  plan,
  dataset,
  onChange,
  onSave,
  onBack,
  onExportDocx,
  onExportXlsx,
  saving,
}) => {
  const [tab, setTab] = useState<EditorTab>('schedule');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [mtSearch, setMtSearch] = useState('');
  const [sidebarSource, setSidebarSource] = useState<'excel' | 'crawled'>('excel');
  const [crawledByMt, setCrawledByMt] = useState<Record<string, CrawledMtEntry>>({});

  useEffect(() => {
    fetch(`/api/kb/suggestions?ageGroupId=${plan.ageGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setCrawledByMt(d.byMt);
        else setCrawledByMt({});
      })
      .catch(() => setCrawledByMt({}));
  }, [plan.ageGroupId]);

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  const selectedMtSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of plan.themeObjectives) for (const c of b.mtCodes) s.add(c);
    return s;
  }, [plan.themeObjectives]);

  const filteredSidebarObjectives = useMemo(() => {
    const q = normVN(mtSearch);
    const list = ageObjectives.filter((o) => {
      if (!q) return true;
      const hay = normVN(
        `${o.code} ${o.domain} ${o.description} ${o.theme} ${o.activities.map((a) => a.text).join(' ')}`
      );
      return hay.includes(q);
    });
    // Sort selected theme MTs first!
    return [...list].sort((a, b) => {
      const aSel = selectedMtSet.has(a.code) ? 0 : 1;
      const bSel = selectedMtSet.has(b.code) ? 0 : 1;
      return aSel - bSel;
    });
  }, [ageObjectives, mtSearch, selectedMtSet]);

  const qualityChecks = useMemo(() => runQualityChecks(plan), [plan]);
  const currentDay: DayPlan = plan.days[selectedDayIdx] || plan.days[0];

  const updateDay = (idx: number, patch: Partial<DayPlan>) => {
    const nextDays = plan.days.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange({ ...plan, days: nextDays });
  };

  const updateMainLesson = (dayIdx: number, lesIdx: number, patch: Partial<LessonPlan>) => {
    const day = plan.days[dayIdx];
    const nextLessons = day.mainLessons.map((l, i) => (i === lesIdx ? { ...l, ...patch } : l));
    updateDay(dayIdx, { mainLessons: nextLessons });
  };

  const addBlankMainLesson = (dayIdx: number) => {
    const preset = SUBJECT_PRESETS[0];
    const les = buildLessonFromSuggestion('Đề tài mới...', preset.code, preset.full, preset.domain, '');
    const day = plan.days[dayIdx];
    updateDay(dayIdx, { mainLessons: [...day.mainLessons, les] });
  };

  const insertActivityIntoCurrentDay = (obj: ObjectiveItem, act: SuggestedActivity) => {
    const info = inferSubjectFromActivityType(act.type, obj.domain);
    const les = buildLessonFromSuggestion(act.text, info.subjectCode, info.subjectFullTitle, info.domainTitle, obj.code, obj);
    const day = plan.days[selectedDayIdx];
    updateDay(selectedDayIdx, { mainLessons: [...day.mainLessons, les] });
  };

  const insertCrawledIntoCurrentDay = (obj: ObjectiveItem, item: { subject: string; topic: string }) => {
    const info = inferSubjectFromActivityType(item.subject, obj.domain);
    const les = buildLessonFromSuggestion(item.topic, item.subject || info.subjectCode, info.subjectFullTitle, info.domainTitle, obj.code, obj);
    const day = plan.days[selectedDayIdx];
    updateDay(selectedDayIdx, { mainLessons: [...day.mainLessons, les] });
  };

  const toggleMtInTheme = (domainIdx: number, code: string) => {
    const next = plan.themeObjectives.map((b, i) => {
      if (i !== domainIdx) return b;
      const exists = b.mtCodes.includes(code);
      return {
        ...b,
        mtCodes: exists ? b.mtCodes.filter((c) => c !== code) : [...b.mtCodes, code],
      };
    });
    onChange({ ...plan, themeObjectives: next });
  };

  const linesToArray = (val: string) => val.split('\n');

  return (
    <div className="space-y-4">
      {/* Top sticky action header */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Danh sách
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Tuần {plan.weekNumber}: {plan.subThemeName}
              </h2>
              <span className="rounded-full bg-[#E6F4F1] px-2 py-0.5 text-[11px] font-semibold text-[#0B6E5C]">
                Lớp {plan.className}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {plan.schoolName} • {fmtDateVN(plan.weekStartDate)} – {fmtDateVN(plan.weekEndDate)} • GV: {plan.teacherName}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSave(plan)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B6E5C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#085A4B] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
          </button>
          <button
            onClick={() => onExportDocx(plan)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            <FileText className="h-3.5 w-3.5" /> Xuất Word chuẩn BGD (.docx)
          </button>
          <button
            onClick={() => onExportXlsx(plan)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* 5 Step Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
        {[
          { id: 'general', label: '1. Bìa & Hành chính', icon: FileText },
          { id: 'theme', label: '2. Mục tiêu & Mạng Chủ đề', icon: Layers },
          { id: 'shared', label: '3. Khối dùng chung tuần', icon: BookOpen },
          { id: 'schedule', label: '4. Lịch 5 ngày & Giáo án', icon: Calendar },
          { id: 'preview', label: '5. Xem trước A4 & Kiểm lỗi', icon: CheckCircle2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as EditorTab)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-[#0B6E5C] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL & COVER */}
      {tab === 'general' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Thông tin Trang bìa & Hành chính (chuẩn NĐ 30/2020/NĐ-CP)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Nhập 1 lần — hệ thống tự đồng bộ vào Trang bìa, tiêu đề các tuần/ngày và khối chữ ký cuối hồ sơ.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Đơn vị chủ quản (UBND / Phòng GD&ĐT)</label>
              <input
                value={plan.governingBody}
                onChange={(e) => onChange({ ...plan, governingBody: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tên Trường Mầm non</label>
              <input
                value={plan.schoolName}
                onChange={(e) => onChange({ ...plan, schoolName: e.target.value })}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Tên lớp</label>
                <input
                  value={plan.className}
                  onChange={(e) => onChange({ ...plan, className: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Trạng thái duyệt</label>
                <select
                  value={plan.status}
                  onChange={(e) => onChange({ ...plan, status: e.target.value as WeeklyPlanDocument['status'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PENDING_REVIEW">Chờ Tổ trưởng / BGH duyệt</option>
                  <option value="APPROVED">Đã phê duyệt BGH</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Giáo viên phụ trách (ký tên)</label>
              <input
                value={plan.teacherName}
                onChange={(e) => onChange({ ...plan, teacherName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Đại diện Ban Giám hiệu (ký duyệt & đóng dấu)</label>
              <input
                value={plan.principalName}
                onChange={(e) => onChange({ ...plan, principalName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Chủ đề lớn</label>
              <input
                value={plan.themeName}
                onChange={(e) => onChange({ ...plan, themeName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Chủ đề nhánh của Tuần {plan.weekNumber}</label>
              <input
                value={plan.subThemeName}
                onChange={(e) => onChange({ ...plan, subThemeName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <label className="text-xs font-semibold text-slate-600">Số tuần chủ đề</label>
                <input
                  type="number"
                  min={1}
                  value={plan.themeTotalWeeks}
                  onChange={(e) => onChange({ ...plan, themeTotalWeeks: Number(e.target.value) || 3 })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Thứ 2 đầu tuần</label>
                <input
                  type="date"
                  value={plan.weekStartDate}
                  onChange={(e) => onChange(syncWeekDates(plan, e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => onChange(syncWeekDates(plan, plan.weekStartDate))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0B6E5C] bg-[#E6F4F1] px-3.5 py-2 text-xs font-semibold text-[#0B6E5C] hover:bg-emerald-100"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tự đồng bộ 5 ngày Thứ 2–Thứ 6
              </button>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={plan.includeThemeSection}
                  onChange={(e) => onChange({ ...plan, includeThemeSection: e.target.checked })}
                  className="h-4 w-4 accent-[#0B6E5C]"
                />
                In kèm Phần Chủ đề (Mục tiêu + Mạng nội dung/hoạt động)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THEME OBJECTIVES + NETWORKS */}
      {tab === 'theme' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">I. Mục tiêu Chủ đề (5 Lĩnh vực + Gắn mã MT chuẩn)</h3>
            <p className="mt-1 text-xs text-slate-500">
              Chọn trực tiếp mã <strong>MT</strong> từ kho chuẩn của khối lớp — khi xuất Word sẽ tự động chèn đầy đủ mã MT và mô tả chuẩn 01/VBHN-BGDĐT.
            </p>
            <div className="mt-4 space-y-4">
              {plan.themeObjectives.map((block, bIdx) => (
                <div key={block.domainKey} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="font-bold text-sm text-[#0B6E5C]">{block.domainTitle}</div>
                  <div className="mt-2">
                    <label className="text-xs font-medium text-slate-600">Mục tiêu riêng theo chủ đề (mỗi dòng 1 ý):</label>
                    <textarea
                      rows={3}
                      value={block.customGoals.join('\n')}
                      onChange={(e) => {
                        const next = plan.themeObjectives.map((b, i) =>
                          i === bIdx ? { ...b, customGoals: linesToArray(e.target.value) } : b
                        );
                        onChange({ ...plan, themeObjectives: next });
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                    />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-medium text-slate-600">Mã MT đã gắn ({block.mtCodes.length}):</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {block.mtCodes.map((code) => {
                        const obj = ageObjectives.find((o) => o.code === code);
                        return (
                          <span
                            key={code}
                            title={obj?.description}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0B6E5C] px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            {code}
                            <button
                              onClick={() => toggleMtInTheme(bIdx, code)}
                              className="ml-0.5 text-emerald-200 hover:text-white"
                            >
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
                        className="rounded-lg border border-dashed border-[#0B6E5C] bg-white px-2.5 py-1 text-xs font-semibold text-[#0B6E5C]"
                      >
                        <option value="">+ Chọn thêm mã MT...</option>
                        {ageObjectives
                          .filter((o) => !block.mtCodes.includes(o.code))
                          .map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.code}: {o.description.slice(0, 72)}...
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mạng nội dung */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">II. Mạng Nội dung ({plan.contentNetwork.length} nhánh tuần)</h3>
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
                className="inline-flex items-center gap-1 rounded-lg bg-[#E6F4F1] px-3 py-1.5 text-xs font-semibold text-[#0B6E5C]"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm nhánh
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              {plan.contentNetwork.map((br, idx) => (
                <div key={br.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    value={br.branchTitle}
                    onChange={(e) => {
                      const next = plan.contentNetwork.map((b, i) => (i === idx ? { ...b, branchTitle: e.target.value } : b));
                      onChange({ ...plan, contentNetwork: next });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#074F42]"
                  />
                  <textarea
                    rows={5}
                    value={br.items.join('\n')}
                    onChange={(e) => {
                      const next = plan.contentNetwork.map((b, i) => (i === idx ? { ...b, items: linesToArray(e.target.value) } : b));
                      onChange({ ...plan, contentNetwork: next });
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Mạng hoạt động */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">III. Mạng Hoạt động (5 Lĩnh vực phát triển)</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {plan.activityNetwork.map((an, idx) => (
                <div key={an.domainKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-[#0B6E5C]">{an.domainTitle}</div>
                  <textarea
                    rows={4}
                    value={an.items.join('\n')}
                    onChange={(e) => {
                      const next = plan.activityNetwork.map((a, i) => (i === idx ? { ...a, items: linesToArray(e.target.value) } : a));
                      onChange({ ...plan, activityNetwork: next });
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SHARED WEEKLY BLOCKS */}
      {tab === 'shared' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-sm font-bold text-slate-900">Lễ giáo cả tuần</div>
              <textarea
                rows={4}
                value={plan.etiquetteNotes.join('\n')}
                onChange={(e) => onChange({ ...plan, etiquetteNotes: linesToArray(e.target.value) })}
                className="mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-sm font-bold text-slate-900">Lao động vệ sinh cả tuần</div>
              <textarea
                rows={4}
                value={plan.laborHygieneNotes.join('\n')}
                onChange={(e) => onChange({ ...plan, laborHygieneNotes: linesToArray(e.target.value) })}
                className="mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-sm font-bold text-slate-900">Đón trẻ (tự kế thừa 5 ngày)</div>
              <textarea
                rows={4}
                value={plan.welcomeRoutineNotes.join('\n')}
                onChange={(e) => onChange({ ...plan, welcomeRoutineNotes: linesToArray(e.target.value) })}
                className="mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              />
            </div>
          </div>

          {/* Thể dục sáng */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#0B6E5C]">I. Thể dục sáng (tự đồng bộ vào Bảng tuần & 5 ngày)</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {plan.morningExercise.moves.map((mv, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#0B6E5C] px-2 py-0.5 text-[11px] font-bold text-white">{mv.group}</span>
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
          </div>

          {/* Bảng 5 Góc chơi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#0B6E5C]">II. Bảng 5 Góc chơi trong tuần (tự đồng bộ xuống 5 ngày)</h3>
            <div className="mt-3 space-y-3">
              {plan.cornerTable.map((c, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#074F42]">Tên góc</label>
                    <input
                      value={c.cornerName}
                      onChange={(e) => {
                        const next = plan.cornerTable.map((x, i) => (i === idx ? { ...x, cornerName: e.target.value } : x));
                        onChange({ ...plan, cornerTable: next });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Nội dung chơi</label>
                    <textarea
                      rows={2}
                      value={c.contents.join('\n')}
                      onChange={(e) => {
                        const next = plan.cornerTable.map((x, i) => (i === idx ? { ...x, contents: linesToArray(e.target.value) } : x));
                        onChange({ ...plan, cornerTable: next });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Chuẩn bị</label>
                    <textarea
                      rows={2}
                      value={c.preparation.join('\n')}
                      onChange={(e) => {
                        const next = plan.cornerTable.map((x, i) => (i === idx ? { ...x, preparation: linesToArray(e.target.value) } : x));
                        onChange({ ...plan, cornerTable: next });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Tổ chức hoạt động</label>
                    <textarea
                      rows={2}
                      value={c.organization.join('\n')}
                      onChange={(e) => {
                        const next = plan.cornerTable.map((x, i) => (i === idx ? { ...x, organization: linesToArray(e.target.value) } : x));
                        onChange({ ...plan, cornerTable: next });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 5-DAY SCHEDULE & LESSON EDITOR + SMART SUGGESTION SIDEBAR */}
      {tab === 'schedule' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Main Left Column (8 cols) */}
          <div className="space-y-4 xl:col-span-8">
            {/* Day switcher pills */}
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
              {plan.days.map((d, idx) => {
                const active = idx === selectedDayIdx;
                return (
                  <button
                    key={d.dayOfWeek}
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`flex-1 min-w-[100px] rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{d.dayLabel}</div>
                    <div className={`text-[11px] ${active ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {fmtDateVN(d.dateStr)} • {d.mainLessons.length} tiết
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Day Form */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {currentDay.dayLabel}, {fmtDateVN(currentDay.dateStr)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đón trẻ, Thể dục sáng, TCVĐ/TCDG ngoài trời và 5 Góc chơi được tự động kế thừa từ Tab 3.
                  </p>
                </div>
                <button
                  onClick={() => addBlankMainLesson(selectedDayIdx)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#0B6E5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085A4B]"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm tiết HĐ có chủ đích
                </button>
              </div>

              {/* Outdoor observation + Extracurricular */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">B. Quan sát HĐ ngoài trời ({currentDay.dayLabel})</label>
                  <input
                    value={currentDay.outdoorObservation}
                    onChange={(e) => updateDay(selectedDayIdx, { outdoorObservation: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">E1. Hoạt động ngoại khóa (HĐNK chiều, nếu có)</label>
                  <input
                    value={currentDay.extracurricularTitle}
                    onChange={(e) => updateDay(selectedDayIdx, { extracurricularTitle: e.target.value })}
                    placeholder="VD: HĐNK: Học nhảy Aerobic / Học toán Soroban"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Main Lessons (1-2 periods) */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wide text-[#0B6E5C]">
                  C. Hoạt động có chủ đích ({currentDay.mainLessons.length} tiết)
                </div>
                {currentDay.mainLessons.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                    Chưa có tiết học nào cho {currentDay.dayLabel}. Hãy bấm <strong>“+ Chèn vào {currentDay.dayLabel}”</strong> từ thanh gợi ý bên phải hoặc bấm “Thêm tiết” ở trên!
                  </div>
                )}

                {currentDay.mainLessons.map((les, lIdx) => (
                  <div key={les.id} className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-[#0B6E5C] px-2 py-0.5 text-xs font-bold text-white">
                          Tiết {lIdx + 1}
                        </span>
                        <select
                          value={les.subjectCode}
                          onChange={(e) => {
                            const found = SUBJECT_PRESETS.find((p) => p.code === e.target.value);
                            updateMainLesson(selectedDayIdx, lIdx, {
                              subjectCode: e.target.value,
                              subjectFullTitle: found?.full || les.subjectFullTitle,
                              domainTitle: found?.domain || les.domainTitle,
                            });
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          {SUBJECT_PRESETS.map((p) => (
                            <option key={p.code} value={p.code}>{p.code}</option>
                          ))}
                        </select>
                        {les.linkedMtCodes.map((c) => (
                          <span key={c} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                            {c}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const next = currentDay.mainLessons.filter((_, i) => i !== lIdx);
                          updateDay(selectedDayIdx, { mainLessons: next });
                        }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Xóa tiết này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">Đề tài chính</label>
                        <input
                          value={les.topicTitle}
                          onChange={(e) => updateMainLesson(selectedDayIdx, lIdx, { topicTitle: e.target.value })}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">Nội dung kết hợp (VD: Nghe hát, TCVĐ — mỗi dòng 1 ý)</label>
                        <input
                          value={les.subTopics.join(' | ')}
                          onChange={(e) =>
                            updateMainLesson(selectedDayIdx, lIdx, {
                              subTopics: e.target.value ? e.target.value.split('|').map((s) => s.trim()) : [],
                            })
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">I. Mục đích – Yêu cầu (mỗi dòng 1 ý)</label>
                        <textarea
                          rows={3}
                          value={les.aims.join('\n')}
                          onChange={(e) => updateMainLesson(selectedDayIdx, lIdx, { aims: linesToArray(e.target.value) })}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">II. Chuẩn bị (mỗi dòng 1 ý)</label>
                        <textarea
                          rows={3}
                          value={les.preparation.join('\n')}
                          onChange={(e) => updateMainLesson(selectedDayIdx, lIdx, { preparation: linesToArray(e.target.value) })}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500">III. Tổ chức hoạt động (các bước tiến hành):</div>
                      {les.steps.map((st, sIdx) => (
                        <div key={sIdx} className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <input
                            value={st.title}
                            onChange={(e) => {
                              const steps = les.steps.map((x, i) => (i === sIdx ? { ...x, title: e.target.value } : x));
                              updateMainLesson(selectedDayIdx, lIdx, { steps });
                            }}
                            className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                          />
                          <textarea
                            rows={2}
                            value={st.details.join('\n')}
                            onChange={(e) => {
                              const steps = les.steps.map((x, i) => (i === sIdx ? { ...x, details: linesToArray(e.target.value) } : x));
                              updateMainLesson(selectedDayIdx, lIdx, { steps });
                            }}
                            className="mt-1 w-full rounded border border-slate-100 bg-slate-50 p-1.5 text-xs text-slate-700"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Afternoon Lesson */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase text-slate-700">E2. Giáo án mini Hoạt động chiều</div>
                  {!currentDay.afternoonLesson && (
                    <button
                      onClick={() =>
                        updateDay(selectedDayIdx, {
                          afternoonLesson: {
                            id: `aft_${Date.now()}`,
                            slotType: 'AFTERNOON',
                            domainTitle: 'HOẠT ĐỘNG CHIỀU',
                            subjectCode: 'KNS',
                            subjectFullTitle: 'RÈN KỸ NĂNG / ÔN LUYỆN CHIỀU',
                            topicTitle: 'Ôn thơ, bài hát & rèn kỹ năng tự phục vụ',
                            subTopics: [],
                            linkedMtCodes: [],
                            aims: ['Củng cố kiến thức đã học trong ngày và rèn kỹ năng tự phục vụ.'],
                            preparation: ['Đồ dùng, tranh ảnh liên quan.'],
                            steps: [
                              { title: 'Hoạt động 1: Ổn định', details: ['Hát và trò chuyện dẫn dắt vào hoạt động.'] },
                              { title: 'Hoạt động 2: Thực hành', details: ['Trẻ thực hành theo nhóm và cá nhân dưới sự hướng dẫn của cô.'] },
                            ],
                          },
                        })
                      }
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#0B6E5C] ring-1 ring-slate-200"
                    >
                      + Thêm giáo án chiều
                    </button>
                  )}
                </div>
                {currentDay.afternoonLesson && (
                  <div className="mt-2 space-y-2">
                    <input
                      value={currentDay.afternoonLesson.topicTitle}
                      onChange={(e) =>
                        updateDay(selectedDayIdx, {
                          afternoonLesson: { ...currentDay.afternoonLesson!, topicTitle: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
                    />
                    <textarea
                      rows={2}
                      value={currentDay.afternoonLesson.aims.join('\n')}
                      onChange={(e) =>
                        updateDay(selectedDayIdx, {
                          afternoonLesson: { ...currentDay.afternoonLesson!, aims: linesToArray(e.target.value) },
                        })
                      }
                      placeholder="Mục đích – yêu cầu buổi chiều..."
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Daily Evaluation (3 mandatory BGD criteria) */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="text-xs font-bold uppercase text-amber-900">
                  Đánh giá cuối ngày (3 tiêu chí bắt buộc chuẩn BGD — để trống nếu muốn in dòng chấm viết tay)
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">1. Tình trạng sức khỏe</label>
                    <textarea
                      rows={2}
                      value={currentDay.evalHealth}
                      onChange={(e) => updateDay(selectedDayIdx, { evalHealth: e.target.value })}
                      placeholder="VD: Sĩ số 30/30, trẻ khỏe mạnh..."
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">2. Cảm xúc, thái độ, hành vi</label>
                    <textarea
                      rows={2}
                      value={currentDay.evalEmotionBehavior}
                      onChange={(e) => updateDay(selectedDayIdx, { evalEmotionBehavior: e.target.value })}
                      placeholder="VD: Trẻ vui vẻ, hào hứng tham gia..."
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">3. Kiến thức, kỹ năng</label>
                    <textarea
                      rows={2}
                      value={currentDay.evalKnowledgeSkill}
                      onChange={(e) => updateDay(selectedDayIdx, { evalKnowledgeSkill: e.target.value })}
                      placeholder="VD: 90% trẻ thực hiện tốt VĐCB..."
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Suggestion Right Sidebar (4 cols) */}
          <div className="xl:col-span-4">
            <div className="sticky top-20 flex max-h-[calc(100vh-110px)] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[#0B6E5C]">
                  <Sparkles className="h-4 w-4" /> Gợi ý cho {currentDay.dayLabel}
                </div>
                <span className="text-[11px] text-slate-400">{ageObjectives.length} MT</span>
              </div>

              <div className="mt-2 flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setSidebarSource('excel')}
                  className={`flex-1 rounded-lg py-1.5 transition ${
                    sidebarSource === 'excel' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Kho chuẩn Excel
                </button>
                <button
                  onClick={() => setSidebarSource('crawled')}
                  className={`flex-1 rounded-lg py-1.5 transition ${
                    sidebarSource === 'crawled' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Database className="mr-1 inline h-3 w-3" /> Kho JSON đã cào
                </button>
              </div>

              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={mtSearch}
                  onChange={(e) => setMtSearch(e.target.value)}
                  placeholder="Tìm mã MT, thơ, toán, bật, vẽ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {filteredSidebarObjectives.slice(0, 35).map((obj) => {
                  const isThemeMt = selectedMtSet.has(obj.code);
                  const crawled = crawledByMt[obj.code];
                  if (sidebarSource === 'crawled' && (!crawled || !crawled.topLessons?.length)) {
                    return null;
                  }
                  return (
                    <div
                      key={obj.id}
                      className={`rounded-xl border p-3 text-xs ${
                        isThemeMt ? 'border-[#0B6E5C]/50 bg-[#F0FAF8]' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="rounded bg-[#0B6E5C] px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {obj.code}
                        </span>
                        {isThemeMt && (
                          <span className="text-[10px] font-bold text-[#0B6E5C]">★ MT của chủ đề</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 font-medium text-slate-800">{obj.description}</p>

                      {sidebarSource === 'excel' ? (
                        <div className="mt-2 space-y-1">
                          {obj.activities.slice(0, 3).map((act) => (
                            <div key={act.id} className="rounded-lg bg-white p-2 ring-1 ring-slate-200/80">
                              <div className="text-[10px] font-bold text-[#074F42]">{act.type}</div>
                              <div className="mt-0.5 text-[11px] text-slate-700">{act.text}</div>
                              <button
                                onClick={() => insertActivityIntoCurrentDay(obj, act)}
                                className="mt-1.5 inline-flex items-center gap-1 rounded bg-[#E6F4F1] px-2 py-0.5 text-[11px] font-semibold text-[#0B6E5C] hover:bg-emerald-200"
                              >
                                <Plus className="h-3 w-3" /> Chèn vào {currentDay.dayLabel}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1">
                          {crawled?.topLessons?.slice(0, 4).map((l, idx) => (
                            <div key={idx} className="rounded-lg bg-white p-2 ring-1 ring-amber-200/80">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-amber-900">[{l.subject}]</span>
                                <span className="text-slate-400">{l.school}</span>
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium text-slate-800">{l.topic}</div>
                              <button
                                onClick={() => insertCrawledIntoCurrentDay(obj, l)}
                                className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
                              >
                                <Plus className="h-3 w-3" /> Chèn vào {currentDay.dayLabel}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sidebarSource === 'crawled' && Object.keys(crawledByMt).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                    Kho JSON từ hơn 1.000 tài liệu đang được phân loại nền. Sau khi hoàn tất, các đề tài thực tế khớp từng mã MT sẽ tự hiển thị tại đây!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: A4 PREVIEW & PRE-FLIGHT QUALITY CHECK */}
      {tab === 'preview' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kiểm tra chất lượng hồ sơ trước khi xuất chuẩn Bộ GD&ĐT</h3>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động rà soát tính nhất quán ngày tháng, độ phủ MT, khối dùng chung tuần và cấu trúc 5 ngày.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onExportDocx(plan)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B6E5C] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#085A4B]"
                >
                  <FileText className="h-4 w-4" /> Tải ngay file Word chuẩn BGD (.docx)
                </button>
                <button
                  onClick={() => onExportXlsx(plan)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Xuất bảng Excel (.xlsx)
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {qualityChecks.map((qc, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                    qc.ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  {qc.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">{qc.label}</div>
                    <div className="text-[11px] text-slate-600">{qc.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DocPreview plan={plan} objectives={dataset.objectives} />
        </div>
      )}
    </div>
  );
};
