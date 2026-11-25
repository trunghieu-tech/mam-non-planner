import React, { useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { AgeGroupId, ObjectivesDataset, WeeklyPlanDocument } from '../../shared/types';
import { fmtDateVN } from '../utils/helpers';

interface CrawledSummary {
  available: boolean;
  totalDocs: number;
  totalLessons: number;
  totalSchools: number;
  byAgeGroup: Record<string, number>;
}

interface Props {
  dataset: ObjectivesDataset;
  plans: WeeklyPlanDocument[];
  selectedAgeGroup: AgeGroupId;
  onSelectAgeGroup: (id: AgeGroupId) => void;
  crawledSummary: CrawledSummary;
  onOpenPlan: (id: string) => void;
  onCreateNewPlan: () => void;
  onDuplicatePlan: (plan: WeeklyPlanDocument) => void;
  onDeletePlan: (id: string) => void;
  onExportDocx: (plan: WeeklyPlanDocument) => void;
  onExportXlsx: (plan: WeeklyPlanDocument) => void;
  onGoToTab: (tab: 'bank' | 'crawled') => void;
}

const MONTHS = ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Xuyên suốt'];

export const DashboardView: React.FC<Props> = ({
  dataset,
  plans,
  selectedAgeGroup,
  onSelectAgeGroup,
  crawledSummary,
  onOpenPlan,
  onCreateNewPlan,
  onDuplicatePlan,
  onDeletePlan,
  onExportDocx,
  onExportXlsx,
  onGoToTab,
}) => {
  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === selectedAgeGroup),
    [dataset, selectedAgeGroup]
  );

  const agePlans = useMemo(
    () => plans.filter((p) => p.ageGroupId === selectedAgeGroup),
    [plans, selectedAgeGroup]
  );

  // Covered MT codes across plans of this age group
  const coveredMtSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of agePlans) {
      for (const b of p.themeObjectives) for (const c of b.mtCodes) s.add(c);
      for (const d of p.days) {
        for (const l of d.mainLessons) for (const c of l.linkedMtCodes) s.add(c);
        if (d.afternoonLesson) for (const c of d.afternoonLesson.linkedMtCodes) s.add(c);
      }
    }
    return s;
  }, [agePlans]);

  const domainStats = useMemo(() => {
    const map = new Map<string, { domain: string; total: number; covered: number; activities: number }>();
    for (const o of ageObjectives) {
      const cur = map.get(o.domain) || { domain: o.domain, total: 0, covered: 0, activities: 0 };
      cur.total += 1;
      if (coveredMtSet.has(o.code)) cur.covered += 1;
      cur.activities += o.activities.length;
      map.set(o.domain, cur);
    }
    return Array.from(map.values());
  }, [ageObjectives, coveredMtSet]);

  const monthStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of MONTHS) counts.set(m, 0);
    for (const o of ageObjectives) {
      counts.set(o.month, (counts.get(o.month) || 0) + 1);
    }
    return MONTHS.map((m) => ({ month: m, count: counts.get(m) || 0 }));
  }, [ageObjectives]);

  const totalActivitiesForAge = useMemo(
    () => ageObjectives.reduce((acc, o) => acc + o.activities.length, 0),
    [ageObjectives]
  );

  return (
    <div className="space-y-6">
      {/* Hero & Age Group Selector */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1D4ED8] via-[#0F846E] to-[#139B82] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-50">
              <Sparkles className="h-3.5 w-3.5" /> Chuẩn Chương trình GDMN 01/VBHN-BGDĐT & NĐ 30/2020/NĐ-CP
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Hệ thống Quản lý & Soạn Kế hoạch Giáo dục Mầm non
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-50/90">
              Nhập 1 lần ở cấp Chủ đề & Tuần — tự đồng bộ 5 ngày, gợi ý hoạt động theo đúng 345 Mục tiêu và kho tài liệu thực tế đã cào JSON, xuất file Word (.docx) chuẩn Bộ GD&ĐT trong 1 click.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCreateNewPlan}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1D4ED8] shadow-sm transition hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" /> Tạo kế hoạch tuần mới
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {dataset.ageGroups.map((ag) => {
            const active = ag.id === selectedAgeGroup;
            return (
              <button
                key={ag.id}
                onClick={() => onSelectAgeGroup(ag.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-white text-[#1D4ED8] shadow-sm'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {ag.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mục tiêu khối đang chọn</span>
            <BookOpen className="h-5 w-5 text-[#1D4ED8]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{ageObjectives.length} MT</div>
          <p className="mt-1 text-xs text-slate-500">
            Tổng toàn trường: <strong>{dataset.totalObjectives} MT</strong> ({totalActivitiesForAge} hoạt động đề xuất khối này)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Độ phủ MT trong KH</span>
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {coveredMtSet.size}{' '}
            <span className="text-base font-medium text-slate-400">/ {ageObjectives.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Đạt <strong>{ageObjectives.length ? Math.round((coveredMtSet.size / ageObjectives.length) * 100) : 0}%</strong> trên {agePlans.length} kế hoạch tuần của khối
          </p>
        </div>

        <div
          onClick={() => onGoToTab('crawled')}
          className="cursor-pointer rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs transition hover:border-[#1D4ED8]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">Kho JSON đã cào & Map MT</span>
            <Database className="h-5 w-5 text-[#1D4ED8]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-[#1E3A8A]">
            {crawledSummary.available ? crawledSummary.totalDocs.toLocaleString('vi-VN') : 'Đang cào...'}
          </div>
          <p className="mt-1 text-xs text-blue-900/80">
            {crawledSummary.available
              ? `${crawledSummary.totalLessons.toLocaleString('vi-VN')} bài dạy từ ${crawledSummary.totalSchools} trường • Bấm để tra cứu`
              : 'Pipeline đang thu thập hơn 1.000 tài liệu thực tế (.docx/.pdf)'}
          </p>
        </div>

        <div
          onClick={() => onGoToTab('bank')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#1D4ED8]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngân hàng hoạt động chuẩn</span>
            <Layers className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {dataset.totalActivities.toLocaleString('vi-VN')}
          </div>
          <p className="mt-1 text-xs text-slate-500">Hoạt động đề xuất 01/VBHN-BGDĐT đã gắn sẵn 345 MT</p>
        </div>
      </div>

      {/* Plans List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh sách Kế hoạch Giáo dục Tuần ({plans.length})</h2>
            <p className="text-xs text-slate-500">Mở trực tiếp bản mẫu Lớp Lá (Trường MN Hoàng Gia) để chỉnh sửa hoặc xuất Word chuẩn BGD ngay.</p>
          </div>
          <button
            onClick={onCreateNewPlan}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            <Plus className="h-4 w-4" /> Thêm kế hoạch tuần
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((p) => {
            const lessonCount = p.days.reduce((s, d) => s + d.mainLessons.length, 0);
            const ag = dataset.ageGroups.find((g) => g.id === p.ageGroupId);
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-[#1D4ED8]/50 hover:bg-white"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8]">
                      {ag?.name || p.ageGroupId} • Lớp {p.className}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : p.status === 'PENDING_REVIEW'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.status === 'APPROVED' ? 'Đã duyệt BGH' : p.status === 'PENDING_REVIEW' ? 'Chờ duyệt' : 'Bản nháp'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-slate-900">
                    Tuần {p.weekNumber}: {p.subThemeName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Chủ đề: <strong>{p.themeName}</strong> • {fmtDateVN(p.weekStartDate)} – {fmtDateVN(p.weekEndDate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.schoolName} • GV: {p.teacherName} • {lessonCount} tiết chính + {p.days.filter((d) => d.afternoonLesson).length} giáo án chiều
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
                  <button
                    onClick={() => onOpenPlan(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Mở trình soạn
                  </button>
                  <button
                    onClick={() => onExportDocx(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    <FileText className="h-3.5 w-3.5" /> Xuất Word BGD (.docx)
                  </button>
                  <button
                    onClick={() => onExportXlsx(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </button>
                  <button
                    onClick={() => onDuplicatePlan(p)}
                    title="Nhân bản sang tuần kế tiếp"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" /> Nhân bản
                  </button>
                  {plans.length > 1 && (
                    <button
                      onClick={() => onDeletePlan(p.id)}
                      title="Xóa kế hoạch"
                      className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coverage Matrix & 9-Month Allocation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Phân bổ 5 Lĩnh vực phát triển ({dataset.ageGroups.find((g) => g.id === selectedAgeGroup)?.name})</h3>
          <div className="mt-4 space-y-3.5">
            {domainStats.map((ds) => {
              const pct = ds.total ? Math.round((ds.covered / ds.total) * 100) : 0;
              return (
                <div key={ds.domain}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{ds.domain}</span>
                    <span className="text-slate-500">
                      Đã dùng <strong>{ds.covered}/{ds.total}</strong> MT ({ds.activities} HĐ gợi ý)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#1D4ED8] transition-all"
                      style={{ width: `${Math.max(pct, ds.covered > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Phân bổ Mục tiêu theo 9 Tháng năm học (từ file Excel chuẩn)</h3>
          <div className="mt-4 grid grid-cols-5 gap-2.5">
            {monthStats.map((ms) => (
              <div
                key={ms.month}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center"
              >
                <div className="text-[11px] font-medium text-slate-500">{ms.month}</div>
                <div className="mt-1 text-lg font-bold text-[#1D4ED8]">{ms.count}</div>
                <div className="text-[10px] text-slate-400">mục tiêu</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
