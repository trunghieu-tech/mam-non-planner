import React, { useEffect, useState } from 'react';
import type { AgeGroupId, ObjectivesDataset } from '../../shared/types';
import { FIVE_CORNERS, getSubjectVisual } from '../utils/visualMeta';

interface CrawledDocItem {
  id: number;
  ageGroupId: AgeGroupId;
  schoolName: string;
  schoolHost: string;
  postTitle: string;
  filename: string;
  ext: string;
  detectedMonth: string;
  postUrl: string;
  matchedMts: Array<{ code: string; score: number; tier: string }>;
  extractedLessons: Array<{ subject: string; topic: string; type: string; mtCode?: string }>;
  snippet: string;
}

interface CrawledLessonItem {
  id: string;
  docId: number;
  ageGroupId: AgeGroupId;
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
}

interface CrawledSummary {
  available: boolean;
  totalDocs: number;
  totalLessons: number;
  totalSchools: number;
  byAgeGroup: Record<string, number>;
  updatedAt?: string;
}

interface Props {
  dataset: ObjectivesDataset;
  summary: CrawledSummary;
  onRefreshSummary: () => void;
  onInsertCrawledLesson: (lesson: { subject: string; topic: string }, mtCode: string, ageGroupId: AgeGroupId) => void;
}

const MAIN_SUBJECTS = ['Tất cả', 'GDAN', 'Tạo hình', 'LQVH', 'LQVT', 'MTXQ', 'PTVĐ', 'KNS', 'LQCC', 'NBTN'];

export const CrawledLibraryView: React.FC<Props> = ({
  dataset,
  summary,
  onRefreshSummary,
  onInsertCrawledLesson,
}) => {
  const [viewMode, setViewMode] = useState<'lessons' | 'docs'>('lessons');
  const [slotTab, setSlotTab] = useState<'MAIN' | 'CORNER' | 'OUTDOOR' | 'AFTERNOON'>('MAIN');
  const [query, setQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState<string>('');
  const [mtFilter, setMtFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('Tất cả');
  const [cornerFilter, setCornerFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<CrawledDocItem[]>([]);
  const [lessons, setLessons] = useState<CrawledLessonItem[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [cornerCounts, setCornerCounts] = useState<Record<string, number>>({});
  const [totalMatched, setTotalMatched] = useState(0);
  const [expandedSnips, setExpandedSnips] = useState<Record<string, boolean>>({});

  const loadData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (ageFilter) params.set('ageGroupId', ageFilter);
    if (mtFilter.trim()) params.set('mtCode', mtFilter.trim().toUpperCase());

    if (viewMode === 'lessons') {
      params.set('slotType', slotTab);
      if (slotTab === 'MAIN' && subjectFilter !== 'Tất cả') params.set('subject', subjectFilter);
      if (slotTab === 'CORNER' && cornerFilter !== 'ALL') params.set('cornerSubType', cornerFilter);
      params.set('limit', '60');
      fetch(`/api/kb/lessons?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setLessons(d.items || []);
          setSubjectCounts(d.subjectCounts || {});
          setSlotCounts(d.slotCounts || {});
          setCornerCounts(d.cornerCounts || {});
          setTotalMatched(d.total || 0);
        })
        .finally(() => setLoading(false));
    } else {
      params.set('limit', '40');
      fetch(`/api/kb/docs?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setDocs(d.items || []);
          setTotalMatched(d.total || 0);
        })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [ageFilter, viewMode, slotTab, subjectFilter, cornerFilter]);

  const toggleSnip = (key: string) =>
    setExpandedSnips((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-[#0B6E5C]">
              Kho tài liệu thực tế đã cào &amp; Convert JSON + Map 345 MT
            </div>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              {summary.available
                ? `${summary.totalDocs.toLocaleString('vi-VN')} tài liệu đã kiểm chứng • ${summary.totalLessons.toLocaleString('vi-VN')} bài dạy từ ${summary.totalSchools} trường mầm non`
                : 'Kho dữ liệu JSON đang được nạp...'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setViewMode('lessons')}
                className={`rounded-lg px-3 py-1 transition ${
                  viewMode === 'lessons' ? 'bg-[#0B6E5C] text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                Theo Tiết học
              </button>
              <button
                onClick={() => setViewMode('docs')}
                className={`rounded-lg px-3 py-1 transition ${
                  viewMode === 'docs' ? 'bg-[#0B6E5C] text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                Theo Tài liệu gốc
              </button>
            </div>

            <button
              onClick={() => {
                onRefreshSummary();
                loadData();
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Làm mới
            </button>
          </div>
        </div>

        {/* Breakdown by age group */}
        {summary.available && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {dataset.ageGroups.map((ag) => (
              <button
                key={ag.id}
                onClick={() => setAgeFilter(ageFilter === ag.id ? '' : ag.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  ageFilter === ag.id
                    ? 'border-[#0B6E5C] bg-[#E6F4F1]'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="text-xs font-medium text-slate-600">{ag.name}</div>
                <div className="mt-0.5 text-xl font-bold text-[#0B6E5C]">
                  {(summary.byAgeGroup?.[ag.id] || 0).toLocaleString('vi-VN')}
                </div>
                <div className="text-[11px] text-slate-400">tài liệu .docx/.pdf</div>
              </button>
            ))}
          </div>
        )}

        {/* Search form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-12"
        >
          <div className="md:col-span-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm đề tài, tên bài hát, bài thơ, trò chơi, tên trường..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
            />
          </div>
          <input
            value={mtFilter}
            onChange={(e) => setMtFilter(e.target.value)}
            placeholder="Lọc mã MT (VD: MT100)"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:col-span-3"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#085A4B] md:col-span-3"
          >
            Tìm kiếm
          </button>
        </form>

        {/* Pedagogical Category + Subject / Corner Filter Bar */}
        {viewMode === 'lessons' && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Phân loại hoạt động:</span>
              {(
                [
                  { id: 'MAIN', label: 'HĐ Học có chủ đích (8 môn)' },
                  { id: 'CORNER', label: '5 Góc chơi' },
                  { id: 'OUTDOOR', label: 'HĐ Ngoài trời / Trò chơi' },
                  { id: 'AFTERNOON', label: 'HĐ Chiều / Ôn luyện' },
                ] as const
              ).map((tab) => {
                const active = slotTab === tab.id;
                const cnt = slotCounts[tab.id] || 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSlotTab(tab.id);
                      setSubjectFilter('Tất cả');
                      setCornerFilter('ALL');
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {tab.label} {cnt > 0 ? `(${cnt})` : ''}
                  </button>
                );
              })}
            </div>

            {slotTab === 'MAIN' && (
              <div className="flex flex-wrap gap-1.5">
                {MAIN_SUBJECTS.map((subj) => {
                  const count = subj === 'Tất cả' ? null : subjectCounts[subj] || 0;
                  if (subj !== 'Tất cả' && count === 0 && Object.keys(subjectCounts).length > 0) return null;
                  const active = subjectFilter === subj;
                  const sv = getSubjectVisual(subj);
                  return (
                    <button
                      key={subj}
                      onClick={() => setSubjectFilter(subj)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
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
            )}

            {slotTab === 'CORNER' && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCornerFilter('ALL')}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    cornerFilter === 'ALL'
                      ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  Tất cả 5 góc
                </button>
                {FIVE_CORNERS.map((cn) => {
                  const cnt = cornerCounts[cn] || 0;
                  const active = cornerFilter === cn;
                  return (
                    <button
                      key={cn}
                      onClick={() => setCornerFilter(cn)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                          : 'border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100'
                      }`}
                    >
                      {cn} {cnt > 0 ? `(${cnt})` : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải dữ liệu đã phân loại...
        </div>
      ) : viewMode === 'lessons' ? (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            Tìm thấy <strong>{totalMatched.toLocaleString('vi-VN')}</strong> tiết học thực tế sạch, đã lọc trùng (hiển thị {lessons.length} kết quả ưu tiên).
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {lessons.map((les) => {
              const sv = getSubjectVisual(les.subject);
              const ag = dataset.ageGroups.find((g) => g.id === les.ageGroupId);
              const isOpen = Boolean(expandedSnips[les.id]);
              return (
                <div
                  key={les.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${sv.chipClass}`}>
                          {les.subject}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {ag?.short || les.ageGroupId}
                        </span>
                        {les.mtCode && (
                          <span className="rounded bg-[#E6F4F1] px-2 py-0.5 text-[11px] font-bold text-[#0B6E5C]">
                            {les.mtCode}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{les.detectedMonth}</span>
                      </div>
                      {les.postUrl && (
                        <a
                          href={les.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-400 hover:text-[#0B6E5C] hover:underline"
                        >
                          Nguồn ↗
                        </a>
                      )}
                    </div>

                    <p className="mt-2 text-sm leading-relaxed font-bold text-slate-900">
                      {les.topic}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {les.schoolName} • <span className="italic">{les.postTitle}</span>
                    </p>

                    {isOpen && les.snippet && (
                      <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                        {les.snippet}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    {les.snippet ? (
                      <button
                        onClick={() => toggleSnip(les.id)}
                        className="text-xs font-semibold text-[#0B6E5C] hover:underline"
                      >
                        {isOpen ? 'Ẩn trích đoạn gốc' : 'Xem trích đoạn gốc'}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => onInsertCrawledLesson(les, les.mtCode, les.ageGroupId)}
                      className="inline-flex items-center rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085A4B]"
                    >
                      + Chèn khung tiết vào Word
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            Tìm thấy <strong>{totalMatched.toLocaleString('vi-VN')}</strong> tài liệu khớp bộ lọc (hiển thị {docs.length} kết quả đầu).
          </div>
          {docs.map((doc) => {
            const ag = dataset.ageGroups.find((g) => g.id === doc.ageGroupId);
            const topMt = doc.matchedMts?.[0]?.code || '';
            const snipKey = `m_doc_${doc.id}`;
            const isOpen = Boolean(expandedSnips[snipKey]);
            const cleanLessons = (doc.extractedLessons || []).filter(
              (l) => (l.topic || '').trim().length >= 14
            );
            return (
              <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#E6F4F1] px-2.5 py-0.5 text-xs font-semibold text-[#0B6E5C]">
                        {ag?.short || doc.ageGroupId}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {doc.detectedMonth}
                      </span>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-sky-700">
                        {doc.ext.replace('.', '')}
                      </span>
                      <span className="text-xs font-medium text-slate-600">{doc.schoolName}</span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold text-slate-900">{doc.postTitle || doc.filename}</h3>
                  </div>
                  {doc.postUrl && (
                    <a
                      href={doc.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#0B6E5C] hover:underline"
                    >
                      Nguồn gốc ↗
                    </a>
                  )}
                </div>

                {doc.matchedMts?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {doc.matchedMts.slice(0, 8).map((m) => (
                      <span
                        key={m.code}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          m.tier === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'border border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {m.code} ({Math.round(m.score * 100)}%)
                      </span>
                    ))}
                  </div>
                )}

                {doc.snippet && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleSnip(snipKey)}
                      className="text-xs font-semibold text-[#0B6E5C] hover:underline"
                    >
                      {isOpen ? 'Ẩn trích đoạn văn bản gốc' : 'Xem trích đoạn văn bản gốc'}
                    </button>
                    {isOpen && (
                      <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                        {doc.snippet}
                      </div>
                    )}
                  </div>
                )}

                {cleanLessons.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5">
                    <div className="text-xs font-semibold text-slate-600">
                      Bài dạy trích xuất ({cleanLessons.length}):
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {cleanLessons.slice(0, 6).map((les, idx) => {
                        const sv = getSubjectVisual(les.subject);
                        return (
                          <div
                            key={idx}
                            className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 text-xs"
                          >
                            <div>
                              <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${sv.chipClass}`}>
                                {les.subject}
                              </span>
                              <p className="mt-1 leading-snug text-slate-800">{les.topic}</p>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => onInsertCrawledLesson(les, les.mtCode || topMt, doc.ageGroupId)}
                                className="inline-flex items-center rounded-lg bg-[#0B6E5C] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#085A4B]"
                              >
                                + Chèn tiết
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
      )}
    </div>
  );
};
