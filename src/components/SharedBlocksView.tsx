import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Dumbbell,
  HeartHandshake,
  Network,
  Plus,
  Puzzle,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from 'lucide-react';
import type { DomainKey, ObjectivesDataset, WeeklyPlanDocument } from '../../shared/types';
import { normalizePlainSuggestion } from '../utils/editorInsert';
import { domainToKey, normVN } from '../utils/helpers';
import { MORNING_EXERCISE_PRESETS, OUTDOOR_GAME_PRESETS } from '../utils/subjectTemplates';
import { CORNER_FALLBACK_IDEAS, DAILY_ROUTINES_BANK, type DailyRoutineSlot } from '../utils/dailyRoutinesBank';
import { DOMAIN_VISUALS, FIVE_CORNERS } from '../utils/visualMeta';
import { StepHintBanner } from './StepHintBanner';

interface Props {
  plan: WeeklyPlanDocument;
  dataset: ObjectivesDataset;
  onUpdatePlan: (next: WeeklyPlanDocument, toastMsg?: string) => void;
  onOpenGuide?: () => void;
  onGoToStep: (step: 'board' | 'shared' | 'focus' | 'preview') => void;
}

type BlockTab = 'mt' | 'tds' | 'corners' | 'outdoor' | 'routines' | 'network';

export const SharedBlocksView: React.FC<Props> = ({
  plan,
  dataset,
  onUpdatePlan,
  onOpenGuide,
  onGoToStep,
}) => {
  const [activeBlock, setActiveBlock] = useState<BlockTab>('mt');
  const [mtDomainFilter, setMtDomainFilter] = useState<DomainKey>('PTTC');
  const [mtSearch, setMtSearch] = useState('');
  const [kbByMt, setKbByMt] = useState<
    Record<
      string,
      {
        docCount: number;
        lessonCount: number;
        topLessons: Array<{ subject: string; topic: string; schoolCount?: number; school: string }>;
      }
    >
  >({});
  const [cornerFilter, setCornerFilter] = useState<string>('Góc phân vai');
  const [routineSlotId, setRoutineSlotId] = useState<string>('welcome');
  const [cornerCounts, setCornerCounts] = useState<Record<string, number>>({});
  const [cornerIdeas, setCornerIdeas] = useState<Array<{ topic: string; cornerSubType?: string; schoolName: string }>>([]);

  const isNhaTre = plan.ageGroupId === 'NHA_TRE_24_36T';
  const activeDomainVisuals = useMemo(
    () => (isNhaTre ? DOMAIN_VISUALS.filter((d) => d.key !== 'PTTM') : DOMAIN_VISUALS),
    [isNhaTre]
  );

  useEffect(() => {
    if (isNhaTre && mtDomainFilter === 'PTTM') setMtDomainFilter('PT_TCKNXH');
  }, [isNhaTre, mtDomainFilter]);

  useEffect(() => {
    fetch(`/api/kb/suggestions?ageGroupId=${plan.ageGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.available && d.byMt) setKbByMt(d.byMt);
        else setKbByMt({});
      })
      .catch(() => setKbByMt({}));
  }, [plan.ageGroupId]);

  const ageObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset, plan.ageGroupId]
  );

  const attachedMtSet = useMemo(() => {
    const s = new Set<string>();
    plan.themeObjectives.forEach((b) => b.mtCodes.forEach((c) => s.add(c)));
    return s;
  }, [plan.themeObjectives]);

  useEffect(() => {
    if (activeBlock !== 'corners') return;
    const params = new URLSearchParams({
      ageGroupId: plan.ageGroupId,
      slotType: 'CORNER',
      cornerSubType: cornerFilter,
      limit: '20',
    });
    fetch(`/api/kb/lessons?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        const crawled: Array<{ topic: string; cornerSubType?: string; schoolName: string }> = d.items || [];
        const fallbackPool =
          (isNhaTre ? CORNER_FALLBACK_IDEAS.NHA_TRE : CORNER_FALLBACK_IDEAS.MAU_GIAO)[cornerFilter] || [];
        const merged = [...crawled];
        for (const fb of fallbackPool) {
          if (!merged.some((x) => normVN(x.topic).slice(0, 35) === normVN(fb).slice(0, 35))) {
            merged.push({
              topic: fb,
              cornerSubType: cornerFilter,
              schoolName: isNhaTre ? 'Mẫu chuẩn BGD (Nhà trẻ 24–36T)' : 'Mẫu chuẩn BGD (Mẫu giáo)',
            });
          }
        }
        setCornerIdeas(merged);
        setCornerCounts(d.cornerCounts || {});
      })
      .catch(() => {
        const fallbackPool =
          (isNhaTre ? CORNER_FALLBACK_IDEAS.NHA_TRE : CORNER_FALLBACK_IDEAS.MAU_GIAO)[cornerFilter] || [];
        setCornerIdeas(
          fallbackPool.map((fb) => ({
            topic: fb,
            cornerSubType: cornerFilter,
            schoolName: isNhaTre ? 'Mẫu chuẩn BGD (Nhà trẻ 24–36T)' : 'Mẫu chuẩn BGD (Mẫu giáo)',
          }))
        );
      });
  }, [activeBlock, plan.ageGroupId, cornerFilter, isNhaTre]);

  const toggleMt = (domainKey: DomainKey, code: string) => {
    const exists = attachedMtSet.has(code);
    const nextBlocks = plan.themeObjectives.map((blk) => {
      if (blk.domainKey !== domainKey) return blk;
      return {
        ...blk,
        mtCodes: exists ? blk.mtCodes.filter((c) => c !== code) : [...blk.mtCodes, code],
      };
    });
    onUpdatePlan(
      { ...plan, themeObjectives: nextBlocks },
      exists ? `Đã bỏ ${code} khỏi mục tiêu.` : `Đã gắn ${code} vào mục tiêu (tự đồng bộ sang Word A4)!`
    );
  };

  const filteredMts = useMemo(() => {
    const q = normVN(mtSearch);
    return ageObjectives.filter((o) => {
      const dk = isNhaTre && domainToKey(o.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(o.domain);
      if (dk !== mtDomainFilter) return false;
      if (q) {
        const hay = normVN(`${o.code} ${o.description} ${o.theme} ${o.month} ${o.eduContent}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ageObjectives, mtDomainFilter, mtSearch, isNhaTre]);

  const TABS: Array<{ id: BlockTab; label: string; icon: React.ReactNode; badge: string }> = [
    { id: 'mt', label: 'Mục tiêu & Mã MT', icon: <Target className="h-4 w-4" />, badge: `${attachedMtSet.size} MT` },
    { id: 'tds', label: 'Thể dục sáng', icon: <Dumbbell className="h-4 w-4" />, badge: `${plan.morningExercise.moves.length} ĐT` },
    { id: 'corners', label: 'Bảng 5 Góc chơi', icon: <Puzzle className="h-4 w-4" />, badge: `${plan.cornerTable.length} góc` },
    { id: 'outdoor', label: 'HĐ Ngoài trời', icon: <Sun className="h-4 w-4" />, badge: `${plan.outdoorTable.length} mục` },
    { id: 'routines', label: 'Lễ giáo & Nêu gương', icon: <HeartHandshake className="h-4 w-4" />, badge: '3 TCBN' },
    { id: 'network', label: 'Mạng Chủ đề (T1)', icon: <Network className="h-4 w-4" />, badge: plan.includeThemeSection ? 'Bật' : 'Ẩn' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F6F8F7] px-5 py-4 lg:px-7 lg:py-5">
      <div className="mx-auto max-w-[1320px] space-y-4">
        <StepHintBanner
          storageKey="step2_shared"
          text="Bước 2: Chọn nhanh các Hoạt động cả tuần (Mục tiêu tuần, Thể dục sáng, 5 Góc chơi, Ngoài trời, Nề nếp 7h–17h) — chỉ cần chọn 1 lần, hệ thống tự ghép cho cả 5 ngày."
          onOpenGuide={onOpenGuide}
        />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Hoạt động cả tuần (Thứ 2 → Thứ 6)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Chọn từng mục bên dưới để tick chọn nhanh từ kho mẫu chuẩn Mầm non.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onGoToStep('board')}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Lịch tuần
            </button>
            <button
              onClick={() => onGoToStep('focus')}
              className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#085A4B]"
            >
              Tiếp: Soạn Word →
            </button>
          </div>
        </div>

        {/* Clean 6 Sub-Tabs (less icon clutter) */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = activeBlock === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveBlock(t.id)}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {t.label} <span className={`ml-1 ${active ? 'text-emerald-100' : 'text-slate-400'}`}>({t.badge})</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: 1-CLICK 5-DOMAIN MT CHECKLIST                         */}
        {/* ============================================================ */}
        {activeBlock === 'mt' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Attached MTs summary across 5 domains */}
            <div className="space-y-3 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-xs font-bold uppercase text-[#0B6E5C]">
                  Mục tiêu đã gắn vào Tuần {plan.weekNumber} ({attachedMtSet.size} mã MT)
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Bấm vào từng lĩnh vực để lọc danh sách tick chọn nhanh bên phải.
                </p>
                <div className="mt-3 space-y-2.5">
                  {activeDomainVisuals.map((dv) => {
                    const blk = plan.themeObjectives.find((b) => b.domainKey === dv.key);
                    const codes = blk?.mtCodes || [];
                    const active = mtDomainFilter === dv.key;
                    const domLabel =
                      isNhaTre && dv.key === 'PT_TCKNXH'
                        ? 'Tình cảm, KNXH & Thẩm mỹ (Nhà trẻ)'
                        : dv.label;
                    return (
                      <div
                        key={dv.key}
                        onClick={() => setMtDomainFilter(dv.key)}
                        className={`cursor-pointer rounded-xl border border-l-4 ${dv.borderClass} p-3 transition ${
                          active ? 'border-[#0B6E5C] bg-[#F2F9F7]' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{domLabel}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${dv.badgeClass}`}>
                            {codes.length} mã MT
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {codes.length === 0 ? (
                            <span className="text-[11px] italic text-slate-400">
                              Chưa gắn mã MT — tick chọn ở bảng bên phải
                            </span>
                          ) : (
                            codes.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[#0B6E5C] ring-1 ring-emerald-200"
                              >
                                {c}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMt(dv.key, c);
                                  }}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: 1-Click MT Tick List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900">
                  Tick chọn nhanh Mục tiêu — {DOMAIN_VISUALS.find((d) => d.key === mtDomainFilter)?.label}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={mtSearch}
                    onChange={(e) => setMtSearch(e.target.value)}
                    placeholder="Tìm mã MT, từ khóa..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 max-h-[540px] space-y-2 overflow-y-auto pr-1">
                {filteredMts.map((obj) => {
                  const checked = attachedMtSet.has(obj.code);
                  const kb = kbByMt[obj.code];
                  return (
                    <div
                      key={obj.id}
                      onClick={() => toggleMt(mtDomainFilter, obj.code)}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        checked
                          ? 'border-[#0B6E5C] bg-[#E6F4F1]/60'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          checked
                            ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-[#0B6E5C] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {obj.code}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {obj.month} • {obj.theme}
                          </span>
                          {kb && kb.lessonCount > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                              {kb.lessonCount} gợi ý chiết lọc ({kb.docCount} TL)
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-900">{obj.description}</p>
                        {obj.eduContent && (
                          <p className="mt-0.5 text-[11px] text-slate-500">{obj.eduContent}</p>
                        )}
                        {kb && kb.topLessons?.length > 0 && (
                          <div className="mt-1.5 space-y-1 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-950">
                            {kb.topLessons.slice(0, 2).map((l, i) => (
                              <div key={i}>
                                <span className="font-bold">[{l.subject}]</span> {l.topic}{' '}
                                <span className="text-[10px] text-amber-700">
                                  ({(l.schoolCount || 1) > 1 ? `${l.schoolCount} trường` : l.school})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: THỂ DỤC SÁNG (5 ĐỘNG TÁC + KHO MẪU 1 CHẠM)            */}
        {/* ============================================================ */}
        {activeBlock === 'tds' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-xs">
                <span className="font-bold text-slate-700">1. Khởi động</span>
                <textarea
                  rows={2}
                  value={plan.morningExercise.warmup}
                  onChange={(e) =>
                    onUpdatePlan({
                      ...plan,
                      morningExercise: { ...plan.morningExercise, warmup: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-[#0B6E5C] focus:outline-none"
                />
              </label>
              <label className="block text-xs">
                <span className="font-bold text-slate-700">3. Hồi tỉnh</span>
                <textarea
                  rows={2}
                  value={plan.morningExercise.cooldown}
                  onChange={(e) =>
                    onUpdatePlan({
                      ...plan,
                      morningExercise: { ...plan.morningExercise, cooldown: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-[#0B6E5C] focus:outline-none"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold text-slate-800">
                2. Trọng động — 5 nhóm động tác (bấm chip gợi ý để thay nhanh 1 chạm):
              </div>
              <div className="space-y-3">
                {plan.morningExercise.moves.map((mv, idx) => {
                  const basePresets = MORNING_EXERCISE_PRESETS[mv.group] || [];
                  const presets = isNhaTre
                    ? basePresets.slice(0, 2).map((pr) => ({
                        ...pr,
                        name: pr.name.replace(/×\s*8\s*nhịp/gi, '× 4 nhịp').replace(/4\s*lần/gi, '2 lần'),
                      }))
                    : basePresets;
                  return (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-md bg-[#0B6E5C] px-2 py-0.5 text-[11px] font-bold text-white">
                          {idx + 1}. Nhóm {mv.group}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {presets.map((pr, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => {
                                const nextMoves = plan.morningExercise.moves.map((m, i) =>
                                  i === idx ? pr : m
                                );
                                onUpdatePlan(
                                  {
                                    ...plan,
                                    morningExercise: { ...plan.morningExercise, moves: nextMoves },
                                  },
                                  `Đã chọn động tác "${pr.name}"!`
                                );
                              }}
                              className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#0B6E5C] hover:bg-[#E6F4F1]"
                            >
                              + {pr.name.split('(')[0].trim()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <input
                          value={mv.name}
                          onChange={(e) => {
                            const nextMoves = plan.morningExercise.moves.map((m, i) =>
                              i === idx ? { ...m, name: e.target.value } : m
                            );
                            onUpdatePlan({
                              ...plan,
                              morningExercise: { ...plan.morningExercise, moves: nextMoves },
                            });
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                        />
                        <input
                          value={mv.steps}
                          onChange={(e) => {
                            const nextMoves = plan.morningExercise.moves.map((m, i) =>
                              i === idx ? { ...m, steps: e.target.value } : m
                            );
                            onUpdatePlan({
                              ...plan,
                              morningExercise: { ...plan.morningExercise, moves: nextMoves },
                            });
                          }}
                          placeholder="Mô tả kỹ thuật nhịp..."
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: BẢNG 5 GÓC CHƠI + GỢI Ý TỪ 1.050 GIÁO ÁN             */}
        {/* ============================================================ */}
        {activeBlock === 'corners' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              {plan.cornerTable.map((c, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-900">
                      {idx + 1}. {c.cornerName}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Nội dung chơi (mỗi dòng 1 ý)</span>
                      <textarea
                        rows={2}
                        value={c.contents.join('\n')}
                        onChange={(e) => {
                          const next = plan.cornerTable.map((row, i) =>
                            i === idx ? { ...row, contents: e.target.value.split('\n') } : row
                          );
                          onUpdatePlan({ ...plan, cornerTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Chuẩn bị đồ dùng</span>
                      <textarea
                        rows={2}
                        value={c.preparation.join('\n')}
                        onChange={(e) => {
                          const next = plan.cornerTable.map((row, i) =>
                            i === idx ? { ...row, preparation: e.target.value.split('\n') } : row
                          );
                          onUpdatePlan({ ...plan, cornerTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Yêu cầu kỹ năng</span>
                      <textarea
                        rows={2}
                        value={c.requirements.join('\n')}
                        onChange={(e) => {
                          const next = plan.cornerTable.map((row, i) =>
                            i === idx ? { ...row, requirements: e.target.value.split('\n') } : row
                          );
                          onUpdatePlan({ ...plan, cornerTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Tổ chức hoạt động</span>
                      <textarea
                        rows={2}
                        value={c.organization.join('\n')}
                        onChange={(e) => {
                          const next = plan.cornerTable.map((row, i) =>
                            i === idx ? { ...row, organization: e.target.value.split('\n') } : row
                          );
                          onUpdatePlan({ ...plan, cornerTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Live Corner Ideas grouped cleanly by each of the 5 corners */}
            <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-2xs lg:col-span-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B6E5C]">
                <Sparkles className="h-3.5 w-3.5" /> Ý tưởng chia riêng theo từng Góc chơi
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Chọn góc muốn tham khảo → bấm để thêm thẳng vào đúng góc bên trái.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {FIVE_CORNERS.map((cn) => {
                  const active = cornerFilter === cn;
                  const cnt = cornerCounts[cn] || 0;
                  return (
                    <button
                      key={cn}
                      onClick={() => setCornerFilter(cn)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                        active
                          ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                          : 'border-teal-200 bg-teal-50/70 text-teal-900 hover:bg-teal-100'
                      }`}
                    >
                      {cn.replace('Góc ', '')} {cnt > 0 ? `(${cnt})` : ''}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {cornerIdeas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Chưa có ý tưởng riêng cho {cornerFilter} ở khối tuổi này.
                  </div>
                ) : (
                  cornerIdeas.map((idea, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs">
                      <p className="font-medium text-slate-800">{idea.topic}</p>
                      <div className="mt-1 text-[10px] text-slate-400">{idea.schoolName}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {plan.cornerTable.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => {
                              const clean = normalizePlainSuggestion(idea.topic);
                              if (!clean) return;
                              const next = plan.cornerTable.map((row, rIdx) => {
                                if (rIdx !== cIdx) return row;
                                const list = row.contents.map(normalizePlainSuggestion).filter(Boolean);
                                if (list.some((x) => x.toLowerCase() === clean.toLowerCase())) return row;
                                return { ...row, contents: [...list, clean] };
                              });
                              onUpdatePlan({ ...plan, cornerTable: next }, `Đã thêm vào ${c.cornerName}!`);
                            }}
                            className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0B6E5C] ring-1 ring-slate-200 hover:bg-[#0B6E5C] hover:text-white"
                          >
                            + {c.cornerName.replace('Góc ', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: HOẠT ĐỘNG NGOÀI TRỜI + KHO TRÒ CHƠI 1 CHẠM            */}
        {/* ============================================================ */}
        {activeBlock === 'outdoor' && (
          <div className="space-y-3">
            {plan.outdoorTable.map((row, idx) => {
              const presetList =
                row.category === 'TCVD'
                  ? OUTDOOR_GAME_PRESETS.TCVD
                  : row.category === 'TCDG'
                  ? OUTDOOR_GAME_PRESETS.TCDG
                  : [];
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      value={row.title}
                      onChange={(e) => {
                        const next = plan.outdoorTable.map((r, i) =>
                          i === idx ? { ...r, title: e.target.value } : r
                        );
                        onUpdatePlan({ ...plan, outdoorTable: next });
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900"
                    />
                    {presetList.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {presetList.map((g) => (
                          <button
                            key={g}
                            onClick={() => {
                              const next = plan.outdoorTable.map((r, i) =>
                                i === idx ? { ...r, title: g } : r
                              );
                              onUpdatePlan({ ...plan, outdoorTable: next }, `Đã chọn "${g}"!`);
                            }}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Yêu cầu</span>
                      <textarea
                        rows={2}
                        value={row.requirements.join('\n')}
                        onChange={(e) => {
                          const next = plan.outdoorTable.map((r, i) =>
                            i === idx ? { ...r, requirements: e.target.value.split('\n') } : r
                          );
                          onUpdatePlan({ ...plan, outdoorTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Chuẩn bị</span>
                      <textarea
                        rows={2}
                        value={row.preparation.join('\n')}
                        onChange={(e) => {
                          const next = plan.outdoorTable.map((r, i) =>
                            i === idx ? { ...r, preparation: e.target.value.split('\n') } : r
                          );
                          onUpdatePlan({ ...plan, outdoorTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px]">
                      <span className="font-bold text-slate-600">Cách tiến hành</span>
                      <textarea
                        rows={2}
                        value={row.procedure.join('\n')}
                        onChange={(e) => {
                          const next = plan.outdoorTable.map((r, i) =>
                            i === idx ? { ...r, procedure: e.target.value.split('\n') } : r
                          );
                          onUpdatePlan({ ...plan, outdoorTable: next });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: LỄ GIÁO – ĐÓN TRẺ – NÊU GƯƠNG + KHO HĐ HẰNG NGÀY      */}
        {/* ============================================================ */}
        {activeBlock === 'routines' && (() => {
          const activeSlot: DailyRoutineSlot =
            DAILY_ROUTINES_BANK.find((s) => s.id === routineSlotId) || DAILY_ROUTINES_BANK[0];

          const appendCleanUnique = (arr: string[], raw: string): string[] => {
            const clean = normalizePlainSuggestion(raw);
            const list = arr.map(normalizePlainSuggestion).filter(Boolean);
            if (!clean || list.some((x) => x.toLowerCase() === clean.toLowerCase())) return list;
            return [...list, clean];
          };

          const appendDailyIdea = (slot: DailyRoutineSlot, text: string) => {
            if (slot.targetField === 'welcome') {
              onUpdatePlan(
                { ...plan, welcomeRoutineNotes: appendCleanUnique(plan.welcomeRoutineNotes, text) },
                'Đã thêm vào Đón trẻ buổi sáng'
              );
            } else if (slot.targetField === 'hygiene') {
              onUpdatePlan(
                { ...plan, laborHygieneNotes: appendCleanUnique(plan.laborHygieneNotes, text) },
                'Đã thêm vào Lao động vệ sinh – Tự phục vụ'
              );
            } else if (slot.targetField === 'praise') {
              onUpdatePlan(
                { ...plan, praiseStandards: appendCleanUnique(plan.praiseStandards, text) },
                'Đã thêm vào Nêu gương – Trả trẻ'
              );
            } else if (slot.targetField === 'tds') {
              onUpdatePlan(
                {
                  ...plan,
                  morningExercise: {
                    ...plan.morningExercise,
                    aims: appendCleanUnique(plan.morningExercise.aims, text),
                  },
                },
                'Đã thêm vào Thể dục sáng'
              );
            } else {
              onUpdatePlan(
                { ...plan, etiquetteNotes: appendCleanUnique(plan.etiquetteNotes, text) },
                'Đã thêm vào Lễ giáo & Sinh hoạt tuần'
              );
            }
          };

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <label className="block text-xs">
                    <span className="font-bold text-slate-800">1. Lễ giáo xuyên suốt tuần (mỗi dòng 1 ý)</span>
                    <textarea
                      rows={3}
                      value={plan.etiquetteNotes.join('\n')}
                      onChange={(e) => onUpdatePlan({ ...plan, etiquetteNotes: e.target.value.split('\n') })}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-bold text-slate-800">2. Lao động vệ sinh – Tự phục vụ</span>
                    <textarea
                      rows={3}
                      value={plan.laborHygieneNotes.join('\n')}
                      onChange={(e) => onUpdatePlan({ ...plan, laborHygieneNotes: e.target.value.split('\n') })}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-bold text-slate-800">3. Đón trẻ buổi sáng</span>
                    <textarea
                      rows={3}
                      value={plan.welcomeRoutineNotes.join('\n')}
                      onChange={(e) => onUpdatePlan({ ...plan, welcomeRoutineNotes: e.target.value.split('\n') })}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <label className="block text-xs">
                    <span className="font-bold text-slate-800">4. Ba Tiêu chuẩn Bé ngoan (TCBN)</span>
                    <textarea
                      rows={4}
                      value={plan.praiseStandards.join('\n')}
                      onChange={(e) => onUpdatePlan({ ...plan, praiseStandards: e.target.value.split('\n') })}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs">
                      <span className="font-bold text-slate-700">Bài hát nêu gương hàng ngày</span>
                      <input
                        value={plan.praiseSongStart}
                        onChange={(e) => onUpdatePlan({ ...plan, praiseSongStart: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-bold text-slate-700">Bài hát nêu gương cuối tuần</span>
                      <input
                        value={plan.praiseSongWeekEnd}
                        onChange={(e) => onUpdatePlan({ ...plan, praiseSongWeekEnd: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                      />
                    </label>
                  </div>
                  <div className="rounded-xl bg-[#F2F9F7] p-3 text-xs text-[#074F42]">
                    Nội dung ở đây tự động xuất hiện ở cả <strong>Bảng Tổng hợp Tuần</strong>, <strong>5 Ngày chi tiết</strong> và <strong>Tờ Lịch Tuần gửi Phụ huynh</strong>.
                  </div>
                </div>
              </div>

              {/* Kho tham khảo Hoạt động hằng ngày phổ biến (7h00 – 17h00) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Tham khảo Hoạt động hằng ngày phổ biến (7h00 – 17h00)
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Chọn khung giờ sinh hoạt bên dưới để xem mẫu phổ biến và bấm <strong>+ Thêm vào tuần</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {DAILY_ROUTINES_BANK.map((slot) => {
                    const active = slot.id === activeSlot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setRoutineSlotId(slot.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'bg-[#0B6E5C] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {slot.title.replace(/^\d+\.\s*/, '')} ({slot.timeRange})
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                  <strong>Lưu ý độ tuổi:</strong> {activeSlot.ageNote}
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {activeSlot.activities.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3.5"
                    >
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{item.title}</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => appendDailyIdea(activeSlot, `${item.title}: ${item.detail}`)}
                          className="rounded-lg bg-[#E6F4F1] px-3 py-1 text-xs font-semibold text-[#0B6E5C] hover:bg-[#0B6E5C] hover:text-white"
                        >
                          + Thêm vào tuần
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* TAB 6: MẠNG CHỦ ĐỀ (TUẦN 1)                                  */}
        {/* ============================================================ */}
        {activeBlock === 'network' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={plan.includeThemeSection}
                  onChange={(e) => onUpdatePlan({ ...plan, includeThemeSection: e.target.checked })}
                  className="h-4 w-4 accent-[#0B6E5C]"
                />
                Hiển thị Phần Kế hoạch Chủ đề (Mục tiêu Chủ đề, Mạng nội dung, Mạng hoạt động) trong file xuất Word
              </label>
              <button
                onClick={() =>
                  onUpdatePlan({
                    ...plan,
                    contentNetwork: [
                      ...plan.contentNetwork,
                      {
                        id: `br_${Date.now()}`,
                        branchTitle: `Tuần ${plan.contentNetwork.length + 1}: Nhánh mới`,
                        items: ['Nội dung trọng tâm...'],
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#E6F4F1] px-3 py-1.5 text-xs font-semibold text-[#0B6E5C] hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm nhánh tuần
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {plan.contentNetwork.map((br, idx) => (
                <div key={br.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={br.branchTitle}
                      onChange={(e) => {
                        const next = plan.contentNetwork.map((b, i) =>
                          i === idx ? { ...b, branchTitle: e.target.value } : b
                        );
                        onUpdatePlan({ ...plan, contentNetwork: next });
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-[#0B6E5C]"
                    />
                    {plan.contentNetwork.length > 1 && (
                      <button
                        onClick={() =>
                          onUpdatePlan({
                            ...plan,
                            contentNetwork: plan.contentNetwork.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={br.items.join('\n')}
                    onChange={(e) => {
                      const next = plan.contentNetwork.map((b, i) =>
                        i === idx ? { ...b, items: e.target.value.split('\n') } : b
                      );
                      onUpdatePlan({ ...plan, contentNetwork: next });
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
