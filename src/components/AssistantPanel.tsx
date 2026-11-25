import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  Layers,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import type {
  ObjectiveItem,
  ObjectivesDataset,
  SuggestedActivity,
  WeeklyPlanDocument,
} from '../../shared/types';
import { domainToKey, normVN } from '../utils/helpers';
import { buildLessonSnippetHtml, buildShortLessonLineHtml } from '../utils/planToHtml';
import { DOMAIN_VISUALS, getDomainVisual, getSubjectVisual } from '../utils/visualMeta';
import type { CursorContext } from './WordEditor';

interface CrawledDocItem {
  id: number;
  schoolName: string;
  postTitle: string;
  detectedMonth: string;
  postUrl: string;
  ext: string;
  snippet: string;
  matchedMts: Array<{ code: string; score: number; tier?: string }>;
  extractedLessons: Array<{ subject: string; topic: string; type: string; mtCode?: string }>;
}

interface CrawledLessonItem {
  id: string;
  docId: number;
  ageGroupId: string;
  subject: string;
  topic: string;
  type: string;
  mtCode: string;
  score: number;
  schoolName: string;
  detectedMonth: string;
  postTitle: string;
  postUrl: string;
  snippet: string;
  isMainLesson: boolean;
}

interface CrawledMtEntry {
  docCount: number;
  lessonCount: number;
  topLessons: Array<{ subject: string; topic: string; school: string; score: number }>;
}

interface PreviewTarget {
  title: string;
  subtitle: string;
  html: string;
  shortHtml: string;
  onInsertFull: () => void;
  onInsertShort: () => void;
}

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  crawledTotalDocs: number;
  usedMtCodes: Set<string>;
  cursorContext: CursorContext;
  onClose: () => void;
  onInsertMtLine: (obj: ObjectiveItem) => void;
  onInsertActivityLine: (obj: ObjectiveItem, act: SuggestedActivity) => void;
  onInsertShortLessonLine: (topic: string, subject: string, mtCode: string) => void;
  onInsertLessonFrame: (topic: string, subject: string, mtCode: string, obj?: ObjectiveItem) => void;
  onOpenFullLibrary: (tab: 'bank' | 'crawled') => void;
}

const ORDERED_SUBJECTS = [
  'Tất cả',
  'GDAN',
  'Tạo hình',
  'LQVH',
  'LQVT',
  'MTXQ',
  'PTVĐ',
  'KNS',
  'LQCC',
];

function extractMonthLabel(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return '';
  const m = Number(isoDate.split('-')[1]);
  if (!m || Number.isNaN(m)) return '';
  return `Tháng ${m}`;
}

export const AssistantPanel: React.FC<Props> = ({
  plan,
  dataset,
  crawledTotalDocs,
  usedMtCodes,
  cursorContext,
  onClose,
  onInsertMtLine,
  onInsertActivityLine,
  onInsertShortLessonLine,
  onInsertLessonFrame,
  onOpenFullLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<'smart' | 'mt' | 'crawled'>('smart');
  const [crawledViewMode, setCrawledViewMode] = useState<'lessons' | 'docs'>('lessons');
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('Tất cả');
  const [expandedMtIds, setExpandedMtIds] = useState<Record<string, boolean>>({});
  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

  const [crawledByMt, setCrawledByMt] = useState<Record<string, CrawledMtEntry>>({});
  const [crawledLessons, setCrawledLessons] = useState<CrawledLessonItem[]>([]);
  const [lessonSubjectCounts, setLessonSubjectCounts] = useState<Record<string, number>>({});
  const [lessonTotal, setLessonTotal] = useState(0);
  const [crawledDocs, setCrawledDocs] = useState<CrawledDocItem[]>([]);
  const [loadingCrawled, setLoadingCrawled] = useState(false);

  const planMonthLabel = useMemo(() => extractMonthLabel(plan.weekStartDate), [plan.weekStartDate]);

  useEffect(() => {
    fetch(`/api/kb/suggestions?ageGroupId=${plan.ageGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setCrawledByMt(d.byMt);
        else setCrawledByMt({});
      })
      .catch(() => setCrawledByMt({}));
  }, [plan.ageGroupId]);

  useEffect(() => {
    if (activeTab !== 'crawled') return;
    setLoadingCrawled(true);
    if (crawledViewMode === 'lessons') {
      const params = new URLSearchParams({ ageGroupId: plan.ageGroupId, slotType: 'MAIN', limit: '50' });
      if (search.trim()) params.set('q', search.trim());
      if (subjectFilter !== 'Tất cả') params.set('subject', subjectFilter);
      fetch(`/api/kb/lessons?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setCrawledLessons(d.items || []);
          setLessonSubjectCounts(d.subjectCounts || {});
          setLessonTotal(d.total || 0);
        })
        .catch(() => {
          setCrawledLessons([]);
          setLessonTotal(0);
        })
        .finally(() => setLoadingCrawled(false));
    } else {
      const params = new URLSearchParams({ ageGroupId: plan.ageGroupId, limit: '25' });
      const qParts = [search.trim(), subjectFilter !== 'Tất cả' ? subjectFilter : ''].filter(Boolean).join(' ');
      if (qParts) params.set('q', qParts);
      fetch(`/api/kb/docs?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setCrawledDocs(d.items || []))
        .catch(() => setCrawledDocs([]))
        .finally(() => setLoadingCrawled(false));
    }
  }, [activeTab, crawledViewMode, plan.ageGroupId, search, subjectFilter]);

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  const ageObjByCode = useMemo(
    () => new Map(ageObjectives.map((o) => [o.code, o])),
    [ageObjectives]
  );

  const months = useMemo(
    () => Array.from(new Set(ageObjectives.map((o) => o.month).filter(Boolean))),
    [ageObjectives]
  );

  // Domain counts + used counts for the visual 5-domain strip
  const domainStats = useMemo(() => {
    return DOMAIN_VISUALS.map((dv) => {
      const list = ageObjectives.filter((o) => domainToKey(o.domain) === dv.key);
      const used = list.filter((o) => usedMtCodes.has(o.code)).length;
      return { ...dv, total: list.length, used };
    });
  }, [ageObjectives, usedMtCodes]);

  // Smart weekly recommendations: score each MT by theme/subTheme/month/already-used match
  const smartObjectives = useMemo(() => {
    const themeTokens = normVN(`${plan.themeName} ${plan.subThemeName}`)
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !['cua', 'cho', 'voi', 'cac', 'nhung'].includes(t));
    const planMonthNorm = normVN(planMonthLabel);
    const q = normVN(search);

    const scored = ageObjectives
      .map((obj) => {
        let score = 0;
        const reasons: string[] = [];
        const isUsed = usedMtCodes.has(obj.code);
        if (isUsed) {
          score += 50;
          reasons.push('Đã gắn trong bài');
        }
        const monthNorm = normVN(obj.month);
        if (planMonthNorm && monthNorm.includes(planMonthNorm)) {
          score += 35;
          reasons.push(`Đúng ${planMonthLabel}`);
        }
        const hayTheme = normVN(`${obj.theme} ${obj.description} ${obj.eduContent}`);
        const tokenHits = themeTokens.filter((tk) => hayTheme.includes(tk)).length;
        if (tokenHits > 0) {
          score += tokenHits * 20;
          reasons.push('Khớp chủ đề');
        }
        if (crawledByMt[obj.code]?.docCount > 0) {
          score += 5;
        }
        return { obj, score, reasons, isUsed };
      })
      .filter(({ obj, score }) => {
        if (domainFilter !== 'ALL' && domainToKey(obj.domain) !== domainFilter) return false;
        if (q) {
          const hay = normVN(
            `${obj.code} ${obj.domain} ${obj.description} ${obj.theme} ${obj.eduContent} ${obj.activities.map((a) => `${a.type} ${a.text}`).join(' ')}`
          );
          if (!hay.includes(q)) return false;
        }
        return score > 0 || q.length > 0;
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 30);
  }, [ageObjectives, plan.themeName, plan.subThemeName, planMonthLabel, usedMtCodes, crawledByMt, domainFilter, search]);

  // Filtered objectives for full 345 MT tab
  const filteredObjectives = useMemo(() => {
    const q = normVN(search);
    return ageObjectives.filter((o) => {
      if (domainFilter !== 'ALL' && domainToKey(o.domain) !== domainFilter) return false;
      if (monthFilter !== 'ALL' && o.month !== monthFilter) return false;
      if (q) {
        const hay = normVN(
          `${o.code} ${o.domain} ${o.description} ${o.theme} ${o.eduContent} ${o.activities.map((a) => `${a.type} ${a.text}`).join(' ')}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ageObjectives, domainFilter, monthFilter, search]);

  const toggleExpandMt = (id: string) =>
    setExpandedMtIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleExpandSnippet = (key: string) =>
    setExpandedSnippets((prev) => ({ ...prev, [key]: !prev[key] }));

  const openActivityPreview = (obj: ObjectiveItem, act: SuggestedActivity) => {
    setPreviewTarget({
      title: `${act.type} — ${obj.code}`,
      subtitle: `${obj.domain} • ${obj.month}`,
      html: buildLessonSnippetHtml(act.text, act.type, obj.code, obj),
      shortHtml: buildShortLessonLineHtml(act.text, act.type, obj.code),
      onInsertFull: () => {
        onInsertLessonFrame(act.text, act.type, obj.code, obj);
        setPreviewTarget(null);
      },
      onInsertShort: () => {
        onInsertActivityLine(obj, act);
        setPreviewTarget(null);
      },
    });
  };

  const openCrawledLessonPreview = (
    topic: string,
    subject: string,
    mtCode: string,
    schoolName: string,
    obj?: ObjectiveItem
  ) => {
    setPreviewTarget({
      title: `[${subject}] ${topic}`,
      subtitle: `Nguồn thực tế: ${schoolName}${mtCode ? ` • ${mtCode}` : ''}`,
      html: buildLessonSnippetHtml(topic, subject, mtCode, obj),
      shortHtml: buildShortLessonLineHtml(topic, subject, mtCode),
      onInsertFull: () => {
        onInsertLessonFrame(topic, subject, mtCode, obj);
        setPreviewTarget(null);
      },
      onInsertShort: () => {
        onInsertShortLessonLine(topic, subject, mtCode);
        setPreviewTarget(null);
      },
    });
  };

  const renderMtCard = (obj: ObjectiveItem, reasonTags?: string[]) => {
    const dv = getDomainVisual(obj.domain);
    const isUsed = usedMtCodes.has(obj.code);
    const isExpanded = Boolean(expandedMtIds[obj.id]);
    const kb = crawledByMt[obj.code];
    // Lọc các bài dạy thực tế sạch (độ dài >= 14 ký tự, ưu tiên tiết học chính trước HĐ Góc)
    const cleanRealLessons = (() => {
      if (!kb?.topLessons?.length) return [];
      const cleaned = kb.topLessons.filter((l) => (l.topic || '').trim().length >= 14);
      const mains = cleaned.filter((l) => l.subject !== 'HĐ Góc');
      const corners = cleaned.filter((l) => l.subject === 'HĐ Góc');
      return [...mains, ...corners];
    })();

    const visibleActivities = isExpanded ? obj.activities : obj.activities.slice(0, 2);
    const visibleRealLessons = isExpanded ? cleanRealLessons.slice(0, 6) : cleanRealLessons.slice(0, 2);
    const hiddenCount =
      Math.max(0, obj.activities.length - visibleActivities.length) +
      Math.max(0, Math.min(6, cleanRealLessons.length) - visibleRealLessons.length);

    return (
      <div
        key={obj.id}
        className={`rounded-xl border border-slate-200 border-l-4 ${dv.borderClass} bg-white p-3 shadow-2xs transition hover:border-slate-300`}
      >
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${dv.mtBadgeClass}`}>
              {obj.code}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dv.badgeClass}`}>
              {dv.short}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {obj.month}
            </span>
            {isUsed && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-2.5 w-2.5" /> Đã có
              </span>
            )}
          </div>
          <button
            onClick={() => onInsertMtLine(obj)}
            title={`Chèn dòng mục tiêu ${obj.code} vào vị trí con trỏ`}
            className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#0B6E5C] transition hover:bg-[#0B6E5C] hover:text-white"
          >
            <Plus className="h-3 w-3" /> Chèn MT
          </button>
        </div>

        {/* Reason tags if in smart mode */}
        {reasonTags && reasonTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reasonTags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-[#E6F4F1] px-1.5 py-0.5 text-[10px] font-medium text-[#074F42]"
              >
                ★ {tag}
              </span>
            ))}
            {obj.theme && (
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                CĐ: {obj.theme}
              </span>
            )}
          </div>
        )}

        {/* Full MT description — no truncated ... hiding meaning */}
        <p className="mt-2 text-xs leading-relaxed font-semibold text-slate-900">
          {obj.description}
        </p>

        {/* Expandable BGD educational content */}
        {isExpanded && obj.eduContent && (
          <div className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
            <span className="font-bold text-slate-700">Nội dung GD chuẩn BGD: </span>
            {obj.eduContent}
          </div>
        )}

        {/* Suggested activities */}
        <div className="mt-2.5 space-y-2">
          {visibleActivities.map((act) => {
            const sv = getSubjectVisual(act.type);
            return (
              <div
                key={act.id}
                className={`rounded-lg border border-slate-200/70 ${sv.accentBg} p-2.5 text-[11px]`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                    {act.type}
                  </span>
                  <button
                    onClick={() => openActivityPreview(obj, act)}
                    title="Xem trước bố cục Word trước khi chèn"
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-white hover:text-[#0B6E5C]"
                  >
                    <Eye className="h-3 w-3" /> Xem trước
                  </button>
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-800">{act.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cursorContext.inTable ? (
                    <>
                      <button
                        onClick={() => onInsertActivityLine(obj, act)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#0B6E5C] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                      >
                        <Plus className="h-3 w-3" /> Chèn vào ô bảng
                      </button>
                      <button
                        onClick={() => onInsertLessonFrame(act.text, act.type, obj.code, obj)}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#0B6E5C] ring-1 ring-slate-200 hover:bg-[#E6F4F1]"
                      >
                        <FilePlus2 className="h-3 w-3" /> Khung tiết đầy đủ
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onInsertLessonFrame(act.text, act.type, obj.code, obj)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#0B6E5C] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                      >
                        <FilePlus2 className="h-3 w-3" /> Chèn khung tiết học
                      </button>
                      <button
                        onClick={() => onInsertActivityLine(obj, act)}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" /> Chèn dòng ngắn
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real crawled lessons matching this MT */}
        {visibleRealLessons.length > 0 && (
          <div className="mt-2.5 rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
              <span>Từ {kb.docCount} giáo án thực tế các trường:</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {visibleRealLessons.map((l, idx) => {
                const sv = getSubjectVisual(l.subject);
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-amber-200/60 bg-white p-2 text-[11px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                        {l.subject}
                      </span>
                      <span className="text-[10px] text-slate-400">{l.school}</span>
                    </div>
                    <p className="mt-1 leading-snug font-medium text-slate-800">{l.topic}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onInsertLessonFrame(l.topic, l.subject, obj.code, obj)}
                        className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-700"
                      >
                        <FilePlus2 className="h-3 w-3" /> Chèn tiết
                      </button>
                      <button
                        onClick={() => onInsertShortLessonLine(l.topic, l.subject, obj.code)}
                        className="inline-flex items-center gap-0.5 rounded bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" /> Dòng
                      </button>
                      <button
                        onClick={() =>
                          openCrawledLessonPreview(l.topic, l.subject, obj.code, l.school, obj)
                        }
                        className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 hover:text-[#0B6E5C]"
                      >
                        <Eye className="h-3 w-3" /> Xem
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expand/collapse footer */}
        {(hiddenCount > 0 || obj.eduContent) && (
          <button
            onClick={() => toggleExpandMt(obj.id)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-50 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#0B6E5C]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Thu gọn chi tiết
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {hiddenCount > 0
                  ? `Xem thêm ${hiddenCount} hoạt động & Nội dung GD chuẩn BGD`
                  : 'Xem Nội dung GD chuẩn BGD'}
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="relative flex h-full flex-col border-l border-slate-200 bg-slate-50/90">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B6E5C]">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Trợ lý gợi ý & Kho tham khảo</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-700">
              {dataset.ageGroups.find((g) => g.id === plan.ageGroupId)?.short}
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">Đã gắn {usedMtCodes.size} mã MT</span>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Ẩn bảng gợi ý"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live Word Cursor Context Strip */}
      <div className="border-b border-slate-200 bg-[#F2F9F7] px-3.5 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#074F42]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0B6E5C]" />
          <span className="truncate" title={cursorContext.sectionHeading}>
            Con trỏ: {cursorContext.sectionHeading}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px]">
          {cursorContext.inTable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
              <Table2 className="h-3 w-3" /> Đang trong ô bảng → Ưu tiên chèn dòng ngắn
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
              <FileText className="h-3 w-3" /> Đang trên trang soạn → Chèn khung tiết đầy đủ
            </span>
          )}
        </div>
      </div>

      {/* 3 Primary Visual Mode Tabs */}
      <div className="space-y-2.5 border-b border-slate-200 bg-white px-3.5 py-2.5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
          <button
            onClick={() => setActiveTab('smart')}
            className={`rounded-lg py-1.5 transition ${
              activeTab === 'smart'
                ? 'bg-white text-[#0B6E5C] shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="mr-0.5 inline h-3 w-3" /> Tuần này
          </button>
          <button
            onClick={() => setActiveTab('mt')}
            className={`rounded-lg py-1.5 transition ${
              activeTab === 'mt'
                ? 'bg-white text-[#0B6E5C] shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen className="mr-0.5 inline h-3 w-3" /> 345 MT
          </button>
          <button
            onClick={() => setActiveTab('crawled')}
            className={`rounded-lg py-1.5 transition ${
              activeTab === 'crawled'
                ? 'bg-white text-[#0B6E5C] shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="mr-0.5 inline h-3 w-3" /> Kho ({crawledTotalDocs})
          </button>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'crawled'
                ? 'Tìm đề tài, bài hát, thơ, trò chơi, trường...'
                : 'Tìm mã MT (VD: MT100), chủ đề, bài hát, toán...'
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-8 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Contextual filters per tab */}
        {activeTab !== 'crawled' ? (
          <div className="space-y-2">
            {/* 5 Color-Coded Domain Filter Pills with Coverage */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setDomainFilter('ALL')}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                  domainFilter === 'ALL'
                    ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả ({ageObjectives.length})
              </button>
              {domainStats.map((ds) => {
                const active = domainFilter === ds.key;
                return (
                  <button
                    key={ds.key}
                    onClick={() => setDomainFilter(active ? 'ALL' : ds.key)}
                    title={`${ds.label}: đã dùng ${ds.used}/${ds.total} MT`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                      active ? ds.pillActiveClass : `${ds.badgeClass} hover:opacity-85`
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : ds.dotClass}`} />
                    {ds.short}
                    <span className="opacity-75">
                      ({ds.used}/{ds.total})
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'mt' && (
              <div className="flex items-center justify-between gap-2">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
                >
                  <option value="ALL">Tất cả các tháng</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-medium text-slate-400">
                  {filteredObjectives.length} mục tiêu
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sub-toggle: By Clean Lesson vs By Source Doc */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() => setCrawledViewMode('lessons')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    crawledViewMode === 'lessons'
                      ? 'bg-[#0B6E5C] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="mr-1 inline h-3 w-3" /> Theo tiết học ({lessonTotal})
                </button>
                <button
                  onClick={() => setCrawledViewMode('docs')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    crawledViewMode === 'docs'
                      ? 'bg-[#0B6E5C] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="mr-1 inline h-3 w-3" /> Theo file trường
                </button>
              </div>
            </div>

            {/* Colored Subject Filter Chips with counts */}
            <div className="flex flex-wrap gap-1">
              {ORDERED_SUBJECTS.map((subj) => {
                const count = subj === 'Tất cả' ? null : lessonSubjectCounts[subj] || 0;
                if (subj !== 'Tất cả' && count === 0 && Object.keys(lessonSubjectCounts).length > 0 && crawledViewMode === 'lessons') {
                  return null;
                }
                const active = subjectFilter === subj;
                const sv = getSubjectVisual(subj);
                return (
                  <button
                    key={subj}
                    onClick={() => setSubjectFilter(subj)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                      active
                        ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                        : subj === 'Tất cả'
                        ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        : `${sv.chipClass} hover:opacity-85`
                    }`}
                  >
                    {subj}
                    {count !== null && count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Inline Visual Preview Drawer (appears cleanly over the list when clicking "Xem trước") */}
      {previewTarget && (
        <div className="border-b-2 border-[#0B6E5C] bg-white p-3 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#0B6E5C]">
                <Eye className="h-3 w-3" /> Xem trước định dạng sẽ chèn vào Word
              </div>
              <div className="mt-0.5 text-xs font-bold text-slate-900">{previewTarget.title}</div>
              <div className="text-[10px] text-slate-500">{previewTarget.subtitle}</div>
            </div>
            <button
              onClick={() => setPreviewTarget(null)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-[#FCFDFC] p-3 text-[12px] leading-relaxed text-slate-800 [&_h3]:mb-1 [&_h3]:text-center [&_h3]:font-bold [&_h3]:text-[#0B6E5C] [&_p]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
            dangerouslySetInnerHTML={{ __html: previewTarget.html }}
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={previewTarget.onInsertFull}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#085A4B]"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> Chèn khung tiết đầy đủ
            </button>
            <button
              onClick={previewTarget.onInsertShort}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Dòng ngắn
            </button>
          </div>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {activeTab === 'smart' && (
          <>
            <div className="rounded-xl border border-emerald-200/80 bg-white p-2.5 text-[11px] text-slate-700">
              <div className="font-bold text-[#074F42]">
                Đề xuất ưu tiên cho Tuần {plan.weekNumber}: {plan.subThemeName}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                Tự động lọc theo Chủ đề “{plan.themeName}”{planMonthLabel ? ` • ${planMonthLabel}` : ''} và các mã MT đã gắn trong bài.
              </div>
            </div>

            {smartObjectives.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                Không tìm thấy mục tiêu khớp bộ lọc hiện tại. Thử xóa từ khóa hoặc chuyển sang tab <strong>345 MT</strong>.
              </div>
            ) : (
              smartObjectives.map(({ obj, reasons }) => renderMtCard(obj, reasons))
            )}
          </>
        )}

        {activeTab === 'mt' && (
          <>
            {filteredObjectives.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                Không có mục tiêu nào khớp bộ lọc.
              </div>
            ) : (
              filteredObjectives.slice(0, 35).map((obj) => renderMtCard(obj))
            )}
          </>
        )}

        {activeTab === 'crawled' && (
          <>
            {loadingCrawled ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                Đang lọc bài dạy từ kho 1.050 giáo án thực tế...
              </div>
            ) : crawledViewMode === 'lessons' ? (
              crawledLessons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                  Không có tiết học nào khớp từ khóa “{search}”.
                </div>
              ) : (
                crawledLessons.map((les) => {
                  const sv = getSubjectVisual(les.subject);
                  const linkedObj = les.mtCode ? ageObjByCode.get(les.mtCode) : undefined;
                  const snipOpen = Boolean(expandedSnippets[les.id]);
                  return (
                    <div
                      key={les.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs transition hover:border-slate-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                            {les.subject}
                          </span>
                          {les.mtCode && (
                            <span className="rounded bg-[#E6F4F1] px-1.5 py-0.5 text-[10px] font-bold text-[#0B6E5C]">
                              {les.mtCode}
                            </span>
                          )}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {les.detectedMonth}
                          </span>
                        </div>
                        {les.postUrl && (
                          <a
                            href={les.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Mở bài viết gốc của trường"
                            className="text-slate-400 hover:text-[#0B6E5C]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Full readable lesson title */}
                      <p className="mt-2 text-xs leading-relaxed font-semibold text-slate-900">
                        {les.topic}
                      </p>

                      <div className="mt-1 text-[10px] text-slate-500">
                        Nguồn: <span className="font-medium text-slate-700">{les.schoolName}</span>
                      </div>

                      {/* Expandable source document excerpt */}
                      {snipOpen && les.snippet && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
                          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                            Trích đoạn giáo án gốc ({les.postTitle}):
                          </div>
                          {les.snippet}
                        </div>
                      )}

                      {/* Action bar */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {cursorContext.inTable ? (
                          <>
                            <button
                              onClick={() => onInsertShortLessonLine(les.topic, les.subject, les.mtCode)}
                              className="inline-flex items-center gap-1 rounded-md bg-[#0B6E5C] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                            >
                              <Plus className="h-3 w-3" /> Chèn vào bảng
                            </button>
                            <button
                              onClick={() => onInsertLessonFrame(les.topic, les.subject, les.mtCode, linkedObj)}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#0B6E5C] ring-1 ring-slate-200 hover:bg-[#E6F4F1]"
                            >
                              <FilePlus2 className="h-3 w-3" /> Khung tiết
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onInsertLessonFrame(les.topic, les.subject, les.mtCode, linkedObj)}
                              className="inline-flex items-center gap-1 rounded-md bg-[#0B6E5C] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                            >
                              <FilePlus2 className="h-3 w-3" /> Chèn khung tiết
                            </button>
                            <button
                              onClick={() => onInsertShortLessonLine(les.topic, les.subject, les.mtCode)}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                            >
                              <Plus className="h-3 w-3" /> Dòng ngắn
                            </button>
                          </>
                        )}

                        <button
                          onClick={() =>
                            openCrawledLessonPreview(les.topic, les.subject, les.mtCode, les.schoolName, linkedObj)
                          }
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-[#0B6E5C]"
                        >
                          <Eye className="h-3 w-3" /> Xem
                        </button>

                        {les.snippet && (
                          <button
                            onClick={() => toggleExpandSnippet(les.id)}
                            className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#0B6E5C] hover:underline"
                          >
                            {snipOpen ? 'Ẩn trích đoạn' : 'Trích đoạn gốc'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              crawledDocs.map((doc) => {
                const topMt = doc.matchedMts?.[0]?.code || '';
                const obj = ageObjByCode.get(topMt);
                const snipKey = `doc_${doc.id}`;
                const snipOpen = Boolean(expandedSnippets[snipKey]);
                const cleanLessons = (doc.extractedLessons || []).filter(
                  (l) => (l.topic || '').trim().length >= 14
                );
                return (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                            {(doc.ext || '.docx').replace('.', '')}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {doc.detectedMonth}
                          </span>
                          {topMt && (
                            <span className="rounded bg-[#E6F4F1] px-1.5 py-0.5 text-[10px] font-bold text-[#0B6E5C]">
                              {topMt}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs leading-snug font-bold text-slate-900">
                          {doc.postTitle}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{doc.schoolName}</div>
                      </div>
                      {doc.postUrl && (
                        <a
                          href={doc.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-slate-400 hover:text-[#0B6E5C]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    {doc.snippet && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleExpandSnippet(snipKey)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0B6E5C] hover:underline"
                        >
                          {snipOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {snipOpen ? 'Ẩn trích đoạn văn bản gốc' : 'Xem trích đoạn văn bản gốc'}
                        </button>
                        {snipOpen && (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                            {doc.snippet}
                          </div>
                        )}
                      </div>
                    )}

                    {cleanLessons.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                        {cleanLessons.slice(0, 5).map((les, idx) => {
                          const sv = getSubjectVisual(les.subject);
                          const mt = les.mtCode || topMt;
                          return (
                            <div
                              key={idx}
                              className="rounded-lg bg-slate-50 p-2 text-[11px]"
                            >
                              <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                                {les.subject}
                              </span>
                              <p className="mt-1 leading-snug text-slate-800">{les.topic}</p>
                              <div className="mt-1.5 flex gap-1.5">
                                <button
                                  onClick={() => onInsertLessonFrame(les.topic, les.subject, mt, obj)}
                                  className="inline-flex items-center gap-1 rounded bg-[#0B6E5C] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                                >
                                  <FilePlus2 className="h-3 w-3" /> Chèn tiết
                                </button>
                                <button
                                  onClick={() => onInsertShortLessonLine(les.topic, les.subject, mt)}
                                  className="inline-flex items-center gap-0.5 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                                >
                                  <Plus className="h-3 w-3" /> Dòng ngắn
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Footer button to open full-screen modal */}
      <div className="border-t border-slate-200 bg-white px-3.5 py-2.5">
        <button
          onClick={() => onOpenFullLibrary(activeTab === 'crawled' ? 'crawled' : 'bank')}
          className="w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[#0B6E5C] hover:bg-[#F2F9F7] hover:text-[#0B6E5C]"
        >
          Mở rộng toàn màn hình kho tra cứu tham khảo →
        </button>
      </div>
    </aside>
  );
};
