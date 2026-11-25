import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type {
  AgeGroupId,
  DomainKey,
  ObjectiveItem,
  ObjectivesDataset,
  WeeklyPlanDocument,
} from '../../shared/types';
import { domainToKey, normVN } from '../utils/helpers';
import { extractPlanMonthLabel, scoreThemeRelevance } from '../utils/themeRelevance';
import { DOMAIN_VISUALS, getDomainVisual, getSubjectVisual } from '../utils/visualMeta';

export interface DistilledItem {
  subject: string;
  topic: string;
  type: string;
  slotType: string;
  cornerSubType?: string;
  score: number;
  docCount: number;
  schoolCount?: number;
  schools?: string[];
  school: string;
  docId: number;
  postUrl?: string;
}

export interface DistilledMtBucket {
  code: string;
  docCount: number;
  lessonCount: number;
  topLessons: DistilledItem[];
  distilled?: {
    mainLessons: DistilledItem[];
    cornerActivities: DistilledItem[];
    routinesAndOutdoor: DistilledItem[];
  };
}

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  focusMtCode?: string;
  onToggleMt: (domainKey: DomainKey, code: string) => void;
  onScheduleLessonToDay: (
    dayIdx: number,
    topic: string,
    subject: string,
    mtCode: string,
    obj: ObjectiveItem
  ) => void;
  onAddCornerIdea: (cornerSubType: string, topic: string) => void;
  onAddRoutineOrOutdoor: (slotType: string, topic: string) => void;
  onSwitchGrade?: (ageGroupId: AgeGroupId) => void;
  onClose?: () => void;
}

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

export const MtByGradeGuidePanel: React.FC<Props> = ({
  plan,
  dataset,
  focusMtCode,
  onToggleMt,
  onScheduleLessonToDay,
  onAddCornerIdea,
  onAddRoutineOrOutdoor,
  onSwitchGrade,
  onClose,
}) => {
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [prioritizeTheme, setPrioritizeTheme] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [expandedMtId, setExpandedMtId] = useState<string>('');
  const [kbByMt, setKbByMt] = useState<Record<string, DistilledMtBucket>>({});
  const [loadingKb, setLoadingKb] = useState(false);

  const planMonthLabel = useMemo(() => extractPlanMonthLabel(plan.weekStartDate), [plan.weekStartDate]);

  const isNhaTre = plan.ageGroupId === 'NHA_TRE_24_36T';
  const activeDomainVisuals = useMemo(
    () => (isNhaTre ? DOMAIN_VISUALS.filter((d) => d.key !== 'PTTM') : DOMAIN_VISUALS),
    [isNhaTre]
  );

  const scheduledTopicDays = useMemo(() => {
    const map = new Map<string, string>();
    plan.days.forEach((d) => {
      d.mainLessons.forEach((l) => {
        map.set(normVN(l.topicTitle).slice(0, 42), d.dayLabel);
      });
    });
    return map;
  }, [plan.days]);

  useEffect(() => {
    setDomainFilter('ALL');
    setMonthFilter('ALL');
    setExpandedMtId('');
    setLoadingKb(true);
    fetch(`/api/kb/suggestions?ageGroupId=${plan.ageGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setKbByMt(d.byMt);
        else setKbByMt({});
      })
      .catch(() => setKbByMt({}))
      .finally(() => setLoadingKb(false));
  }, [plan.ageGroupId]);

  const gradeObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  useEffect(() => {
    if (!focusMtCode) return;
    setDomainFilter('ALL');
    setMonthFilter('ALL');
    setSearch(focusMtCode);
    const matched = gradeObjectives.find((o) => o.code.toUpperCase() === focusMtCode.toUpperCase());
    if (matched) setExpandedMtId(matched.id);
  }, [focusMtCode, gradeObjectives]);

  const availableMonths = useMemo(
    () => Array.from(new Set(gradeObjectives.map((o) => o.month).filter(Boolean))),
    [gradeObjectives]
  );

  const attachedMtSet = useMemo(() => {
    const s = new Set<string>();
    plan.themeObjectives.forEach((b) => b.mtCodes.forEach((c) => s.add(c)));
    return s;
  }, [plan.themeObjectives]);

  const scoredObjectives = useMemo(() => {
    const q = normVN(search);
    return gradeObjectives
      .filter((o) => {
        if (monthFilter !== 'ALL' && o.month !== monthFilter) return false;
        const dk = isNhaTre && domainToKey(o.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(o.domain);
        if (domainFilter !== 'ALL' && dk !== domainFilter) return false;
        if (q) {
          const kb = kbByMt[o.code];
          const kbText = (kb?.topLessons || []).map((l) => `${l.subject} ${l.topic}`).join(' ');
          const hay = normVN(`${o.code} ${o.description} ${o.theme} ${o.activities.map((a) => a.text).join(' ')} ${kbText}`);
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((obj) => {
        const kb = kbByMt[obj.code];
        const sampleText = `${obj.theme} ${obj.description} ${obj.eduContent} ${obj.activities.map((a) => a.text).join(' ')} ${(kb?.topLessons || []).slice(0, 3).map((l) => l.topic).join(' ')}`;
        const rel = scoreThemeRelevance(
          sampleText,
          plan.themeName,
          plan.subThemeName,
          obj.month,
          plan.weekStartDate
        );
        return { obj, rel };
      })
      .sort((a, b) => {
        if (prioritizeTheme) {
          if (a.rel.isSeasonalConflict !== b.rel.isSeasonalConflict) {
            return a.rel.isSeasonalConflict ? 1 : -1;
          }
          if (a.rel.score !== b.rel.score) return b.rel.score - a.rel.score;
        }
        const aUsed = attachedMtSet.has(a.obj.code) ? 1 : 0;
        const bUsed = attachedMtSet.has(b.obj.code) ? 1 : 0;
        if (aUsed !== bUsed) return bUsed - aUsed;
        return (kbByMt[b.obj.code]?.lessonCount || 0) - (kbByMt[a.obj.code]?.lessonCount || 0);
      });
  }, [
    gradeObjectives,
    monthFilter,
    domainFilter,
    search,
    kbByMt,
    attachedMtSet,
    isNhaTre,
    prioritizeTheme,
    plan.themeName,
    plan.subThemeName,
    plan.weekStartDate,
  ]);

  useEffect(() => {
    if (!expandedMtId && scoredObjectives.length > 0) {
      setExpandedMtId(scoredObjectives[0].obj.id);
    }
  }, [scoredObjectives, expandedMtId]);

  const currentAgeMeta = dataset.ageGroups.find((g) => g.id === plan.ageGroupId);

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-white">
      {/* Clean Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Gợi ý theo Mục tiêu — {currentAgeMeta?.name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Chọn mục tiêu để xem đề xuất chiết lọc từ giáo án trường và xếp vào lịch tuần.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Clean Grade Switcher + Search & Month Filter */}
      <div className="space-y-3 border-b border-slate-100 px-5 py-3.5">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {dataset.ageGroups.map((ag) => {
            const active = ag.id === plan.ageGroupId;
            return (
              <button
                key={ag.id}
                onClick={() => onSwitchGrade?.(ag.id)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-[#0B6E5C] text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {ag.short}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã MT, bài hát, thơ..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700"
          >
            <option value="ALL">Mọi tháng</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Live 5-day status strip so teacher sees empty/filled days at a glance */}
        <div className="flex items-center justify-between gap-1 rounded-xl bg-slate-50 px-2.5 py-2">
          <div className="flex items-center gap-1">
            {plan.days.map((d, idx) => {
              const cnt = d.mainLessons.length;
              return (
                <span
                  key={d.dayOfWeek}
                  title={`${d.dayLabel}: ${cnt} tiết chính`}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    cnt > 0
                      ? 'bg-[#E6F4F1] text-[#0B6E5C]'
                      : 'bg-white text-slate-400 ring-1 ring-slate-200'
                  }`}
                >
                  T{idx + 2}:{cnt}
                </span>
              );
            })}
          </div>
          <button
            onClick={() => setPrioritizeTheme((v) => !v)}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
              prioritizeTheme
                ? 'bg-emerald-100 text-[#0B6E5C]'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {prioritizeTheme ? `★ Ưu tiên: ${plan.subThemeName.slice(0, 16)}` : 'Ưu tiên chủ đề: Tắt'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setDomainFilter('ALL')}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              domainFilter === 'ALL' ? 'bg-[#0B6E5C] text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Tất cả
          </button>
          {activeDomainVisuals.map((dv) => {
            const active = domainFilter === dv.key;
            const lbl = isNhaTre && dv.key === 'PT_TCKNXH' ? 'TC–KNXH & TM' : dv.short;
            return (
              <button
                key={dv.key}
                onClick={() => setDomainFilter(active ? 'ALL' : dv.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  active ? 'bg-[#0B6E5C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Clean MT Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/60 p-4">
        {loadingKb && (
          <div className="py-6 text-center text-xs text-slate-400">Đang tải gợi ý theo khối...</div>
        )}

        {scoredObjectives.slice(0, 40).map(({ obj, rel }) => {
          const dv = getDomainVisual(obj.domain);
          const dk: DomainKey =
            isNhaTre && domainToKey(obj.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(obj.domain);
          const isAttached = attachedMtSet.has(obj.code);
          const isOpen = expandedMtId === obj.id;
          const kb = kbByMt[obj.code];
          const mainDistilled = [...(kb?.distilled?.mainLessons || [])].sort(
            (x, y) =>
              scoreThemeRelevance(y.topic, plan.themeName, plan.subThemeName, '', plan.weekStartDate).score -
              scoreThemeRelevance(x.topic, plan.themeName, plan.subThemeName, '', plan.weekStartDate).score
          );
          const cornerDistilled = kb?.distilled?.cornerActivities || [];
          const routineDistilled = kb?.distilled?.routinesAndOutdoor || [];
          const sortedStdActs = [...obj.activities].sort(
            (x, y) =>
              scoreThemeRelevance(`${obj.theme} ${y.text}`, plan.themeName, plan.subThemeName, obj.month, plan.weekStartDate).score -
              scoreThemeRelevance(`${obj.theme} ${x.text}`, plan.themeName, plan.subThemeName, obj.month, plan.weekStartDate).score
          );

          return (
            <div
              key={obj.id}
              className={`rounded-xl border border-l-4 ${dv.borderClass} bg-white transition ${
                isOpen ? 'border-slate-300 shadow-xs' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                onClick={() => setExpandedMtId(isOpen ? '' : obj.id)}
                className="cursor-pointer p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-[#0B6E5C]">{obj.code}</span>
                    <span className="text-xs text-slate-400">{obj.month}</span>
                    {rel.matchesTheme && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                        Khớp chủ đề
                      </span>
                    )}
                    {rel.matchesMonth && planMonthLabel && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-200">
                        Đúng {planMonthLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMt(dk, obj.code);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        isAttached
                          ? 'bg-[#E6F4F1] text-[#0B6E5C]'
                          : 'bg-slate-100 text-slate-600 hover:bg-[#0B6E5C] hover:text-white'
                      }`}
                    >
                      {isAttached ? 'Đã gắn' : 'Gắn MT'}
                    </button>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug font-semibold text-slate-900">
                  {obj.description}
                </p>
              </div>

              {isOpen && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-3.5">
                  {/* Distilled Real Suggestions */}
                  {mainDistilled.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700">
                        Chiết lọc từ giáo án thực tế ({kb?.docCount || 0} tài liệu)
                      </div>
                      {mainDistilled.slice(0, 4).map((item, idx) => {
                        const sv = getSubjectVisual(item.subject);
                        const already = scheduledTopicDays.get(normVN(item.topic).slice(0, 42));
                        return (
                          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                                {item.subject}
                              </span>
                              {already ? (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  ✓ Đã xếp {already}
                                </span>
                              ) : (
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value !== '') {
                                      onScheduleLessonToDay(
                                        Number(e.target.value),
                                        item.topic,
                                        item.subject,
                                        obj.code,
                                        obj
                                      );
                                      e.target.value = '';
                                    }
                                  }}
                                  className="rounded-lg border border-[#0B6E5C]/30 bg-[#E6F4F1] px-2 py-1 text-xs font-semibold text-[#0B6E5C] focus:outline-none"
                                >
                                  <option value="" disabled>
                                    + Xếp vào ngày...
                                  </option>
                                  {DAY_NAMES.map((dn, dIdx) => (
                                    <option key={dn} value={dIdx}>
                                      {dn}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <p className="mt-1.5 text-[13px] leading-snug font-medium text-slate-900">
                              {item.topic}
                            </p>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {item.school}
                              {(item.schoolCount || 1) > 1 ? ` · ${item.schoolCount} trường dùng` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Corner & Routine quick picks (compact) */}
                  {(cornerDistilled.length > 0 || routineDistilled.length > 0) && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700">Góc chơi &amp; Sinh hoạt thực tế</div>
                      {cornerDistilled.slice(0, 2).map((c, idx) => (
                        <div key={`c_${idx}`} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
                          <span className="text-slate-700">{c.topic}</span>
                          <button
                            onClick={() => onAddCornerIdea(c.cornerSubType || 'Góc phân vai', c.topic)}
                            className="shrink-0 font-semibold text-[#0B6E5C] hover:underline"
                          >
                            + Góc
                          </button>
                        </div>
                      ))}
                      {routineDistilled.slice(0, 2).map((r, idx) => (
                        <div key={`r_${idx}`} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
                          <span className="text-slate-700">{r.topic}</span>
                          <button
                            onClick={() => onAddRoutineOrOutdoor(r.slotType, r.topic)}
                            className="shrink-0 font-semibold text-[#0B6E5C] hover:underline"
                          >
                            + Tuần
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Standard BGD Activities */}
                  <div className="space-y-2 border-t border-slate-200/70 pt-3">
                    <div className="text-xs font-bold text-slate-700">Đề xuất chuẩn khung BGD</div>
                    {sortedStdActs.slice(0, 3).map((act) => (
                      <div key={act.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">{act.type}</span>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value !== '') {
                                onScheduleLessonToDay(
                                  Number(e.target.value),
                                  act.text,
                                  act.type,
                                  obj.code,
                                  obj
                                );
                                e.target.value = '';
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
                          >
                            <option value="" disabled>
                              + Xếp vào ngày...
                            </option>
                            {DAY_NAMES.map((dn, dIdx) => (
                              <option key={dn} value={dIdx}>
                                {dn}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="mt-1.5 text-[13px] leading-snug text-slate-800">{act.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
