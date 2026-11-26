import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
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
  onApplySavedTemplate?: (tpl: SavedLessonTemplate) => void;
  onInsertCrawledLesson: (
    lesson: { subject: string; topic: string },
    mtCode: string,
    ageGroupId: AgeGroupId
  ) => void;
  onClose: () => void;
}

const MEDIA_KIND_LABELS: Record<SharedMediaResource['kind'], string> = {
  VIDEO: 'Video / Clip',
  SLIDE: 'PowerPoint',
  ELEARNING: 'E-Learning',
  AUDIO: 'Audio / Nhạc',
  IMAGE: 'Tranh ảnh',
  DOC: 'Tài liệu',
};

const MEDIA_KIND_BADGE: Record<SharedMediaResource['kind'], string> = {
  VIDEO: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
  SLIDE: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  ELEARNING: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
  AUDIO: 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200',
  IMAGE: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
  DOC: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
};

function toYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

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
  onApplySavedTemplate,
  onInsertCrawledLesson,
  onClose,
}) => {
  const [tab, setTab] = useState<'bank' | 'crawled' | 'works' | 'media'>(initialTab);
  const [workAgeFilter, setWorkAgeFilter] = useState<'ALL' | AgeGroupId>('ALL');
  const [workKind, setWorkKind] = useState<'ALL' | 'POEM' | 'STORY' | 'SONG' | 'LQCC' | 'RIDDLE'>('ALL');
  const [workQuery, setWorkQuery] = useState('');

  // State cho Kho Media & Bài giảng mẫu cá nhân (YC-053, YC-064)
  const [mediaAgeFilter, setMediaAgeFilter] = useState<'ALL' | AgeGroupId>('ALL');
  const [mediaSubjFilter, setMediaSubjFilter] = useState<string>('ALL');
  const [mediaKind, setMediaKind] = useState<'ALL' | SharedMediaResource['kind']>('ALL');
  const [mediaQuery, setMediaQuery] = useState('');
  const [allMediaPool, setAllMediaPool] = useState<SharedMediaResource[]>([]);
  const [previewMedia, setPreviewMedia] = useState<SharedMediaResource | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedLessonTemplate[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaAuthor, setNewMediaAuthor] = useState('');
  const [newMediaTheme, setNewMediaTheme] = useState('');
  const [newMediaKind, setNewMediaKind] = useState<SharedMediaResource['kind']>('VIDEO');
  const [newMediaSubj, setNewMediaSubj] = useState('MTXQ');

  const worksList = useMemo(() => {
    const all = filterWorksForAssistant('ALL', workAgeFilter, workQuery);
    return workKind === 'ALL' ? all : all.filter((w) => w.kind === workKind);
  }, [workAgeFilter, workKind, workQuery]);

  const loadMediaAndTemplates = (checkCancelled?: () => boolean) => {
    setLoadingMedia(true);
    const pm = new URLSearchParams();
    if (mediaAgeFilter !== 'ALL') pm.set('ageGroupId', mediaAgeFilter);
    if (mediaSubjFilter !== 'ALL') pm.set('subjectCode', mediaSubjFilter);
    if (mediaQuery.trim()) pm.set('q', mediaQuery.trim());

    const tplParams = new URLSearchParams();
    if (mediaAgeFilter !== 'ALL') tplParams.set('ageGroupId', mediaAgeFilter);
    if (mediaSubjFilter !== 'ALL') tplParams.set('subjectCode', mediaSubjFilter);

    Promise.all([
      fetch(`/api/media?${pm.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!checkCancelled?.()) setAllMediaPool(d.items || []);
        })
        .catch(() => {
          if (!checkCancelled?.()) setAllMediaPool([]);
        }),
      fetch(`/api/templates?${tplParams.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!checkCancelled?.()) setSavedTemplates(d.templates || []);
        })
        .catch(() => {
          if (!checkCancelled?.()) setSavedTemplates([]);
        }),
    ]).finally(() => {
      if (!checkCancelled?.()) setLoadingMedia(false);
    });
  };

  useEffect(() => {
    if (tab !== 'media') return;
    let cancelled = false;
    loadMediaAndTemplates(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [tab, selectedAgeGroup, mediaAgeFilter, mediaSubjFilter, mediaQuery]);

  const mediaCountsByKind = useMemo(() => {
    const counts: Record<string, number> = { ALL: allMediaPool.length };
    for (const m of allMediaPool) {
      counts[m.kind] = (counts[m.kind] || 0) + 1;
    }
    return counts;
  }, [allMediaPool]);

  const mediaList = useMemo(
    () => (mediaKind === 'ALL' ? allMediaPool : allMediaPool.filter((m) => m.kind === mediaKind)),
    [allMediaPool, mediaKind]
  );

  const handleLocalMediaFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newMediaTitle.trim()) {
      setNewMediaTitle(file.name.replace(/\.[^.]+$/, ''));
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'ppt' || ext === 'pptx') setNewMediaKind('SLIDE');
    else if (ext === 'mp4' || ext === 'webm' || ext === 'mov') setNewMediaKind('VIDEO');
    else if (ext === 'mp3' || ext === 'wav' || ext === 'm4a') setNewMediaKind('AUDIO');
    else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') setNewMediaKind('IMAGE');
    else setNewMediaKind('DOC');

    if (file.size <= 1.5 * 1024 * 1024 && /^(jpg|jpeg|png|webp|mp3)$/i.test(ext)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setNewMediaUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setNewMediaUrl(URL.createObjectURL(file));
    }
  };

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
        themeName: newMediaTheme.trim() || 'Học liệu lớp tải lên',
        author: newMediaAuthor.trim() || 'Giáo viên lớp',
      }),
    });
    setNewMediaTitle('');
    setNewMediaUrl('');
    setNewMediaAuthor('');
    setNewMediaTheme('');
    setShowAddMedia(false);
    loadMediaAndTemplates();
  };

  const handleDeleteMedia = async (id: string) => {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setAllMediaPool((prev) => prev.filter((m) => m.id !== id));
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
                className={`rounded-lg px-3 py-1 transition ${
                  tab === 'bank' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                }`}
              >
                345 Mục tiêu ({dataset.totalActivities} HĐ)
              </button>
              <button
                onClick={() => setTab('works')}
                className={`rounded-lg px-3 py-1 transition ${
                  tab === 'works' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Kho Ngữ liệu &amp; 29 Chữ cái
              </button>
              <button
                onClick={() => setTab('media')}
                className={`rounded-lg px-3 py-1 transition ${
                  tab === 'media' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Bài mẫu &amp; Kho Media
              </button>
              <button
                onClick={() => setTab('crawled')}
                className={`rounded-lg px-3 py-1 transition ${
                  tab === 'crawled' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Giáo án thực tế ({crawledSummary.totalDocs})
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
                  <button
                    onClick={() => setWorkAgeFilter('ALL')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      workAgeFilter === 'ALL'
                        ? 'bg-[#1D4ED8] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả 4 độ tuổi ({worksList.length})
                  </button>
                  {dataset.ageGroups.map((ag) => (
                    <button
                      key={ag.id}
                      onClick={() => {
                        setWorkAgeFilter(ag.id);
                        onSelectAgeGroup(ag.id);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        workAgeFilter === ag.id
                          ? 'bg-[#1D4ED8] text-white'
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
                      { id: 'RIDDLE', label: 'Đồng dao / Đố vui' },
                      { id: 'LQCC', label: '29 Chữ cái' },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setWorkKind(k.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        workKind === k.id
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}

                  <div>
                    <input
                      value={workQuery}
                      onChange={(e) => setWorkQuery(e.target.value)}
                      placeholder="Tìm tên bài thơ, bài hát, chữ cái..."
                      className="w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
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
                          <span className="rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-bold text-[#1D4ED8]">
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
                        className="mt-3 w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E40AF]"
                      >
                        + Đưa tác phẩm này thành 1 tiết trong tuần
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
                  <div className="text-sm font-bold text-slate-900">
                    Kho Giáo án mẫu chuẩn toàn quốc &amp; Cá nhân ({savedTemplates.length})
                  </div>
                  <span className="text-xs text-slate-400">
                    Bấm “Lưu bài mẫu” khi soạn ở mục Giáo án Ngày để cất vào đây
                  </span>
                </div>

                {loadingMedia && savedTemplates.length === 0 ? (
                  <p className="mt-3 text-xs font-medium text-[#1D4ED8]">
                    Đang tải kho giáo án mẫu chuẩn toàn quốc...
                  </p>
                ) : savedTemplates.length === 0 ? (
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
                              if (onApplySavedTemplate) {
                                onApplySavedTemplate(tpl);
                              } else {
                                onInsertCrawledLesson(
                                  { subject: tpl.subjectCode, topic: tpl.topicTitle },
                                  tpl.linkedMtCodes?.[0] || '',
                                  tpl.ageGroupId
                                );
                              }
                              onClose();
                            }}
                            className="rounded-lg bg-[#1D4ED8] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#1E40AF]"
                          >
                            + Xếp vào tuần
                          </button>
                          {!tpl.isSystem && (
                            <button
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="rounded p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Khối 2: Kho Học liệu Điện tử & Media chia sẻ (Video / Slide / E-Learning / Ảnh / Tài liệu) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Kho Học liệu Điện tử, PowerPoint, Clip &amp; Tranh ảnh ({mediaList.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tài liệu thực tế từ hệ thống trường mầm non công lập: tải trực tiếp PowerPoint (.pptx), xem clip tiết dạy (.mp4), bộ tranh ảnh và E-Learning
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddMedia((v) => !v)}
                    className="rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1E40AF]"
                  >
                    {showAddMedia ? 'Đóng biểu mẫu' : '+ Thêm Video / Học liệu mới'}
                  </button>
                </div>

                {showAddMedia && (
                  <form
                    onSubmit={handleCreateMedia}
                    className="mt-3 space-y-2.5 rounded-xl border border-blue-200 bg-[#F5F9FF] p-3.5 text-xs"
                  >
                    <div className="grid gap-2.5 md:grid-cols-12">
                      <select
                        value={newMediaKind}
                        onChange={(e) => setNewMediaKind(e.target.value as SharedMediaResource['kind'])}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold md:col-span-2"
                      >
                        <option value="VIDEO">Video / Clip</option>
                        <option value="SLIDE">PowerPoint</option>
                        <option value="ELEARNING">E-Learning</option>
                        <option value="AUDIO">Audio / Nhạc</option>
                        <option value="IMAGE">Tranh ảnh</option>
                        <option value="DOC">Tài liệu / SKKN</option>
                      </select>
                      <select
                        value={newMediaSubj}
                        onChange={(e) => setNewMediaSubj(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold md:col-span-2"
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
                        placeholder="Tiêu đề học liệu (*)"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 md:col-span-4"
                      />
                      <input
                        value={newMediaTheme}
                        onChange={(e) => setNewMediaTheme(e.target.value)}
                        placeholder="Chủ đề (VD: Bản thân bé)"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 md:col-span-2"
                      />
                      <input
                        value={newMediaAuthor}
                        onChange={(e) => setNewMediaAuthor(e.target.value)}
                        placeholder="Tác giả / Trường"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 md:col-span-2"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-lg border border-[#1D4ED8] bg-white px-3 py-1.5 font-bold text-[#1D4ED8] hover:bg-[#DBEAFE]">
                        Chọn tệp từ máy (.pptx, .mp4, .mp3, ảnh...)
                        <input
                          type="file"
                          accept=".ppt,.pptx,.mp4,.webm,.mp3,.wav,.jpg,.jpeg,.png,.pdf,.docx,.zip"
                          onChange={handleLocalMediaFilePick}
                          className="hidden"
                        />
                      </label>
                      <input
                        value={newMediaUrl}
                        onChange={(e) => setNewMediaUrl(e.target.value)}
                        placeholder="Hoặc dán đường dẫn URL (YouTube, Google Drive, Canva...)"
                        className="min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-[#1D4ED8] px-4 py-1.5 font-bold text-white hover:bg-[#1E40AF]"
                      >
                        Lưu học liệu
                      </button>
                    </div>
                  </form>
                )}

                {/* Bộ lọc đa chiều: Loại học liệu + Khối độ tuổi + Bộ môn + Tìm kiếm */}
                <div className="mt-3.5 space-y-2.5 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: 'Tất cả' },
                          { id: 'SLIDE', label: 'PowerPoint' },
                          { id: 'VIDEO', label: 'Video / Clip' },
                          { id: 'IMAGE', label: 'Tranh ảnh' },
                          { id: 'AUDIO', label: 'Audio' },
                          { id: 'ELEARNING', label: 'E-Learning' },
                          { id: 'DOC', label: 'Tài liệu' },
                        ] as const
                      ).map((k) => (
                        <button
                          key={k.id}
                          onClick={() => setMediaKind(k.id)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            mediaKind === k.id
                              ? 'bg-[#1D4ED8] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {k.label} ({mediaCountsByKind[k.id] || 0})
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mediaAgeFilter}
                        onChange={(e) => setMediaAgeFilter(e.target.value as 'ALL' | AgeGroupId)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <option value="ALL">Tất cả độ tuổi</option>
                        {dataset.ageGroups.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={mediaSubjFilter}
                        onChange={(e) => setMediaSubjFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <option value="ALL">Tất cả bộ môn</option>
                        {['MTXQ', 'LQVT', 'LQVH', 'GDAN', 'Tạo hình', 'PTVĐ', 'KNS', 'LQCC', 'NBTN'].map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))}
                      </select>

                      <input
                        value={mediaQuery}
                        onChange={(e) => setMediaQuery(e.target.value)}
                        placeholder="Tìm tên bài giảng, trường, chủ đề..."
                        className="w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Khung xem trực tiếp Video Clip / Bộ tranh ảnh ngay trong trang */}
                {previewMedia && (
                  <div className="mt-3 rounded-2xl border-2 border-[#1D4ED8] bg-slate-900 p-4 text-white">
                    <div className="flex items-start justify-between gap-3 pb-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-blue-300">
                          {MEDIA_KIND_LABELS[previewMedia.kind]} · {previewMedia.subjectCode} · {previewMedia.author}
                        </div>
                        <div className="mt-0.5 text-sm font-bold">{previewMedia.title}</div>
                      </div>
                      <button
                        onClick={() => setPreviewMedia(null)}
                        className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {previewMedia.url.match(/\.(mp4|webm)(\?|$|#)/i) ? (
                      <video
                        controls
                        autoPlay
                        src={previewMedia.url}
                        className="max-h-[380px] w-full rounded-xl bg-black"
                      />
                    ) : toYoutubeEmbed(previewMedia.url) ? (
                      <iframe
                        src={toYoutubeEmbed(previewMedia.url) || ''}
                        title={previewMedia.title}
                        allowFullScreen
                        className="h-[380px] w-full rounded-xl bg-black"
                      />
                    ) : (
                      <div className="grid max-h-[400px] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
                        {(previewMedia.galleryUrls?.length
                          ? previewMedia.galleryUrls
                          : previewMedia.thumbnailUrl
                          ? [previewMedia.thumbnailUrl]
                          : [previewMedia.url]
                        ).map((imgUrl, idx) => (
                          <a
                            key={idx}
                            href={imgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-xl bg-slate-800"
                          >
                            <img
                              src={imgUrl}
                              alt={`${previewMedia.title} - ${idx + 1}`}
                              loading="lazy"
                              className="h-48 w-full object-cover transition hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3.5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {mediaList.map((m) => {
                    const canPreviewInline =
                      Boolean(m.url.match(/\.(mp4|webm)(\?|$|#)/i)) ||
                      Boolean(toYoutubeEmbed(m.url)) ||
                      m.kind === 'IMAGE' ||
                      Boolean(m.galleryUrls?.length);
                    const ageShort =
                      m.ageGroupId === 'ALL'
                        ? 'Mọi độ tuổi'
                        : dataset.ageGroups.find((g) => g.id === m.ageGroupId)?.short || m.ageGroupId;

                    return (
                      <div
                        key={m.id}
                        className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:border-slate-300"
                      >
                        <div>
                          {m.thumbnailUrl && (
                            <div
                              onClick={() => {
                                if (canPreviewInline) setPreviewMedia(m);
                              }}
                              className={`relative h-36 w-full overflow-hidden bg-slate-100 ${
                                canPreviewInline ? 'cursor-pointer' : ''
                              }`}
                            >
                              <img
                                src={m.thumbnailUrl}
                                alt={m.title}
                                loading="lazy"
                                onError={(e) => {
                                  const wrap = e.currentTarget.parentElement;
                                  if (wrap) wrap.style.display = 'none';
                                }}
                                className="h-full w-full object-cover"
                              />
                              {m.fileExt && (
                                <span className="absolute top-2 right-2 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                  {m.fileExt}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="p-3.5 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${MEDIA_KIND_BADGE[m.kind]}`}>
                                {MEDIA_KIND_LABELS[m.kind]}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {m.subjectCode}
                              </span>
                              <span className="text-[10px] text-slate-400">{ageShort}</span>
                            </div>

                            <div className="mt-1.5 line-clamp-2 font-bold leading-snug text-slate-900">
                              {m.title}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-slate-500">
                              {m.author}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {canPreviewInline && (
                              <button
                                type="button"
                                onClick={() => setPreviewMedia(m)}
                                className="rounded-lg bg-[#1D4ED8] px-2.5 py-1 font-bold text-white hover:bg-[#1E40AF]"
                              >
                                {m.kind === 'IMAGE'
                                  ? `Xem ảnh${m.galleryUrls?.length ? ` (${m.galleryUrls.length})` : ''}`
                                  : 'Xem clip'}
                              </button>
                            )}
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                            >
                              {m.kind === 'SLIDE'
                                ? 'Tải PPT'
                                : m.kind === 'DOC'
                                ? 'Mở tài liệu'
                                : 'Mở file'}
                            </a>
                            {m.sourceUrl && m.sourceUrl !== m.url && (
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1 font-semibold text-slate-400 hover:text-[#1D4ED8] hover:underline"
                              >
                                Bài gốc ↗
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const subj = m.subjectCode === 'ALL' ? 'MTXQ' : m.subjectCode;
                                const ag = m.ageGroupId === 'ALL' ? selectedAgeGroup : m.ageGroupId;
                                onInsertCrawledLesson({ subject: subj, topic: m.title }, '', ag);
                                onClose();
                              }}
                              className="rounded-lg bg-blue-50 px-2 py-1 font-bold text-[#1D4ED8] ring-1 ring-blue-200 hover:bg-[#1D4ED8] hover:text-white"
                            >
                              + Xếp tiết
                            </button>
                            {(m.id.startsWith('med_17') || m.id.startsWith('med_user_')) && (
                              <button
                                onClick={() => handleDeleteMedia(m.id)}
                                className="rounded p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
