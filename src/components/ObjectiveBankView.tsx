import React, { useEffect, useMemo, useState } from 'react';
import type { AgeGroupId, ObjectiveItem, ObjectivesDataset, SuggestedActivity } from '../../shared/types';
import { domainToKey, normVN } from '../utils/helpers';
import { DOMAIN_VISUALS, getDomainVisual, getSubjectVisual } from '../utils/visualMeta';

interface DistilledRow {
  subject: string;
  topic: string;
  type: string;
  slotType?: string;
  cornerSubType?: string;
  school: string;
  schoolCount?: number;
  schools?: string[];
  score: number;
}

interface CrawledMtEntry {
  docCount: number;
  lessonCount: number;
  topLessons: DistilledRow[];
  distilled?: {
    mainLessons: DistilledRow[];
    cornerActivities: DistilledRow[];
    routinesAndOutdoor: DistilledRow[];
  };
}

interface Props {
  dataset: ObjectivesDataset;
  selectedAgeGroup: AgeGroupId;
  onSelectAgeGroup: (id: AgeGroupId) => void;
  activePlanTitle?: string;
  onInsertActivityToPlan: (obj: ObjectiveItem, act: SuggestedActivity) => void;
  onAttachMtToPlan: (obj: ObjectiveItem) => void;
}

export const ObjectiveBankView: React.FC<Props> = ({
  dataset,
  selectedAgeGroup,
  onSelectAgeGroup,
  activePlanTitle,
  onInsertActivityToPlan,
  onAttachMtToPlan,
}) => {
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [crawledByMt, setCrawledByMt] = useState<Record<string, CrawledMtEntry>>({});

  useEffect(() => {
    fetch(`/api/kb/suggestions?ageGroupId=${selectedAgeGroup}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setCrawledByMt(d.byMt);
        else setCrawledByMt({});
      })
      .catch(() => setCrawledByMt({}));
  }, [selectedAgeGroup]);

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === selectedAgeGroup),
    [dataset, selectedAgeGroup]
  );

  const months = useMemo(
    () => Array.from(new Set(ageObjectives.map((o) => o.month))),
    [ageObjectives]
  );

  const isNhaTre = selectedAgeGroup === 'NHA_TRE_24_36T';
  const activeDomainVisuals = useMemo(
    () => (isNhaTre ? DOMAIN_VISUALS.filter((d) => d.key !== 'PTTM') : DOMAIN_VISUALS),
    [isNhaTre]
  );

  const gradeMtCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of dataset.objectives) {
      map[o.ageGroupId] = (map[o.ageGroupId] || 0) + 1;
    }
    return map;
  }, [dataset.objectives]);

  const domainCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of ageObjectives) {
      const k = isNhaTre && domainToKey(o.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(o.domain);
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [ageObjectives, isNhaTre]);

  const filtered = useMemo(() => {
    const q = normVN(search);
    return ageObjectives.filter((o) => {
      const dk = isNhaTre && domainToKey(o.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(o.domain);
      if (domainFilter !== 'ALL' && dk !== domainFilter) return false;
      if (monthFilter !== 'ALL' && o.month !== monthFilter) return false;
      if (q) {
        const hay = normVN(
          `${o.code} ${o.domain} ${o.subGroup} ${o.description} ${o.theme} ${o.eduContent} ${o.activities.map((a) => `${a.type} ${a.text}`).join(' ')}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ageObjectives, domainFilter, monthFilter, search, isNhaTre]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Kho 345 Mục tiêu (MT) & 1.382 Hoạt động đề xuất chuẩn BGD
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Phân màu trực quan theo 5 lĩnh vực phát triển — bấm chèn trực tiếp vào con trỏ Word.
              {activePlanTitle && (
                <span className="ml-1.5 rounded bg-[#DBEAFE] px-2 py-0.5 font-semibold text-[#1D4ED8]">
                  Đang soạn: {activePlanTitle}
                </span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {dataset.ageGroups.map((ag) => (
              <button
                key={ag.id}
                onClick={() => {
                  onSelectAgeGroup(ag.id);
                  setDomainFilter('ALL');
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  ag.id === selectedAgeGroup
                    ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs font-bold">{ag.short}</div>
                <div className={`text-[10px] ${ag.id === selectedAgeGroup ? 'text-blue-100' : 'text-slate-400'}`}>
                  {gradeMtCounts[ag.id] || 0} MT chuẩn
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Visual 4/5-Domain Filter Strip */}
        <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 ${isNhaTre ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
          <button
            onClick={() => setDomainFilter('ALL')}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              domainFilter === 'ALL'
                ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-90">
              Tất cả ({isNhaTre ? '4 LV' : '5 LV'})
            </div>
            <div className="mt-0.5 text-lg font-bold">{ageObjectives.length} MT</div>
          </button>
          {activeDomainVisuals.map((dv) => {
            const active = domainFilter === dv.key;
            const lbl = isNhaTre && dv.key === 'PT_TCKNXH' ? 'TC–KNXH & TM' : dv.short;
            return (
              <button
                key={dv.key}
                onClick={() => setDomainFilter(active ? 'ALL' : dv.key)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active ? dv.pillActiveClass : `${dv.badgeClass} hover:opacity-90`
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : dv.dotClass}`} />
                  {lbl}
                </div>
                <div className="mt-0.5 text-lg font-bold">{domainCounts[dv.key] || 0} MT</div>
              </button>
            );
          })}
        </div>

        {/* Search + Month bar */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-9">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã MT (VD: MT15), từ khóa bài thơ, trò chơi, toán, vận động..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:col-span-3"
          >
            <option value="ALL">Tất cả các tháng</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mt-2.5 text-xs text-slate-500">
          Hiển thị <strong>{filtered.length}</strong> / {ageObjectives.length} mục tiêu
        </div>
      </div>

      {/* Color-Coded Objective Cards */}
      <div className="space-y-3">
        {filtered.map((obj) => {
          const dv = getDomainVisual(obj.domain);
          const kbEntry = crawledByMt[obj.code];
          const cleanLessons = (kbEntry?.topLessons || [])
            .filter((l) => (l.topic || '').trim().length >= 14)
            .sort((a, b) => (a.subject === 'HĐ Góc' ? 1 : 0) - (b.subject === 'HĐ Góc' ? 1 : 0));

          return (
            <div
              key={obj.id}
              className={`rounded-2xl border border-slate-200 border-l-4 ${dv.borderClass} bg-white p-5 shadow-xs`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${dv.mtBadgeClass}`}>
                    {obj.code}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dv.badgeClass}`}>
                    {obj.domain}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {obj.month} • {obj.theme}
                  </span>
                  {kbEntry && kbEntry.docCount > 0 && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      {kbEntry.docCount} tài liệu thực tế ({kbEntry.lessonCount} tiết)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAttachMtToPlan(obj)}
                  className="inline-flex items-center rounded-lg border border-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                >
                  + Chèn dòng {obj.code}
                </button>
              </div>

              <p className="mt-2.5 text-sm font-bold text-slate-900">{obj.description}</p>
              <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <strong className="text-slate-800">Nội dung GD (01/VBHN-BGDĐT):</strong> {obj.eduContent}
              </div>

              {/* Suggested Activities Grid */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <div className="text-xs font-bold text-slate-700">
                  Hoạt động đề xuất chuẩn ({obj.activities.length}):
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {obj.activities.map((act) => {
                    const sv = getSubjectVisual(act.type);
                    return (
                      <div
                        key={act.id}
                        className={`flex flex-col justify-between gap-2 rounded-xl border border-slate-200/70 ${sv.accentBg} p-3 text-xs`}
                      >
                        <div>
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${sv.chipClass}`}>
                            {act.type}
                          </span>
                          <p className="mt-1.5 leading-relaxed text-slate-800">{act.text}</p>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => onInsertActivityToPlan(obj, act)}
                            className="inline-flex items-center rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E40AF]"
                          >
                            + Chèn khung tiết vào Word
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distilled Real Suggestions from Crawled School Docs */}
              {kbEntry && (kbEntry.distilled || cleanLessons.length > 0) && (
                <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-amber-900">
                      Nội dung chiết lọc từ {kbEntry.docCount} tài liệu thực tế khớp {obj.code}:
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(kbEntry.distilled?.mainLessons?.length
                      ? kbEntry.distilled.mainLessons
                      : cleanLessons
                    )
                      .slice(0, 6)
                      .map((l, idx) => {
                        const sv = getSubjectVisual(l.subject);
                        return (
                          <div
                            key={idx}
                            className="flex flex-col justify-between gap-1.5 rounded-lg bg-white p-2.5 text-xs text-slate-700 ring-1 ring-amber-200/70"
                          >
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                                    {l.subject}
                                  </span>
                                  {(l.schoolCount || 1) > 1 && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                      {l.schoolCount} trường dùng
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {l.schools?.slice(0, 2).join(', ') || l.school}
                                </span>
                              </div>
                              <p className="mt-1 leading-snug font-medium text-slate-800">{l.topic}</p>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() =>
                                  onInsertActivityToPlan(obj, {
                                    id: `kb_${idx}`,
                                    objectiveId: obj.id,
                                    ageGroupId: obj.ageGroupId,
                                    mtCode: obj.code,
                                    domain: obj.domain,
                                    type: l.subject,
                                    text: l.topic,
                                    month: obj.month,
                                    theme: obj.theme,
                                  })
                                }
                                className="inline-flex items-center rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-700"
                              >
                                + Xếp vào lịch tuần
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
