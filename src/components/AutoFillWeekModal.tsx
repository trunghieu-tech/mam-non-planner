import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  AgeGroupId,
  DomainKey,
  LessonPlan,
  ObjectiveItem,
  ObjectivesDataset,
  WeeklyPlanDocument,
  WeeklyTimetableTemplate,
} from '../../shared/types';
import { domainToKey, normVN } from '../utils/helpers';
import { buildPedagogicalLessonPlan, resolveSubjectMeta } from '../utils/subjectTemplates';
import { scoreThemeRelevance } from '../utils/themeRelevance';
import { activityMatchesSubject, getSubjectVisual, objectiveMatchesSubject } from '../utils/visualMeta';

interface CandidateIdea {
  topic: string;
  subject: string;
  mtCode: string;
  sourceLabel: string;
  score: number;
}

interface ProposedSlot {
  dayIdx: number;
  dayLabel: string;
  subject: string;
  candidates: CandidateIdea[];
  chosenIdx: number;
}

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  timetable?: WeeklyTimetableTemplate;
  onApply: (nextPlan: WeeklyPlanDocument, msg: string) => void;
  onClose: () => void;
}

// Khung phân bổ môn cân đối động–tĩnh chuẩn cho từng khối độ tuổi
const GRADE_WEEKLY_BLUEPRINTS: Record<AgeGroupId, Array<{ dayIdx: number; subject: string }>> = {
  NHA_TRE_24_36T: [
    { dayIdx: 0, subject: 'PTVĐ' },
    { dayIdx: 1, subject: 'NBTN' },
    { dayIdx: 2, subject: 'GDAN' },
    { dayIdx: 3, subject: 'LQVH' },
    { dayIdx: 4, subject: 'Tạo hình' },
  ],
  MAM_3_4T: [
    { dayIdx: 0, subject: 'GDAN' },
    { dayIdx: 1, subject: 'PTVĐ' },
    { dayIdx: 2, subject: 'MTXQ' },
    { dayIdx: 3, subject: 'LQVH' },
    { dayIdx: 4, subject: 'KNS' },
    { dayIdx: 4, subject: 'Tạo hình' },
  ],
  CHOI_4_5T: [
    { dayIdx: 0, subject: 'GDAN' },
    { dayIdx: 0, subject: 'PTVĐ' },
    { dayIdx: 1, subject: 'MTXQ' },
    { dayIdx: 2, subject: 'Tạo hình' },
    { dayIdx: 3, subject: 'KNS' },
    { dayIdx: 3, subject: 'LQVT' },
    { dayIdx: 4, subject: 'LQVH' },
  ],
  LA_5_6T: [
    { dayIdx: 0, subject: 'GDAN' },
    { dayIdx: 0, subject: 'PTVĐ' },
    { dayIdx: 1, subject: 'MTXQ' },
    { dayIdx: 1, subject: 'LQVH' },
    { dayIdx: 2, subject: 'KNS' },
    { dayIdx: 2, subject: 'Tạo hình' },
    { dayIdx: 3, subject: 'LQVT' },
    { dayIdx: 4, subject: 'LQCC' },
  ],
};

export const AutoFillWeekModal: React.FC<Props> = ({
  plan,
  dataset,
  timetable,
  onApply,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<ProposedSlot[]>([]);

  const isOddWeek = (plan.weekNumber || 1) % 2 === 1;
  const usingCustomTimetable = Boolean(timetable);

  const gradeObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  const objByCode = useMemo(
    () => new Map(gradeObjectives.map((o) => [o.code, o])),
    [gradeObjectives]
  );

  useEffect(() => {
    setLoading(true);

    fetch(`/api/kb/lessons?ageGroupId=${plan.ageGroupId}&slotType=MAIN&limit=120`)
      .then((r) => r.json())
      .then((d) => {
        const realItems: Array<{ subject: string; topic: string; mtCode: string; schoolName: string; detectedMonth?: string; score: number }> =
          d.items || [];

        let blueprint: Array<{ dayIdx: number; subject: string }> = [];
        if (timetable) {
          const rows = isOddWeek ? timetable.oddWeek : timetable.evenWeek;
          rows.forEach((subjs, dIdx) => {
            if (plan.days[dIdx]?.isHoliday) return;
            subjs.forEach((subj) => blueprint.push({ dayIdx: dIdx, subject: subj }));
          });
        }
        if (blueprint.length === 0) {
          blueprint = (GRADE_WEEKLY_BLUEPRINTS[plan.ageGroupId] || GRADE_WEEKLY_BLUEPRINTS.LA_5_6T).filter(
            (bp) => !plan.days[bp.dayIdx]?.isHoliday
          );
        }
        const usedTopics = new Set<string>();
        const usedMtCodes = new Set<string>();

        const isCornerOrNonMain = (text: string) =>
          /^(góc\s|chơi tự do|rèn cháu chưa)/i.test((text || '').trim());

        const isOverlongAnthology = (text: string) =>
          (text || '').length > 165 && ((text.match(/[“"]/g) || []).length >= 6);

        const builtSlots: ProposedSlot[] = blueprint.map((bp) => {
          const cands: CandidateIdea[] = [];
          const targetSubj = bp.subject === 'NBTN' ? 'MTXQ' : bp.subject;

          // 1. Collect matching real distilled lessons for this subject
          realItems
            .filter((it) => {
              if (isCornerOrNonMain(it.topic)) return false;
              const subjOk = it.subject === bp.subject || (bp.subject === 'NBTN' && it.subject === 'MTXQ');
              if (!subjOk) return false;
              if (it.mtCode) {
                const linkedObj = objByCode.get(it.mtCode);
                if (linkedObj && !objectiveMatchesSubject(linkedObj, targetSubj)) return false;
              }
              return true;
            })
            .forEach((it) => {
              const rel = scoreThemeRelevance(
                it.topic,
                plan.themeName,
                plan.subThemeName,
                it.detectedMonth || '',
                plan.weekStartDate
              );
              cands.push({
                topic: it.topic,
                subject: bp.subject,
                mtCode: it.mtCode,
                sourceLabel: `${rel.matchesTheme ? '★ Khớp chủ đề • ' : ''}Thực tế • ${it.schoolName}`,
                score: (it.score || 0.5) * 10 + rel.score - (isOverlongAnthology(it.topic) ? 25 : 0),
              });
            });

          // 2. Collect matching BGD standard activities for this exact subject (STRICT domain + subject gate!)
          for (const o of gradeObjectives) {
            if (!objectiveMatchesSubject(o, targetSubj)) continue;
            for (const a of o.activities) {
              if (isCornerOrNonMain(a.text) || normVN(a.type).includes('goc')) continue;
              if (activityMatchesSubject(a.type, a.text, targetSubj)) {
                const rel = scoreThemeRelevance(
                  `${o.theme} ${a.text}`,
                  plan.themeName,
                  plan.subThemeName,
                  o.month,
                  plan.weekStartDate
                );
                const tcBonus = bp.subject === 'KNS' && domainToKey(o.domain) === 'PT_TCKNXH' ? 18 : 0;
                cands.push({
                  topic: a.text,
                  subject: bp.subject,
                  mtCode: o.code,
                  sourceLabel: `${rel.matchesTheme ? '★ Khớp chủ đề • ' : ''}Chuẩn BGD • ${o.code}`,
                  score: 8 + rel.score + tcBonus - (isOverlongAnthology(a.text) ? 25 : 0),
                });
              }
            }
          }

          cands.sort((a, b) => b.score - a.score);
          // Deduplicate & prefer distinct topics AND distinct MTs across the week
          const uniqueCands: CandidateIdea[] = [];
          const seenLocal = new Set<string>();
          for (const c of cands) {
            const k = normVN(c.topic).slice(0, 45);
            if (seenLocal.has(k)) continue;
            seenLocal.add(k);
            uniqueCands.push(c);
          }

          let chosenIdx = uniqueCands.findIndex(
            (c) =>
              !usedTopics.has(normVN(c.topic).slice(0, 45)) &&
              (!c.mtCode || !usedMtCodes.has(c.mtCode))
          );
          if (chosenIdx < 0) {
            chosenIdx = uniqueCands.findIndex((c) => !usedTopics.has(normVN(c.topic).slice(0, 45)));
          }
          if (chosenIdx < 0) chosenIdx = 0;
          if (uniqueCands[chosenIdx]) {
            usedTopics.add(normVN(uniqueCands[chosenIdx].topic).slice(0, 45));
            if (uniqueCands[chosenIdx].mtCode) usedMtCodes.add(uniqueCands[chosenIdx].mtCode);
          }

          return {
            dayIdx: bp.dayIdx,
            dayLabel: plan.days[bp.dayIdx]?.dayLabel || `Thứ ${bp.dayIdx + 2}`,
            subject: bp.subject,
            candidates: uniqueCands.slice(0, 12),
            chosenIdx,
          };
        });

        setSlots(builtSlots);
      })
      .finally(() => setLoading(false));
  }, [plan.ageGroupId, plan.themeName, plan.subThemeName, gradeObjectives]);

  const cycleCandidate = (slotIdx: number) => {
    setSlots((prev) =>
      prev.map((sl, i) =>
        i === slotIdx && sl.candidates.length > 1
          ? { ...sl, chosenIdx: (sl.chosenIdx + 1) % sl.candidates.length }
          : sl
      )
    );
  };

  const handleConfirmApply = () => {
    const isNhaTre = plan.ageGroupId === 'NHA_TRE_24_36T';
    const nextDays = plan.days.map((d) => ({ ...d, mainLessons: [] as LessonPlan[] }));
    const mtByDomain = new Map<DomainKey, Set<string>>();
    plan.themeObjectives.forEach((b) => mtByDomain.set(b.domainKey, new Set(b.mtCodes)));

    for (const sl of slots) {
      const picked = sl.candidates[sl.chosenIdx];
      if (!picked) continue;
      const obj: ObjectiveItem | undefined = picked.mtCode ? objByCode.get(picked.mtCode) : undefined;
      const built = buildPedagogicalLessonPlan({
        topicTitle: picked.topic,
        subjectCode: sl.subject,
        ageGroupId: plan.ageGroupId,
        slotType: 'MAIN',
        mtCode: picked.mtCode,
        obj,
      });
      nextDays[sl.dayIdx].mainLessons.push(built);

      if (picked.mtCode) {
        const meta = resolveSubjectMeta(sl.subject);
        const dk: DomainKey =
          obj
            ? isNhaTre && domainToKey(obj.domain) === 'PTTM'
              ? 'PT_TCKNXH'
              : domainToKey(obj.domain)
            : isNhaTre && meta.domainKey === 'PTTM'
            ? 'PT_TCKNXH'
            : meta.domainKey;
        if (!mtByDomain.has(dk)) mtByDomain.set(dk, new Set());
        mtByDomain.get(dk)!.add(picked.mtCode);
      }
    }

    const nextThemeObjectives = plan.themeObjectives.map((b) => ({
      ...b,
      mtCodes: Array.from(mtByDomain.get(b.domainKey) || new Set(b.mtCodes)),
    }));

    onApply(
      {
        ...plan,
        themeObjectives: nextThemeObjectives,
        days: nextDays,
      },
      `Đã tự động xếp xong ${slots.length} tiết cân đối 5 ngày + gắn MT & khung chuẩn từng môn!`
    );
  };

  const ageMeta = dataset.ageGroups.find((g) => g.id === plan.ageGroupId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#EFF6FF] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-[#1D4ED8]">
              <span>Tự động xếp lịch tuần thông minh (1 chạm)</span>
              {usingCustomTimetable && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold normal-case text-[#1D4ED8] ring-1 ring-blue-200">
                  Theo Thời khóa biểu {isOddWeek ? 'Tuần lẻ' : 'Tuần chẵn'}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Cân đối động – tĩnh chuẩn cho <strong>{ageMeta?.name}</strong> • Chủ đề: <strong>{plan.subThemeName}</strong>. Bấm <strong>Đổi bài khác</strong> nếu muốn chọn ý tưởng khác cho bất kỳ ngày nào.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Đang chọn lọc bộ tiết học cân đối từ 1.050 giáo án thực tế &amp; 345 MT...
            </div>
          ) : (
            <div className="space-y-2.5">
              {slots.map((sl, idx) => {
                const picked = sl.candidates[sl.chosenIdx];
                const sv = getSubjectVisual(sl.subject);
                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#1D4ED8] px-2 py-0.5 text-[10px] font-bold text-white">
                          {sl.dayLabel}
                        </span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                          {sl.subject}
                        </span>
                        {picked?.mtCode && (
                          <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                            {picked.mtCode}
                          </span>
                        )}
                        {picked?.sourceLabel && (
                          <span className="text-[10px] text-slate-400">{picked.sourceLabel}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {picked ? picked.topic : 'Chưa có đề tài phù hợp'}
                      </p>
                    </div>
                    {sl.candidates.length > 1 && (
                      <button
                        onClick={() => cycleCandidate(idx)}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                      >
                        Đổi bài ({sl.chosenIdx + 1}/{sl.candidates.length})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <span className="text-[11px] text-slate-500">
            Có thể hoàn tác (Undo) ngay sau khi áp dụng nếu muốn quay lại.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              disabled={loading || slots.length === 0}
              onClick={handleConfirmApply}
              className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-40"
            >
              Áp dụng lịch 5 ngày này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
