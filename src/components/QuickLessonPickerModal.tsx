import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { AgeGroupId, LessonPlan, ObjectiveItem, ObjectivesDataset } from '../../shared/types';
import { domainToKey, normVN } from '../utils/helpers';
import { buildPedagogicalLessonPlan, getSubjectsForAgeGroup, resolveSubjectMeta } from '../utils/subjectTemplates';
import { scoreThemeRelevance } from '../utils/themeRelevance';
import { activityMatchesSubject, getSubjectVisual, objectiveMatchesSubject } from '../utils/visualMeta';

interface CrawledLessonRow {
  id: string;
  subject: string;
  topic: string;
  slotType?: string;
  mtCode: string;
  schoolName: string;
  detectedMonth: string;
}

interface Props {
  dayLabel: string;
  slotType: 'MAIN' | 'AFTERNOON';
  ageGroupId: AgeGroupId;
  themeName: string;
  subThemeName?: string;
  weekStartDate?: string;
  monthPlannedMtCodes?: string[];
  scheduledTopics?: Set<string>;
  dataset: ObjectivesDataset;
  onSelect: (lesson: LessonPlan, attachMt?: { domainKey: string; mtCode: string }) => void;
  onClose: () => void;
}

export const QuickLessonPickerModal: React.FC<Props> = ({
  dayLabel,
  slotType,
  ageGroupId,
  themeName,
  subThemeName = '',
  weekStartDate = '',
  monthPlannedMtCodes,
  scheduledTopics,
  dataset,
  onSelect,
  onClose,
}) => {
  const monthMtSet = useMemo(
    () => new Set(monthPlannedMtCodes || []),
    [monthPlannedMtCodes]
  );
  const availableSubjects = useMemo(
    () => getSubjectsForAgeGroup(ageGroupId),
    [ageGroupId]
  );

  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    if (slotType === 'AFTERNOON') return 'KNS';
    return ageGroupId === 'NHA_TRE_24_36T' ? 'NBTN' : 'GDAN';
  });
  const [sourceTab, setSourceTab] = useState<'crawled' | 'mt'>('crawled');
  const [search, setSearch] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [crawledLessons, setCrawledLessons] = useState<CrawledLessonRow[]>([]);
  const [loading, setLoading] = useState(false);

  const subjectMeta = useMemo(
    () => availableSubjects.find((s) => s.code === selectedSubject) || resolveSubjectMeta(selectedSubject),
    [availableSubjects, selectedSubject]
  );

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === ageGroupId),
    [dataset, ageGroupId]
  );

  const objByCode = useMemo(
    () => new Map(ageObjectives.map((o) => [o.code, o])),
    [ageObjectives]
  );

  useEffect(() => {
    setLoading(true);
    if (slotType === 'AFTERNOON') {
      // Ưu tiên tải toàn bộ hoạt động chuẩn buổi chiều trước, sau đó ghép thêm bài chính phù hợp
      const pAft = new URLSearchParams({
        ageGroupId,
        slotType: 'AFTERNOON',
        limit: '60',
      });
      const pMain = new URLSearchParams({
        ageGroupId,
        subject: selectedSubject,
        slotType: 'MAIN',
        limit: '40',
      });
      if (search.trim()) {
        pAft.set('q', search.trim());
        pMain.set('q', search.trim());
      }
      Promise.all([
        fetch(`/api/kb/lessons?${pAft.toString()}`).then((r) => r.json()),
        fetch(`/api/kb/lessons?${pMain.toString()}`).then((r) => r.json()),
      ])
        .then(([dAft, dMain]) => {
          const aftItems = ((dAft.items || []) as CrawledLessonRow[]).filter(
            (it) =>
              it.subject === selectedSubject ||
              (selectedSubject === 'KNS' && (it.subject === 'TTVS' || it.subject === 'LĐVS'))
          );
          const mainItems = (dMain.items || []) as CrawledLessonRow[];
          setCrawledLessons([...aftItems, ...mainItems]);
        })
        .catch(() => setCrawledLessons([]))
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({
      ageGroupId,
      subject: selectedSubject,
      slotType: 'MAIN',
      limit: '60',
    });
    if (search.trim()) params.set('q', search.trim());
    fetch(`/api/kb/lessons?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCrawledLessons(d.items || []))
      .catch(() => setCrawledLessons([]))
      .finally(() => setLoading(false));
  }, [ageGroupId, selectedSubject, slotType, search]);

  const isAlreadyScheduled = (topic: string) =>
    Boolean(scheduledTopics?.has((topic || '').trim().toLowerCase().slice(0, 45)));

  const sortedCrawledLessons = useMemo(() => {
    return [...crawledLessons]
      .map((les) => ({
        les,
        already: isAlreadyScheduled(les.topic),
        isAftSlot: les.slotType === 'AFTERNOON',
        rel: scoreThemeRelevance(les.topic, themeName, subThemeName, les.detectedMonth, weekStartDate),
      }))
      .sort((a, b) => {
        if (a.already !== b.already) return a.already ? 1 : -1;
        if (slotType === 'AFTERNOON' && a.isAftSlot !== b.isAftSlot) {
          return a.isAftSlot ? -1 : 1;
        }
        if (a.rel.isSeasonalConflict !== b.rel.isSeasonalConflict) {
          return a.rel.isSeasonalConflict ? 1 : -1;
        }
        return b.rel.score - a.rel.score;
      });
  }, [crawledLessons, themeName, subThemeName, weekStartDate, scheduledTopics, slotType]);

  const matchingObjectives = useMemo(() => {
    const q = normVN(search);
    return ageObjectives
      .filter((o) => {
        if (!objectiveMatchesSubject(o, selectedSubject)) return false;
        if (q) {
          const hay = normVN(`${o.code} ${o.description} ${o.theme} ${o.activities.map((a) => a.text).join(' ')}`);
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((o) => ({
        obj: o,
        inMonth: monthMtSet.has(o.code),
        rel: scoreThemeRelevance(
          `${o.theme} ${o.description} ${o.activities.map((a) => a.text).join(' ')}`,
          themeName,
          subThemeName,
          o.month,
          weekStartDate
        ),
      }))
      .sort((a, b) => {
        if (a.inMonth !== b.inMonth) return a.inMonth ? -1 : 1;
        if (a.rel.isSeasonalConflict !== b.rel.isSeasonalConflict) {
          return a.rel.isSeasonalConflict ? 1 : -1;
        }
        return b.rel.score - a.rel.score;
      });
  }, [ageObjectives, selectedSubject, search, themeName, subThemeName, weekStartDate, monthMtSet]);

  const handlePickLesson = (topic: string, mtCode?: string, obj?: ObjectiveItem) => {
    const built = buildPedagogicalLessonPlan({
      topicTitle: topic.trim(),
      subjectCode: selectedSubject,
      ageGroupId,
      slotType,
      mtCode: mtCode || '',
      obj,
    });
    const validMt = built.linkedMtCodes[0];
    const isNhaTre = ageGroupId === 'NHA_TRE_24_36T';
    const rawDk = obj ? domainToKey(obj.domain) : subjectMeta.domainKey;
    const dk = isNhaTre && rawDk === 'PTTM' ? 'PT_TCKNXH' : rawDk;
    onSelect(
      built,
      validMt ? { domainKey: dk, mtCode: validMt } : undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#EFF6FF] px-5 py-3.5">
          <div>
            <div className="text-xs font-bold uppercase text-[#1D4ED8]">
              {slotType === 'MAIN' ? `Thêm Tiết học có chủ đích — ${dayLabel}` : `Thêm Hoạt động chiều — ${dayLabel}`}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Chọn môn học → chọn 1 chạm đề tài (tự sinh sẵn khung sư phạm chuẩn riêng của môn đó & tự gắn Mã MT).
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step A: Pick Subject */}
          <div>
            <div className="mb-2 text-xs font-bold text-slate-700">1. Chọn môn học (tự sinh khung sư phạm chuẩn):</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableSubjects.map((subj) => {
                const sv = getSubjectVisual(subj.code);
                const active = selectedSubject === subj.code;
                return (
                  <button
                    key={subj.code}
                    onClick={() => setSelectedSubject(subj.code)}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      active
                        ? 'border-[#1D4ED8] bg-[#DBEAFE] ring-2 ring-[#1D4ED8]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                        {subj.code}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {subj.rhythm === 'ACTIVE' ? 'Động' : 'Tĩnh'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-800">{subj.shortLabel}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              <strong className="text-[#1D4ED8]">Khung sư phạm sẽ tự tạo:</strong> {subjectMeta.pedagogySummary}
            </div>
          </div>

          {/* Step B: Quick Custom Input */}
          <div className="rounded-xl border border-blue-200/80 bg-[#F5F9FF] p-3">
            <div className="text-xs font-bold text-slate-800">2. Tự nhập nhanh tên đề tài của cô (hoặc chọn sẵn bên dưới):</div>
            <div className="mt-2 flex gap-2">
              <input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customTopic.trim()) {
                    handlePickLesson(customTopic);
                  }
                }}
                placeholder={`VD: Nhập tên đề tài môn ${subjectMeta.shortLabel}...`}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#1D4ED8] focus:outline-none"
              />
              <button
                disabled={!customTopic.trim()}
                onClick={() => handlePickLesson(customTopic)}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-40"
              >
                + Thêm ngay
              </button>
            </div>
          </div>

          {/* Step C: Pick from Zero-Noise Filtered Suggestions */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setSourceTab('crawled')}
                  className={`rounded-lg px-3 py-1 transition ${
                    sourceTab === 'crawled' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Đề tài thực tế môn {selectedSubject} ({crawledLessons.length})
                </button>
                <button
                  onClick={() => setSourceTab('mt')}
                  className={`rounded-lg px-3 py-1 transition ${
                    sourceTab === 'mt' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Gợi ý chuẩn theo 345 MT ({matchingObjectives.length})
                </button>
              </div>
              <div className="w-full sm:w-60">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Lọc nhanh tên bài..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {sourceTab === 'crawled' ? (
                loading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Đang lọc đề tài môn {selectedSubject}...</div>
                ) : crawledLessons.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                    Chưa có bài cào sẵn khớp từ khóa cho môn <strong>{selectedSubject}</strong> ở khối tuổi này — cô có thể chuyển sang tab <strong>Gợi ý chuẩn theo 345 MT</strong> hoặc nhập trực tiếp ở ô trên.
                  </div>
                ) : (
                  sortedCrawledLessons.map(({ les, rel, already, isAftSlot }) => (
                    <div
                      key={les.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                        already
                          ? 'border-slate-200 bg-slate-50/70 opacity-75'
                          : 'border-slate-200 bg-white hover:border-[#1D4ED8] hover:bg-[#F5F9FF]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {les.mtCode && (
                            <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                              {les.mtCode}
                            </span>
                          )}
                          {isAftSlot && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 ring-1 ring-indigo-200">
                              Chuẩn HĐ chiều
                            </span>
                          )}
                          {already && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              Đã có trong tuần
                            </span>
                          )}
                          {rel.matchesTheme && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 ring-1 ring-blue-200">
                              Khớp chủ đề
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {les.schoolName} • {les.detectedMonth}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-900">{les.topic}</div>
                      </div>
                      <button
                        onClick={() => handlePickLesson(les.topic, les.mtCode, objByCode.get(les.mtCode))}
                        className="shrink-0 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                      >
                        Chọn bài này
                      </button>
                    </div>
                  ))
                )
              ) : (
                matchingObjectives.slice(0, 20).map(({ obj, rel, inMonth }) => {
                  const exactActs = obj.activities.filter((a) =>
                    activityMatchesSubject(a.type, a.text, selectedSubject)
                  );
                  const baseActs = exactActs.length > 0 ? exactActs : obj.activities.slice(0, 2);
                  const shownActs = [...baseActs].sort((x, y) => {
                    const ax = isAlreadyScheduled(x.text) ? 1 : 0;
                    const ay = isAlreadyScheduled(y.text) ? 1 : 0;
                    if (ax !== ay) return ax - ay;
                    return (
                      scoreThemeRelevance(`${obj.theme} ${y.text}`, themeName, subThemeName, obj.month, weekStartDate).score -
                      scoreThemeRelevance(`${obj.theme} ${x.text}`, themeName, subThemeName, obj.month, weekStartDate).score
                    );
                  });
                  return (
                    <div key={obj.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#1D4ED8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {obj.code}
                        </span>
                        {inMonth && (
                          <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8] ring-1 ring-blue-300">
                            MT Tháng này
                          </span>
                        )}
                        {rel.matchesTheme && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 ring-1 ring-blue-200">
                            Khớp chủ đề
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-slate-800">{obj.description}</span>
                      </div>
                      {obj.eduContent && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1 text-[11px] text-slate-600">
                          <span className="truncate">Nội dung GDMN: {obj.eduContent}</span>
                          <button
                            type="button"
                            onClick={() => handlePickLesson(obj.eduContent, obj.code, obj)}
                            className="shrink-0 font-bold text-[#1D4ED8] hover:underline"
                          >
                            + Chọn nội dung này
                          </button>
                        </div>
                      )}
                      <div className="mt-2 space-y-1.5">
                        {shownActs.map((act) => {
                          const alreadyAct = isAlreadyScheduled(act.text);
                          return (
                            <div
                              key={act.id}
                              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                                alreadyAct ? 'bg-amber-50/60 opacity-80' : 'bg-slate-50'
                              }`}
                            >
                              <div className="text-slate-700">
                                {alreadyAct && (
                                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                    Đã có trong tuần
                                  </span>
                                )}
                                <span className="font-semibold text-[#1E3A8A]">{act.type}:</span> {act.text}
                              </div>
                              <button
                                onClick={() => handlePickLesson(act.text, obj.code, obj)}
                                className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] ring-1 ring-slate-200 hover:bg-[#1D4ED8] hover:text-white"
                              >
                                + Chọn
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
