import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type {
  ObjectiveItem,
  ObjectivesDataset,
  SavedLessonTemplate,
  WeeklyPlanDocument,
} from '../../shared/types';
import type { SmartInsertOptions } from '../utils/editorInsert';
import { normVN } from '../utils/helpers';
import { buildLessonSnippetHtml, buildMtLineHtml, buildShortLessonLineHtml } from '../utils/planToHtml';
import { resolveSubjectMeta, SUBJECT_QUICK_SNIPPETS } from '../utils/subjectTemplates';
import { getDomainVisual, getSubjectVisual, objectiveMatchesSubject } from '../utils/visualMeta';
import { buildWorkSnippetHtml, filterWorksForAssistant } from '../utils/worksLookup';

interface CrawledLessonRow {
  id: string;
  subject: string;
  topic: string;
  mtCode: string;
  schoolName: string;
  detectedMonth: string;
  postTitle: string;
  postUrl: string;
  snippet: string;
}

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  subjectCode: string;
  linkedMtCodes: string[];
  templatesRevision?: number;
  onApplyTemplate?: (tpl: SavedLessonTemplate) => void;
  onInsertHtml: (html: string, label: string, opts?: SmartInsertOptions) => void;
  onToggleLessonMt: (mtCode: string) => void;
  onOpenFullLibrary: (tab: 'bank' | 'crawled') => void;
  onClose: () => void;
}

export const FocusedAssistant: React.FC<Props> = ({
  plan,
  dataset,
  subjectCode,
  linkedMtCodes,
  templatesRevision = 1,
  onApplyTemplate,
  onInsertHtml,
  onToggleLessonMt,
  onOpenFullLibrary,
  onClose,
}) => {
  const [lockSubject, setLockSubject] = useState(true);
  const [tab, setTab] = useState<'blocks' | 'works' | 'lessons' | 'mt'>('blocks');
  const [search, setSearch] = useState('');
  const [lessons, setLessons] = useState<CrawledLessonRow[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedLessonTemplate[]>([]);
  const [kbByMt, setKbByMt] = useState<
    Record<
      string,
      {
        docCount: number;
        lessonCount: number;
        distilled?: {
          mainLessons: Array<{ subject: string; topic: string; schoolCount?: number; school: string }>;
        };
      }
    >
  >({});
  const [loading, setLoading] = useState(false);
  const [openSnips, setOpenSnips] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/kb/suggestions?ageGroupId=${plan.ageGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setKbByMt(d.byMt);
        else setKbByMt({});
      })
      .catch(() => setKbByMt({}));
  }, [plan.ageGroupId]);

  const subjectMeta = useMemo(() => resolveSubjectMeta(subjectCode), [subjectCode]);
  const quickBlocks = useMemo(
    () => SUBJECT_QUICK_SNIPPETS[subjectMeta.code] || SUBJECT_QUICK_SNIPPETS.MTXQ,
    [subjectMeta.code]
  );

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  const objByCode = useMemo(
    () => new Map(ageObjectives.map((o) => [o.code, o])),
    [ageObjectives]
  );

  useEffect(() => {
    const params = new URLSearchParams({ ageGroupId: plan.ageGroupId });
    if (lockSubject) params.set('subjectCode', subjectMeta.code);
    fetch(`/api/templates?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setSavedTemplates(d.templates || []))
      .catch(() => setSavedTemplates([]));
  }, [plan.ageGroupId, subjectMeta.code, lockSubject, templatesRevision]);

  const handleDeleteSavedTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ ageGroupId: plan.ageGroupId, slotType: 'MAIN', limit: '30' });
    if (lockSubject) params.set('subject', subjectMeta.code);
    if (search.trim()) params.set('q', search.trim());
    fetch(`/api/kb/lessons?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setLessons(d.items || []))
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [plan.ageGroupId, subjectMeta.code, lockSubject, search]);

  const filteredObjectives = useMemo(() => {
    const q = normVN(search);
    return ageObjectives.filter((o) => {
      if (lockSubject && !objectiveMatchesSubject(o, subjectMeta.code)) return false;
      if (q) {
        const hay = normVN(`${o.code} ${o.description} ${o.theme} ${o.eduContent}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ageObjectives, lockSubject, subjectMeta.code, search]);

  const matchingWorks = useMemo(
    () => filterWorksForAssistant(lockSubject ? subjectMeta.code : 'ALL', plan.ageGroupId, search),
    [lockSubject, subjectMeta.code, plan.ageGroupId, search]
  );

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-slate-50/90">
      {/* Clean Subject-Locked Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-900">
              Gợi ý cho môn {subjectMeta.shortLabel}
            </div>
            <button
              onClick={() => setLockSubject((v) => !v)}
              className="mt-0.5 text-[11px] font-medium text-[#0B6E5C] hover:underline"
            >
              {lockSubject ? 'Đang lọc riêng môn này · Xem tất cả môn' : 'Đang xem tất cả · Lọc lại theo môn này'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Clean 4 Tabs (including Literary/Song/LQCC Corpus) */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
          <button
            onClick={() => setTab('blocks')}
            className={`rounded-lg py-1.5 transition ${
              tab === 'blocks' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mẫu nhanh
          </button>
          <button
            onClick={() => setTab('works')}
            className={`rounded-lg py-1.5 transition ${
              tab === 'works' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ngữ liệu ({matchingWorks.length})
          </button>
          <button
            onClick={() => setTab('lessons')}
            className={`rounded-lg py-1.5 transition ${
              tab === 'lessons' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thực tế ({lessons.length})
          </button>
          <button
            onClick={() => setTab('mt')}
            className={`rounded-lg py-1.5 transition ${
              tab === 'mt' ? 'bg-white text-[#0B6E5C] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MT ({filteredObjectives.length})
          </button>
        </div>

        {tab !== 'blocks' && (
          <div className="mt-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Tìm trong ${subjectMeta.shortLabel}...`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {tab === 'blocks' && (
          <>
            {savedTemplates.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <div className="text-[11px] font-bold text-amber-950">
                  Bài giảng mẫu của tôi ({savedTemplates.length})
                </div>
                {savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-lg border border-amber-200/80 bg-white p-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900">{tpl.topicTitle}</div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedTemplate(tpl.id)}
                        title="Xóa bài mẫu này"
                        className="text-slate-300 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {tpl.subjectCode}
                      {tpl.linkedMtCodes?.[0] ? ` · ${tpl.linkedMtCodes[0]}` : ''} · {tpl.createdBy}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {onApplyTemplate && (
                        <button
                          type="button"
                          onClick={() => onApplyTemplate(tpl)}
                          className="flex-1 rounded-md bg-[#0B6E5C] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                        >
                          Áp dụng toàn bài mẫu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onInsertHtml(tpl.richHtml, `bài mẫu "${tpl.topicTitle.slice(0, 28)}"`, {
                            mode: 'block',
                          })
                        }
                        className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                      >
                        + Chèn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-emerald-200/80 bg-[#F2F9F7] p-3 text-[11px] text-[#074F42]">
              <div className="font-bold">Cấu trúc chuẩn môn {subjectMeta.shortLabel}:</div>
              <div className="mt-0.5 leading-relaxed">{subjectMeta.pedagogySummary}</div>
            </div>

            {quickBlocks.map((blk) => (
              <div
                key={blk.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition hover:border-[#0B6E5C]"
              >
                <div className="text-xs font-bold text-slate-900">{blk.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{blk.desc}</div>
                <div
                  className="mt-2 max-h-28 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[11px] text-slate-600 [&_ul]:ml-4 [&_ul]:list-disc"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  dangerouslySetInnerHTML={{ __html: blk.html }}
                />
                <button
                  onClick={() => onInsertHtml(blk.html, blk.label, { mode: 'block' })}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#0B6E5C] py-1.5 text-[11px] font-semibold text-white hover:bg-[#085A4B]"
                >
                  + Chèn vào vị trí con trỏ
                </button>
              </div>
            ))}

            {/* Quick peek of top 3 real lessons right under blocks so teacher doesn't even need to switch tabs */}
            {lessons.length > 0 && (
              <div className="pt-1">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>Bài dạy thực tế tiêu biểu ({subjectMeta.code}):</span>
                  <button
                    onClick={() => setTab('lessons')}
                    className="text-[#0B6E5C] hover:underline"
                  >
                    Xem tất cả →
                  </button>
                </div>
                <div className="space-y-2">
                  {lessons.slice(0, 3).map((les) => (
                    <div key={les.id} className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-2.5 text-xs">
                      <div className="font-semibold text-slate-900">{les.topic}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{les.schoolName}</div>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() =>
                            onInsertHtml(
                              buildShortLessonLineHtml(les.topic, les.subject, les.mtCode),
                              `ý tưởng "${les.topic.slice(0, 30)}"`,
                              { mode: 'line' }
                            )
                          }
                          className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-600 hover:text-white"
                        >
                          + Chèn ý này
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'works' && (
          <>
            {matchingWorks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                Môn này không dùng trực tiếp thơ/truyện/nhạc/chữ cái — cô bấm <strong>“Xem tất cả môn”</strong> phía trên để tra toàn bộ Kho Ngữ liệu nhé.
              </div>
            ) : (
              matchingWorks.map((w) => (
                <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="rounded bg-[#E6F4F1] px-2 py-0.5 text-[10px] font-bold text-[#0B6E5C]">
                      {w.kind === 'POEM'
                        ? 'Bài thơ'
                        : w.kind === 'STORY'
                        ? 'Truyện kể'
                        : w.kind === 'SONG'
                        ? 'Bài hát'
                        : '29 Chữ cái'}
                    </span>
                    <span className="text-[10px] text-slate-400">{w.author}</span>
                  </div>
                  <div className="mt-1.5 font-bold text-slate-900">{w.title}</div>
                  <div className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-[11px] italic leading-relaxed text-slate-700">
                    {w.contentText}
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-500">
                    Đính kèm sẵn <strong>{w.dialogueQuestions.length} câu hỏi đàm thoại</strong> sát nội dung
                  </div>
                  <button
                    onClick={() =>
                      onInsertHtml(
                        buildWorkSnippetHtml(w),
                        `ngữ liệu “${w.title}” & câu hỏi đàm thoại`,
                        { mode: 'block' }
                      )
                    }
                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#0B6E5C] py-1.5 text-[11px] font-semibold text-white hover:bg-[#085A4B]"
                  >
                    + Chèn toàn văn &amp; Câu hỏi đàm thoại
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'lessons' && (
          <>
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">Đang tải bài dạy thực tế...</div>
            ) : lessons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                Không có bài dạy thực tế khớp bộ lọc.
              </div>
            ) : (
              lessons.map((les) => {
                const isOpen = Boolean(openSnips[les.id]);
                const obj = les.mtCode ? objByCode.get(les.mtCode) : undefined;
                return (
                  <div key={les.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${getSubjectVisual(les.subject).chipClass}`}>
                          {les.subject}
                        </span>
                        {les.mtCode && (
                          <span className="rounded bg-[#E6F4F1] px-1.5 py-0.5 text-[10px] font-bold text-[#0B6E5C]">
                            {les.mtCode}
                          </span>
                        )}
                      </div>
                      {les.postUrl && (
                        <a
                          href={les.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold text-slate-400 hover:text-[#0B6E5C] hover:underline"
                        >
                          Nguồn ↗
                        </a>
                      )}
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-900">{les.topic}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {les.schoolName} • {les.detectedMonth}
                    </p>
                    {isOpen && les.snippet && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                        {les.snippet}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() =>
                          onInsertHtml(
                            buildShortLessonLineHtml(les.topic, les.subject, les.mtCode),
                            `dòng "${les.topic.slice(0, 30)}"`,
                            { mode: 'line' }
                          )
                        }
                        className="inline-flex items-center rounded-md bg-[#0B6E5C] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#085A4B]"
                      >
                        + Chèn dòng
                      </button>
                      <button
                        onClick={() =>
                          onInsertHtml(
                            buildLessonSnippetHtml(les.topic, les.subject, les.mtCode, obj),
                            `khung tiết "${les.topic.slice(0, 30)}"`,
                            { mode: 'block' }
                          )
                        }
                        className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B6E5C] ring-1 ring-slate-200 hover:bg-[#E6F4F1]"
                      >
                        Chèn khung tiết
                      </button>
                      {les.snippet && (
                        <button
                          onClick={() => setOpenSnips((p) => ({ ...p, [les.id]: !p[les.id] }))}
                          className="ml-auto text-[10px] font-semibold text-[#0B6E5C] hover:underline"
                        >
                          {isOpen ? 'Ẩn trích đoạn' : 'Xem trích đoạn'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'mt' && (
          <>
            {filteredObjectives.slice(0, 30).map((obj: ObjectiveItem) => {
              const dv = getDomainVisual(obj.domain);
              const attached = linkedMtCodes.includes(obj.code);
              const kb = kbByMt[obj.code];
              const distilledMains = kb?.distilled?.mainLessons || [];
              return (
                <div
                  key={obj.id}
                  className={`rounded-xl border border-slate-200 border-l-4 ${dv.borderClass} bg-white p-3 text-xs shadow-2xs`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dv.mtBadgeClass}`}>
                        {obj.code}
                      </span>
                      <span className="text-[10px] text-slate-400">{obj.month}</span>
                      {distilledMains.length > 0 && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-200">
                          {distilledMains.length} bài thực tế
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onToggleLessonMt(obj.code)}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                        attached
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600 hover:bg-[#0B6E5C] hover:text-white'
                      }`}
                    >
                      {attached ? 'Đã gắn tiết này' : '+ Gắn vào tiết'}
                    </button>
                  </div>
                  <p className="mt-1.5 font-semibold text-slate-900">{obj.description}</p>
                  {distilledMains.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-lg border border-amber-200/70 bg-amber-50/40 p-2">
                      <div className="text-[9px] font-bold uppercase text-amber-900">
                        Chiết lọc từ {kb?.docCount || 0} giáo án thực tế:
                      </div>
                      {distilledMains.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-slate-800">
                            <strong className="text-amber-900">[{item.subject}]</strong> {item.topic}
                          </span>
                          <button
                            onClick={() =>
                              onInsertHtml(
                                buildShortLessonLineHtml(item.topic, item.subject, obj.code),
                                `gợi ý "${item.topic.slice(0, 28)}"`,
                                { mode: 'line' }
                              )
                            }
                            className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-600 hover:text-white"
                          >
                            + Chèn
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => onInsertHtml(buildMtLineHtml(obj), obj.code, { mode: 'mt', preferredSection: 'aims' })}
                      className="rounded-md bg-[#E6F4F1] px-2 py-1 text-[10px] font-semibold text-[#0B6E5C] hover:bg-emerald-200"
                    >
                      + Chèn vào MĐYC
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-3.5 py-2.5">
        <button
          onClick={() => onOpenFullLibrary(tab === 'lessons' ? 'crawled' : 'bank')}
          className="w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#0B6E5C] hover:text-[#0B6E5C]"
        >
          Mở rộng toàn bộ kho tham khảo →
        </button>
      </div>
    </aside>
  );
};
