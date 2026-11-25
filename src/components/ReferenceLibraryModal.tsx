import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Database,
  ExternalLink,
  Feather,
  Film,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgeGroupId,
  ObjectiveItem,
  ObjectivesDataset,
  SavedLessonTemplate,
  SharedMediaResource,
  SuggestedActivity,
} from '../../shared/types';
import { SUBJECT_CATALOG } from '../utils/subjectTemplates';
import { filterWorksForAssistant } from '../utils/worksLookup';
import { ObjectiveBankView } from './ObjectiveBankView';
import { CrawledLibraryView } from './CrawledLibraryView';

interface CrawledSummary {
  available: boolean;
  totalDocs: number;
  totalLessons: number;
  totalSchools: number;
  byAgeGroup: Record<string, number>;
  updatedAt?: string;
}

interface Props {
  initialTab: 'bank' | 'crawled' | 'works' | 'media';
  dataset: ObjectivesDataset;
  selectedAgeGroup: AgeGroupId;
  onSelectAgeGroup: (id: AgeGroupId) => void;
  activePlanTitle: string;
  crawledSummary: CrawledSummary;
  onRefreshSummary: () => void;
  onAttachMt: (obj: ObjectiveItem) => void;
  onInsertExcelActivity: (obj: ObjectiveItem, act: SuggestedActivity) => void;
  onInsertCrawledLesson: (
    lesson: { subject: string; topic: string },
    mtCode: string,
    ageGroupId: AgeGroupId
  ) => void;
  onClose: () => void;
}

const MEDIA_KIND_LABELS: Record<SharedMediaResource['kind'], string> = {
  VIDEO: 'Video giảng dạy',
  SLIDE: 'Bài giảng PowerPoint',
  ELEARNING: 'Bài giảng E-Learning',
  IMAGE: 'Tranh ảnh trực quan',
  DOC: 'Văn bản / SKKN',
};

export const ReferenceLibraryModal: React.FC<Props> = ({
  initialTab,
  dataset,
  selectedAgeGroup,
  onSelectAgeGroup,
  activePlanTitle,
  crawledSummary,
  onRefreshSummary,
  onAttachMt,
  onInsertExcelActivity,
  onInsertCrawledLesson,
  onClose,
}) => {
  const [tab, setTab] = useState<'bank' | 'crawled' | 'works' | 'media'>(initialTab);
  const [workKind, setWorkKind] = useState<'ALL' | 'POEM' | 'STORY' | 'SONG' | 'LQCC'>('ALL');
  const [workQuery, setWorkQuery] = useState('');

  // State cho Kho Media & Bài giảng mẫu cá nhân (YC-053)
  const [mediaKind, setMediaKind] = useState<'ALL' | SharedMediaResource['kind']>('ALL');
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaList, setMediaList] = useState<SharedMediaResource[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedLessonTemplate[]>([]);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaKind, setNewMediaKind] = useState<SharedMediaResource['kind']>('VIDEO');
  const [newMediaSubj, setNewMediaSubj] = useState('MTXQ');

  const worksList = useMemo(() => {
    const all = filterWorksForAssistant('ALL', selectedAgeGroup, workQuery);
    return workKind === 'ALL' ? all : all.filter((w) => w.kind === workKind);
  }, [selectedAgeGroup, workKind, workQuery]);

  const loadMediaAndTemplates = () => {
    const pm = new URLSearchParams({ ageGroupId: selectedAgeGroup });
    if (mediaKind !== 'ALL') pm.set('kind', mediaKind);
    if (mediaQuery.trim()) pm.set('q', mediaQuery.trim());
    fetch(`/api/media?${pm.toString()}`)
      .then((r) => r.json())
      .then((d) => setMediaList(d.items || []))
      .catch(() => setMediaList([]));

    fetch(`/api/templates?ageGroupId=${selectedAgeGroup}`)
      .then((r) => r.json())
      .then((d) => setSavedTemplates(d.templates || []))
      .catch(() => setSavedTemplates([]));
  };

  useEffect(() => {
    if (tab === 'media') {
      loadMediaAndTemplates();
    }
  }, [tab, selectedAgeGroup, mediaKind, mediaQuery]);

  const handleCreateMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaTitle.trim() || !newMediaUrl.trim()) return;
    await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: newMediaKind,
        title: newMediaTitle.trim(),
        url: newMediaUrl.trim(),
        subjectCode: newMediaSubj,
        ageGroupId: selectedAgeGroup,
        themeName: 'Học liệu lớp tải lên',
        author: 'Giáo viên lớp',
      }),
    });
    setNewMediaTitle('');
    setNewMediaUrl('');
    setShowAddMedia(false);
    loadMediaAndTemplates();
  };

  const handleDeleteMedia = async (id: string) => {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setMediaList((prev) => prev.filter((m) => m.id !== id));
  };

  const handleDeleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">Thư viện Học liệu &amp; Media</span>
            <div className="ml-1 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setTab('bank')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                  tab === 'bank' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" /> 345 Mục tiêu ({dataset.totalActivities} HĐ)
              </button>
              <button
                onClick={() => setTab('works')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                  tab === 'works' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Feather className="h-3.5 w-3.5" /> Kho Ngữ liệu &amp; 29 Chữ cái
              </button>
              <button
                onClick={() => setTab('media')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                  tab === 'media' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Film className="h-3.5 w-3.5" /> Bài mẫu &amp; Kho Media
              </button>
              <button
                onClick={() => setTab('crawled')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                  tab === 'crawled' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Database className="h-3.5 w-3.5" /> Giáo án thực tế ({crawledSummary.totalDocs})
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'bank' ? (
            <ObjectiveBankView
              dataset={dataset}
              selectedAgeGroup={selectedAgeGroup}
              onSelectAgeGroup={onSelectAgeGroup}
              activePlanTitle={activePlanTitle}
              onAttachMtToPlan={onAttachMt}
              onInsertActivityToPlan={(o, a) => {
                onInsertExcelActivity(o, a);
                onClose();
              }}
            />
          ) : tab === 'works' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {dataset.ageGroups.map((ag) => (
                    <button
                      key={ag.id}
                      onClick={() => onSelectAgeGroup(ag.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        selectedAgeGroup === ag.id
                          ? 'bg-[#0B6E5C] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ag.name}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'ALL', label: 'Tất cả' },
                      { id: 'POEM', label: 'Thơ' },
                      { id: 'STORY', label: 'Truyện kể' },
                      { id: 'SONG', label: 'Bài hát' },
                      { id: 'LQCC', label: '29 Chữ cái' },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setWorkKind(k.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        workKind === k.id
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}

                  <div className="relative">
                    <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={workQuery}
                      onChange={(e) => setWorkQuery(e.target.value)}
                      placeholder="Tìm tên bài thơ, bài hát, chữ cái..."
                      className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {worksList.map((w) => {
                  const subj = w.kind === 'SONG' ? 'GDAN' : w.kind === 'LQCC' ? 'LQCC' : 'LQVH';
                  const topicPrefix =
                    w.kind === 'POEM'
                      ? `Thơ: ${w.title}`
                      : w.kind === 'STORY'
                      ? `Truyện: ${w.title}`
                      : w.kind === 'SONG'
                      ? `Dạy hát: ${w.title}`
                      : w.title;

                  return (
                    <div
                      key={w.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-[#E6F4F1] px-2 py-0.5 text-[11px] font-bold text-[#0B6E5C]">
                            {w.kind === 'POEM'
                              ? 'Bài thơ'
                              : w.kind === 'STORY'
                              ? 'Truyện kể'
                              : w.kind === 'SONG'
                              ? 'Bài hát'
                              : 'Làm quen chữ cái'}
                          </span>
                          <span className="text-xs text-slate-400">{w.author}</span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-slate-900">{w.title}</h4>
                        <div className="mt-2 max-h-36 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-xs italic leading-relaxed text-slate-700">
                          {w.contentText}
                        </div>
                        <div className="mt-2.5 space-y-1 text-[11px] text-slate-600">
                          <div className="font-bold text-slate-700">Câu hỏi đàm thoại chuẩn bị sẵn:</div>
                          {w.dialogueQuestions.slice(0, 3).map((q, idx) => (
                            <div key={idx}>• {q}</div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onInsertCrawledLesson({ subject: subj, topic: topicPrefix }, '', selectedAgeGroup);
                          onClose();
                        }}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B6E5C] px-3 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Đưa tác phẩm này thành 1 tiết trong tuần
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : tab === 'media' ? (
            <div className="space-y-5">
              {/* Khối 1: Bài giảng mẫu cá nhân đã lưu từ Bước 4 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Bookmark className="h-4 w-4 text-amber-600" />
                    <span>Bài giảng mẫu cá nhân đã lưu ({savedTemplates.length})</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Bấm “Lưu bài mẫu” khi soạn ở mục Giáo án Ngày để cất vào đây
                  </span>
                </div>

                {savedTemplates.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Chưa có bài giảng mẫu cá nhân nào cho khối tuổi này.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-900">{tpl.topicTitle}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Môn: <strong>{tpl.subjectCode}</strong>
                            {tpl.linkedMtCodes?.[0] ? ` · ${tpl.linkedMtCodes[0]}` : ''} · GV: {tpl.createdBy}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => {
                              onInsertCrawledLesson(
                                { subject: tpl.subjectCode, topic: tpl.topicTitle },
                                tpl.linkedMtCodes?.[0] || '',
                                tpl.ageGroupId
                              );
                              onClose();
                            }}
                            className="rounded-lg bg-[#0B6E5C] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#085A4B]"
                          >
                            + Xếp vào tuần
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Khối 2: Kho Học liệu Điện tử & Media chia sẻ (Video / Slide / E-Learning / Ảnh) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Kho Học liệu Điện tử &amp; Media Giảng dạy ({mediaList.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Quản lý link Video YouTube, Slide PowerPoint, E-Learning và tranh trực quan phục vụ tiết dạy
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddMedia((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B6E5C] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
                  >
                    <Plus className="h-3.5 w-3.5" /> {showAddMedia ? 'Đóng biểu mẫu' : 'Thêm Video / Học liệu mới'}
                  </button>
                </div>

                {showAddMedia && (
                  <form
                    onSubmit={handleCreateMedia}
                    className="mt-3 grid gap-2.5 rounded-xl border border-emerald-200 bg-[#F8FCFB] p-3.5 md:grid-cols-12"
                  >
                    <select
                      value={newMediaKind}
                      onChange={(e) => setNewMediaKind(e.target.value as SharedMediaResource['kind'])}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold md:col-span-2"
                    >
                      <option value="VIDEO">Video / YouTube</option>
                      <option value="SLIDE">PowerPoint</option>
                      <option value="ELEARNING">E-Learning</option>
                      <option value="IMAGE">Tranh ảnh</option>
                      <option value="DOC">Tài liệu / SKKN</option>
                    </select>
                    <select
                      value={newMediaSubj}
                      onChange={(e) => setNewMediaSubj(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold md:col-span-2"
                    >
                      {SUBJECT_CATALOG.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.shortLabel}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newMediaTitle}
                      onChange={(e) => setNewMediaTitle(e.target.value)}
                      placeholder="Tên học liệu / video minh họa..."
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs md:col-span-4"
                    />
                    <input
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      placeholder="Đường dẫn URL (YouTube, Google Drive...)"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs md:col-span-3"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#085A4B] md:col-span-1"
                    >
                      Lưu
                    </button>
                  </form>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'ALL', label: 'Tất cả' },
                        { id: 'VIDEO', label: 'Video' },
                        { id: 'SLIDE', label: 'PowerPoint' },
                        { id: 'ELEARNING', label: 'E-Learning' },
                        { id: 'IMAGE', label: 'Tranh ảnh' },
                        { id: 'DOC', label: 'Văn bản' },
                      ] as const
                    ).map((k) => (
                      <button
                        key={k.id}
                        onClick={() => setMediaKind(k.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          mediaKind === k.id
                            ? 'bg-[#E6F4F1] text-[#0B6E5C]'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={mediaQuery}
                    onChange={(e) => setMediaQuery(e.target.value)}
                    placeholder="Tìm học liệu..."
                    className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {mediaList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-[#E6F4F1] px-2 py-0.5 text-[10px] font-bold text-[#0B6E5C]">
                            {MEDIA_KIND_LABELS[m.kind]}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">{m.subjectCode}</span>
                        </div>
                        <div className="mt-1.5 font-bold text-slate-900">{m.title}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {m.themeName} · {m.author}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Mở xem học liệu"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-[#0B6E5C]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {m.id.startsWith('med_17') && (
                          <button
                            onClick={() => handleDeleteMedia(m.id)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <CrawledLibraryView
              dataset={dataset}
              summary={crawledSummary}
              onRefreshSummary={onRefreshSummary}
              onInsertCrawledLesson={(les, mt, ag) => {
                onInsertCrawledLesson(les, mt, ag);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
