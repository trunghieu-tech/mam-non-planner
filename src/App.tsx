import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  AgeGroupId,
  AnnualPlanDocument,
  ObjectiveItem,
  ObjectivesDataset,
  SuggestedActivity,
  ThemeAssessmentDocument,
  WeeklyPlanDocument,
} from '../shared/types';
import { AnnualCurriculumView } from './components/AnnualCurriculumView';
import { WeeklyBoardView } from './components/WeeklyBoardView';
import { SharedBlocksView } from './components/SharedBlocksView';
import { FocusedWordStudio, type FocusTarget } from './components/FocusedWordStudio';
import { FullPreviewAuditView } from './components/FullPreviewAuditView';
import { AssessmentAndApprovalView } from './components/AssessmentAndApprovalView';
import { NewPlanModal } from './components/NewPlanModal';
import { ReferenceLibraryModal } from './components/ReferenceLibraryModal';
import { UserGuideModal } from './components/UserGuideModal';
import { addDaysISO, createBlankPlan, domainToKey, syncWeekDates } from './utils/helpers';
import { buildInitialWordHtml } from './utils/planToHtml';
import { buildPedagogicalLessonPlan } from './utils/subjectTemplates';
import { setWorksCorpusFromServer } from './utils/worksLookup';
import {
  copyPlanAcrossSchoolClasses,
  fetchTrashedWeeks,
  getHdsbeSchoolState,
  restoreWeekFromTrash,
  setActiveSchoolClassForGrade,
  subscribeHdsbeSchoolState,
  type HdsbeSchoolContextState,
  type HdsbeTrashedWeekItem,
} from './utils/hdsbeApiClient';

type WorkspaceStep = 'annual' | 'board' | 'shared' | 'focus' | 'preview' | 'closing';

export default function App() {
  const [dataset, setDataset] = useState<ObjectivesDataset | null>(null);
  const [plans, setPlans] = useState<WeeklyPlanDocument[]>([]);
  const [annualPlans, setAnnualPlans] = useState<Record<AgeGroupId, AnnualPlanDocument> | null>(null);
  const [assessments, setAssessments] = useState<ThemeAssessmentDocument[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>(
    () => sessionStorage.getItem('mn_active_plan_id') || ''
  );
  const [step, setStep] = useState<WorkspaceStep>(() => {
    const saved = sessionStorage.getItem('mn_active_step') as WorkspaceStep | null;
    return saved && ['annual', 'board', 'shared', 'focus', 'preview', 'closing'].includes(saved)
      ? saved
      : 'board';
  });
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [structuredRevision, setStructuredRevision] = useState<number>(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [undoSnapshot, setUndoSnapshot] = useState<WeeklyPlanDocument | null>(null);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [libraryModalTab, setLibraryModalTab] = useState<'bank' | 'crawled' | 'works' | 'media' | null>(null);
  const [libraryAgeGroup, setLibraryAgeGroup] = useState<AgeGroupId>('LA_5_6T');
  const [toast, setToast] = useState<{ msg: string; canUndo?: boolean } | null>(null);
  const [schoolCtx, setSchoolCtx] = useState<HdsbeSchoolContextState>(() => getHdsbeSchoolState());
  const [showCopyClassModal, setShowCopyClassModal] = useState(false);
  const [copyMode, setCopyMode] = useState<'WEEK' | 'ANNUAL'>('WEEK');
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyingBusy, setCopyingBusy] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashClassFilter, setTrashClassFilter] = useState<string>('ALL');
  const [trashedWeeks, setTrashedWeeks] = useState<HdsbeTrashedWeekItem[]>([]);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [crawledSummary, setCrawledSummary] = useState({
    available: false,
    totalDocs: 0,
    totalLessons: 0,
    totalSchools: 0,
    byAgeGroup: {} as Record<string, number>,
  });

  const notify = useCallback((msg: string, canUndo = false) => {
    setToast({ msg, canUndo });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => {
        setToast((cur) => (cur?.msg === msg ? null : cur));
      },
      canUndo ? 5500 : 3200
    );
  }, []);

  const fetchCrawledSummary = () => {
    fetch('/api/kb/summary')
      .then((r) => r.json())
      .then((d) => setCrawledSummary(d))
      .catch(() => {});
  };

  useEffect(() => {
    return subscribeHdsbeSchoolState((next) => setSchoolCtx(next));
  }, []);

  const reloadWorkspaceData = useCallback(async (preferredGrade?: AgeGroupId) => {
    const [objData, planData, annualData, assessData] = await Promise.all([
      fetch('/api/objectives').then((r) => r.json()),
      fetch('/api/plans').then((r) => r.json()),
      fetch('/api/annual-plans').then((r) => r.json()).catch(() => ({ annualPlans: null })),
      fetch('/api/assessments').then((r) => r.json()).catch(() => ({ assessments: [] })),
    ]);
    const ds = objData as ObjectivesDataset;
    setDataset(ds);
    const list = (planData.plans || []) as WeeklyPlanDocument[];
    setPlans(list);
    if (annualData?.annualPlans) {
      setAnnualPlans(annualData.annualPlans as Record<AgeGroupId, AnnualPlanDocument>);
    }
    if (Array.isArray(assessData?.assessments)) {
      setAssessments(assessData.assessments as ThemeAssessmentDocument[]);
    }
    if (preferredGrade) {
      const matchGrade = list.find((p) => p.ageGroupId === preferredGrade);
      setLibraryAgeGroup(preferredGrade);
      if (matchGrade) {
        setActivePlanId(matchGrade.id);
      } else {
        setStep('annual');
      }
    } else if (list.length > 0) {
      const storedId = sessionStorage.getItem('mn_active_plan_id');
      const picked = list.find((p) => p.id === storedId) || list[0];
      setActivePlanId(picked.id);
      setLibraryAgeGroup(picked.ageGroupId);
    }
  }, []);

  useEffect(() => {
    reloadWorkspaceData();
    fetchCrawledSummary();
    fetch('/api/kb/works')
      .then((r) => r.json())
      .then((d) => setWorksCorpusFromServer(d?.works))
      .catch(() => {});
  }, [reloadWorkspaceData]);

  useEffect(() => {
    sessionStorage.setItem('mn_active_step', step);
  }, [step]);

  useEffect(() => {
    if (activePlanId) sessionStorage.setItem('mn_active_plan_id', activePlanId);
  }, [activePlanId]);

  // Close plan menu when clicking outside
  useEffect(() => {
    if (!showPlanMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlanMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showPlanMenu]);

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0] || null;

  // Hợp nhất 345 MT gốc của Bộ GD&ĐT với các MT Phát triển mở rộng của lớp (YC-044) trên toàn bộ 6 bước
  const effectiveDataset = useMemo<ObjectivesDataset | null>(() => {
    if (!dataset) return null;
    if (!annualPlans) return dataset;
    const customList = Object.values(annualPlans).flatMap((ap) => ap?.customObjectives || []);
    if (customList.length === 0) return dataset;
    const byKey = new Map<string, ObjectiveItem>();
    dataset.objectives.forEach((o) => byKey.set(`${o.ageGroupId}:${o.code}`, o));
    customList.forEach((c) => byKey.set(`${c.ageGroupId}:${c.code}`, c));
    const merged = Array.from(byKey.values());
    return {
      ...dataset,
      totalObjectives: merged.length,
      objectives: merged,
    };
  }, [dataset, annualPlans]);

  const savePlanToServer = useCallback(
    async (plan: WeeklyPlanDocument, silent = false) => {
      if (!effectiveDataset) return;
      setSaving(true);
      try {
        const toSave: WeeklyPlanDocument = {
          ...plan,
          editorHtml: plan.editorHtml || buildInitialWordHtml(plan, effectiveDataset.objectives),
        };
        const res = await fetch(`/api/plans/${plan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave),
        });
        const data = await res.json();
        if (data.plan) {
          setDirty(false);
          const now = new Date();
          setLastSavedAt(
            `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          );
          if (!silent) notify('Đã lưu kế hoạch tuần thành công!');
        }
      } finally {
        setSaving(false);
      }
    },
    [effectiveDataset, notify]
  );

  useEffect(() => {
    if (!dirty || !activePlan || saving) return;
    const t = setTimeout(() => {
      savePlanToServer(activePlan, true);
    }, 2500);
    return () => clearTimeout(t);
  }, [dirty, activePlan, saving, savePlanToServer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activePlan) savePlanToServer(activePlan, false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePlan, savePlanToServer]);

  const handleSwitchGrade = useCallback(
    (ageGroupId: AgeGroupId) => {
      const target = plans.find((p) => p.ageGroupId === ageGroupId);
      setShowPlanMenu(false);
      setLibraryAgeGroup(ageGroupId);
      if (target) {
        setActivePlanId(target.id);
        setStructuredRevision((r) => r + 1);
        setDirty(false);
        setUndoSnapshot(null);
        const agName = dataset?.ageGroups.find((g) => g.id === ageGroupId)?.name || ageGroupId;
        notify(`Đã chuyển sang ${agName} — Lớp ${target.className}`);
      } else {
        setStep('annual');
        const agName = dataset?.ageGroups.find((g) => g.id === ageGroupId)?.name || ageGroupId;
        notify(`Đang xem Sổ Năm học ${agName} — bấm "+ Khởi tạo Tuần" để bắt đầu soạn!`);
      }
    },
    [plans, dataset, notify]
  );

  const handleSelectRealSchoolClass = useCallback(
    async (lopCode: string) => {
      const cls = await setActiveSchoolClassForGrade(lopCode);
      if (!cls) return;
      setShowPlanMenu(false);
      notify(`Đang tải dữ liệu lớp ${cls.ten_lop} (${schoolCtx.tenTruong})...`);
      await reloadWorkspaceData(cls.nhom_tuoi);
      notify(`Đã chuyển sang lớp ${cls.ten_lop} (${schoolCtx.tenTruong})!`);
    },
    [notify, reloadWorkspaceData, schoolCtx.tenTruong]
  );

  const handleOpenCopyModal = () => {
    setShowPlanMenu(false);
    const curAg = activePlan?.ageGroupId || libraryAgeGroup;
    const curLop = schoolCtx.selectedLopByGrade[curAg];
    const peers = schoolCtx.classes
      .filter((c) => c.nhom_tuoi === curAg && c.lop_code !== curLop)
      .map((c) => c.lop_code);
    setCopyTargets(peers.slice(0, 1));
    setCopyMode('WEEK');
    setShowCopyClassModal(true);
  };

  const handleExecuteCopyAcrossClasses = async () => {
    if (!activePlan || copyTargets.length === 0) return;
    const curLop = schoolCtx.selectedLopByGrade[activePlan.ageGroupId];
    setCopyingBusy(true);
    try {
      const count = await copyPlanAcrossSchoolClasses({
        mode: copyMode,
        srcLopCode: curLop,
        targetLopCodes: copyTargets,
        weekNumber: activePlan.weekNumber,
      });
      setShowCopyClassModal(false);
      notify(
        copyMode === 'ANNUAL'
          ? `Đã sao chép Khung Kế hoạch Năm học sang ${count} lớp cùng khối!`
          : `Đã sao chép Giáo án Tuần ${activePlan.weekNumber} sang ${count} lớp cùng khối!`
      );
    } catch {
      notify('Không thể sao chép kế hoạch sang lớp khác.');
    } finally {
      setCopyingBusy(false);
    }
  };

  const handleOpenTrashModal = async () => {
    setShowPlanMenu(false);
    setTrashClassFilter('ALL');
    const items = await fetchTrashedWeeks('ALL').catch(() => []);
    setTrashedWeeks(items);
    setShowTrashModal(true);
  };

  const handleRestoreTrashedWeek = async (item: HdsbeTrashedWeekItem) => {
    await setActiveSchoolClassForGrade(item.lop_code);
    const restored = await restoreWeekFromTrash(item.lop_code, item.tuan_thu).catch(() => null);
    if (restored) {
      setTrashedWeeks((prev) =>
        prev.filter((x) => !(x.lop_code === item.lop_code && x.tuan_thu === item.tuan_thu))
      );
      await reloadWorkspaceData();
      setActivePlanId(restored.id);
      setShowTrashModal(false);
      notify(`Đã khôi phục Giáo án Tuần ${item.tuan_thu} (${item.ten_lop || item.lop_code}) từ thùng rác!`);
    }
  };

  // Khóa an toàn chống mất chỉnh sửa gõ tay ở Bước 4 khi sửa ngược Bước 1–3
  const handleStructuredUpdate = useCallback(
    (nextPlan: WeeklyPlanDocument, toastMsg?: string) => {
      const cur = plans.find((p) => p.id === nextPlan.id);
      let keepManualA4 = false;

      if (
        cur?.hasManualFullDocEdits &&
        cur.editorHtml &&
        nextPlan.hasManualFullDocEdits !== false
      ) {
        const overwrite = window.confirm(
          'Bản tổng A4 ở Bước 4 đang có nội dung gõ chỉnh sửa tay riêng.\n\n' +
            '• Bấm OK để cập nhật lại bản A4 theo thay đổi mới vừa sửa.\n' +
            '• Bấm Cancel để vẫn lưu thay đổi ở Bước 1–3 nhưng giữ nguyên bản gõ tay ở Bước 4.'
        );
        keepManualA4 = !overwrite;
      }

      if (cur && (toastMsg || cur.hasManualFullDocEdits)) {
        setUndoSnapshot(JSON.parse(JSON.stringify(cur)));
      }

      setPlans((prev) =>
        prev.map((p) =>
          p.id === nextPlan.id
            ? {
                ...nextPlan,
                editorHtml: keepManualA4 ? cur?.editorHtml : undefined,
                hasManualFullDocEdits: keepManualA4,
              }
            : p
        )
      );
      if (!keepManualA4) {
        setStructuredRevision((r) => r + 1);
      }
      setDirty(true);
      if (toastMsg) notify(toastMsg, true);
    },
    [plans, notify]
  );

  const handleUndoLastChange = () => {
    if (!undoSnapshot) return;
    setPlans((prev) => prev.map((p) => (p.id === undoSnapshot.id ? undoSnapshot : p)));
    setStructuredRevision((r) => r + 1);
    setUndoSnapshot(null);
    setDirty(true);
    notify('Đã hoàn tác thao tác vừa rồi!');
  };

  const handleFullHtmlChange = useCallback(
    (html: string, isManualEdit = false) => {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === activePlanId
            ? {
                ...p,
                editorHtml: html,
                hasManualFullDocEdits: isManualEdit ? true : false,
              }
            : p
        )
      );
      setDirty(true);
    },
    [activePlanId]
  );

  const handleCreatePlan = async (plan: WeeklyPlanDocument) => {
    setShowNewModal(false);
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    const data = await res.json();
    if (data.plan) {
      setPlans((prev) => [data.plan, ...prev.filter((p) => p.id !== data.plan.id)]);
      setActivePlanId(data.plan.id);
      setLibraryAgeGroup(data.plan.ageGroupId);
      setStep('board');
      setStructuredRevision((r) => r + 1);
      setDirty(false);
      notify(`Đã tạo giáo án Tuần ${data.plan.weekNumber} – Lớp ${data.plan.className}!`);
    }
  };

  const handleSaveAnnualPlan = async (next: AnnualPlanDocument, msg?: string) => {
    const prevCustomCodes = new Set(
      (annualPlans?.[next.ageGroupId]?.customObjectives || []).map((o) => o.code)
    );
    const nextCustomCodes = new Set((next.customObjectives || []).map((o) => o.code));
    const removedCodes = Array.from(prevCustomCodes).filter((c) => !nextCustomCodes.has(c));

    // Nếu giáo viên xóa 1 Mục tiêu mở rộng (VD: MT105), tự động gỡ sạch mã đó khỏi các tuần liên quan
    if (removedCodes.length > 0) {
      const rmSet = new Set(removedCodes);
      const affectedPlans: WeeklyPlanDocument[] = [];
      setPlans((prev) =>
        prev.map((p) => {
          if (p.ageGroupId !== next.ageGroupId) return p;
          const hadAny =
            p.themeObjectives.some((b) => b.mtCodes.some((c) => rmSet.has(c))) ||
            p.days.some(
              (d) =>
                d.mainLessons.some((l) => l.linkedMtCodes.some((c) => rmSet.has(c))) ||
                d.afternoonLesson?.linkedMtCodes.some((c) => rmSet.has(c))
            );
          if (!hadAny) return p;
          const cleaned: WeeklyPlanDocument = {
            ...p,
            editorHtml: p.hasManualFullDocEdits ? p.editorHtml : undefined,
            themeObjectives: p.themeObjectives.map((b) => ({
              ...b,
              mtCodes: b.mtCodes.filter((c) => !rmSet.has(c)),
            })),
            days: p.days.map((d) => ({
              ...d,
              mainLessons: d.mainLessons.map((l) => ({
                ...l,
                linkedMtCodes: l.linkedMtCodes.filter((c) => !rmSet.has(c)),
              })),
              afternoonLesson: d.afternoonLesson
                ? {
                    ...d.afternoonLesson,
                    linkedMtCodes: d.afternoonLesson.linkedMtCodes.filter((c) => !rmSet.has(c)),
                  }
                : null,
            })),
          };
          affectedPlans.push(cleaned);
          return cleaned;
        })
      );
      if (affectedPlans.length > 0) {
        setStructuredRevision((r) => r + 1);
        affectedPlans.forEach((cp) => {
          fetch(`/api/plans/${cp.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cp),
          }).catch(() => {});
        });
      }
    }

    setAnnualPlans((prev) => (prev ? { ...prev, [next.ageGroupId]: next } : prev));
    try {
      const res = await fetch(`/api/annual-plans/${next.ageGroupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (data.annualPlan) {
        setAnnualPlans((prev) =>
          prev ? { ...prev, [next.ageGroupId]: data.annualPlan } : prev
        );
      }
      if (msg) notify(msg);
    } catch {
      notify('Không lưu được Kế hoạch Năm học.');
    }
  };

  const handleCreateOrOpenWeekFromAnnual = async (
    plan: WeeklyPlanDocument,
    isExisting: boolean
  ) => {
    if (isExisting) {
      setActivePlanId(plan.id);
      setLibraryAgeGroup(plan.ageGroupId);
      setStructuredRevision((r) => r + 1);
      setDirty(false);
      setStep('board');
      notify(`Đã mở giáo án Tuần ${plan.weekNumber} — ${plan.subThemeName}`);
    } else {
      await handleCreatePlan(plan);
    }
  };

  const handleSaveAssessment = async (doc: ThemeAssessmentDocument, silent = true) => {
    setAssessments((prev) => {
      const idx = prev.findIndex((a) => a.id === doc.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = doc;
        return clone;
      }
      return [doc, ...prev];
    });
    try {
      await fetch(`/api/assessments/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (!silent) notify('Đã cập nhật Phiếu đánh giá chủ đề!');
    } catch {
      if (!silent) notify('Lỗi khi lưu Phiếu đánh giá chủ đề.');
    }
  };

  const handleBulkApprovePlans = async (planIds: string[], approverName: string) => {
    if (!dataset || planIds.length === 0) return;
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const idSet = new Set(planIds);

    const updatedPlans = plans.map((p) =>
      idSet.has(p.id)
        ? {
            ...p,
            status: 'APPROVED' as const,
            approvedBy: approverName,
            approvedAt: stamp,
            editorHtml: undefined,
            hasManualFullDocEdits: false,
          }
        : p
    );
    setPlans(updatedPlans);
    setStructuredRevision((r) => r + 1);

    await Promise.all(
      updatedPlans
        .filter((p) => idSet.has(p.id))
        .map((p) =>
          fetch(`/api/plans/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...p,
              editorHtml: buildInitialWordHtml(p, dataset.objectives),
            }),
          })
        )
    );
    notify(`Đã ký duyệt hàng loạt ${planIds.length} kế hoạch tuần thành công!`);
  };

  const handleJumpToSectionFromReview = (section: string) => {
    if (!activePlan) return;
    if (
      section.includes('Mục tiêu') ||
      section.includes('Hoạt động cả tuần') ||
      section.includes('Dùng chung')
    ) {
      setStep('shared');
      return;
    }
    const dayIdx = activePlan.days.findIndex(
      (d) => d.dayLabel.toLowerCase() === section.trim().toLowerCase()
    );
    if (dayIdx >= 0) {
      const targetDay = activePlan.days[dayIdx];
      if (targetDay.mainLessons.length > 0) {
        setFocusTarget({
          dayIdx,
          kind: 'main',
          lessonId: targetDay.mainLessons[0].id,
        });
        setStep('focus');
      } else if (targetDay.afternoonLesson) {
        setFocusTarget({ dayIdx, kind: 'afternoon' });
        setStep('focus');
      } else {
        setStep('board');
      }
      return;
    }
    setStep('board');
  };

  const handleImportDocxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowPlanMenu(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      notify('Vui lòng chọn file Microsoft Word định dạng .docx!');
      return;
    }
    notify(`Đang mở file "${file.name}"...`);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const curAg = activePlan?.ageGroupId || libraryAgeGroup;
      const res = await fetch('/api/import/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, base64, ageGroupId: curAg }),
      });
      const data = await res.json();
      if (!res.ok || !data.imported) {
        notify(data.error || 'Không đọc được file .docx này.');
        return;
      }
      const imp = data.imported;
      // Giữ giáo án nhập ở đúng lớp/khối giáo viên đang mở làm việc (chỉ suy luận khối từ file khi chưa có lớp đang mở)
      const targetAg = (activePlan?.ageGroupId || imp.ageGroupId || curAg) as AgeGroupId;
      const prof = annualPlans?.[targetAg]?.profile;
      const targetClassName =
        (targetAg === activePlan?.ageGroupId ? activePlan?.className : undefined) ||
        prof?.className ||
        imp.className ||
        'Lá 1';
      const targetLopCode = schoolCtx.selectedLopByGrade[targetAg];

      // Không tự động ghi đè tuần đã tồn tại (đặc biệt là tuần ĐÃ DUYỆT) khi file .docx không ghi rõ số tuần mới
      const existingWeeksOfClass = new Set(
        plans.filter((p) => p.ageGroupId === targetAg && p.className === targetClassName).map((p) => p.weekNumber)
      );
      let safeWeekNumber = Number(imp.detectedWeekNumber || imp.weekNumber) || 1;
      if (existingWeeksOfClass.has(safeWeekNumber)) {
        let candidate = Math.max(1, ...Array.from(existingWeeksOfClass)) + 1;
        while (existingWeeksOfClass.has(candidate) && candidate < 53) candidate++;
        safeWeekNumber = Math.min(53, candidate);
      }

      const blank = createBlankPlan({
        ageGroupId: targetAg,
        className: targetClassName,
        teacherName: imp.teacherName || prof?.teacherName || activePlan?.teacherName || 'Giáo viên lớp',
        schoolName: imp.schoolName || prof?.schoolName || activePlan?.schoolName || 'TRƯỜNG MẦM NON',
        governingBody: prof?.governingBody || activePlan?.governingBody || 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
        principalName: prof?.principalName || activePlan?.principalName || 'Ban Giám hiệu',
        themeName: imp.themeName,
        subThemeName: imp.subThemeName,
        weekNumber: safeWeekNumber,
        weekStartDate: activePlan?.weekStartDate || '2026-09-07',
      });
      const importedPlan: WeeklyPlanDocument & { lop_code?: string } = {
        ...blank,
        lop_code: targetLopCode,
        editorHtml: imp.editorHtml,
        hasManualFullDocEdits: true,
      };
      const saveRes = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedPlan),
      });
      const saved = await saveRes.json();
      if (saved.plan) {
        setPlans((prev) => [saved.plan, ...prev.filter((p) => p.id !== saved.plan.id)]);
        setActivePlanId(saved.plan.id);
        setLibraryAgeGroup(saved.plan.ageGroupId);
        setStep('preview');
        setDirty(false);
        notify(`Đã nhập "${file.name}" vào Tuần ${saved.plan.weekNumber} (${imp.wordCount.toLocaleString('vi-VN')} từ)!`);
      }
    } catch {
      notify('Có lỗi khi tải file .docx lên.');
    }
  };

  const handleDuplicateNextWeek = async () => {
    if (!activePlan) return;
    setShowPlanMenu(false);
    const nextMonday = addDaysISO(activePlan.weekStartDate, 7);
    const clone = syncWeekDates(
      {
        ...activePlan,
        id: `plan_${Date.now()}`,
        status: 'DRAFT',
        weekNumber: activePlan.weekNumber + 1,
        includeThemeSection: false,
        editorHtml: undefined,
        hasManualFullDocEdits: false,
        approvedAt: undefined,
        approvedBy: undefined,
        submittedAt: undefined,
        reviewComments: [],
        days: activePlan.days.map((d) => ({
          ...d,
          isHoliday: false,
          holidayName: undefined,
          evalHealth: '',
          evalEmotionBehavior: '',
          evalKnowledgeSkill: '',
        })),
      },
      nextMonday
    );
    await handleCreatePlan(clone);
  };

  const handleDeletePlan = async (id: string) => {
    if (plans.length <= 1) return;
    setShowPlanMenu(false);
    await fetch(`/api/plans/${id}`, { method: 'DELETE' });
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activePlanId === id && next.length) setActivePlanId(next[0].id);
      return next;
    });
    notify('Đã xóa giáo án tuần.');
  };

  const triggerDownload = async (
    url: string,
    plan: WeeklyPlanDocument,
    filename: string,
    overrideHtml?: string
  ) => {
    if (!dataset) return;
    notify(`Đang xuất ${filename}...`);
    const latestHtml =
      overrideHtml || plan.editorHtml || buildInitialWordHtml(plan, dataset.objectives);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, editorHtml: latestHtml }),
    });
    if (!res.ok) {
      notify('Lỗi khi xuất file.');
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
    notify(`Đã tải về ${filename}!`);
  };

  const handleAttachMtFromModal = (obj: ObjectiveItem) => {
    if (!activePlan) return;
    const isNhaTre = activePlan.ageGroupId === 'NHA_TRE_24_36T';
    const dk =
      isNhaTre && domainToKey(obj.domain) === 'PTTM' ? 'PT_TCKNXH' : domainToKey(obj.domain);
    const nextBlocks = activePlan.themeObjectives.map((blk) =>
      blk.domainKey === dk && !blk.mtCodes.includes(obj.code)
        ? { ...blk, mtCodes: [...blk.mtCodes, obj.code] }
        : blk
    );
    handleStructuredUpdate(
      { ...activePlan, themeObjectives: nextBlocks },
      `Đã gắn ${obj.code} vào mục tiêu tuần!`
    );
  };

  const handleAddLessonFromModal = (
    topic: string,
    subject: string,
    mtCode: string,
    obj?: ObjectiveItem
  ) => {
    if (!activePlan) return;
    let targetDayIdx = 0;
    let minLen = 999;
    activePlan.days.forEach((d, idx) => {
      if (!d.isHoliday && d.mainLessons.length < minLen) {
        minLen = d.mainLessons.length;
        targetDayIdx = idx;
      }
    });
    const newLesson = buildPedagogicalLessonPlan({
      topicTitle: topic,
      subjectCode: subject,
      ageGroupId: activePlan.ageGroupId,
      slotType: 'MAIN',
      mtCode,
      obj,
    });
    const nextDays = activePlan.days.map((d, idx) =>
      idx === targetDayIdx ? { ...d, mainLessons: [...d.mainLessons, newLesson] } : d
    );
    handleStructuredUpdate(
      { ...activePlan, days: nextDays },
      `Đã xếp [${newLesson.subjectCode}] vào ${activePlan.days[targetDayIdx].dayLabel}!`
    );
    setFocusTarget({ dayIdx: targetDayIdx, kind: 'main', lessonId: newLesson.id });
    setStep('focus');
  };

  const handleApplySavedTemplateFromLibrary = (tpl: {
    subjectCode: string;
    topicTitle: string;
    linkedMtCodes: string[];
    richHtml: string;
  }) => {
    if (!activePlan || !effectiveDataset) return;
    let targetDayIdx = 0;
    let minLen = 999;
    activePlan.days.forEach((d, idx) => {
      if (!d.isHoliday && d.mainLessons.length < minLen) {
        minLen = d.mainLessons.length;
        targetDayIdx = idx;
      }
    });
    const obj = tpl.linkedMtCodes?.[0]
      ? effectiveDataset.objectives.find(
          (o) => o.ageGroupId === activePlan.ageGroupId && o.code === tpl.linkedMtCodes[0]
        )
      : undefined;
    const baseLesson = buildPedagogicalLessonPlan({
      topicTitle: tpl.topicTitle,
      subjectCode: tpl.subjectCode,
      ageGroupId: activePlan.ageGroupId,
      slotType: 'MAIN',
      mtCode: tpl.linkedMtCodes?.[0] || '',
      obj,
    });
    const fullLesson = {
      ...baseLesson,
      linkedMtCodes: tpl.linkedMtCodes?.length ? tpl.linkedMtCodes : baseLesson.linkedMtCodes,
      richHtml: tpl.richHtml || baseLesson.richHtml,
    };
    const nextDays = activePlan.days.map((d, idx) =>
      idx === targetDayIdx ? { ...d, mainLessons: [...d.mainLessons, fullLesson] } : d
    );
    handleStructuredUpdate(
      { ...activePlan, days: nextDays },
      `Đã xếp nguyên văn Bài giảng mẫu "${tpl.topicTitle}" vào ${activePlan.days[targetDayIdx].dayLabel}!`
    );
    setFocusTarget({ dayIdx: targetDayIdx, kind: 'main', lessonId: fullLesson.id });
    setStep('focus');
  };

  const triggerAnnualDocxDownload = async () => {
    if (!activeAnnualPlan) return;
    notify('Đang xuất Sổ Kế hoạch Giáo dục Năm học (.docx)...');
    const res = await fetch('/api/export/annual-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annualPlan: activeAnnualPlan }),
    });
    if (!res.ok) {
      notify('Lỗi khi xuất Sổ Năm học.');
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `KHGD_NamHoc_${activeAnnualPlan.profile.className.replace(/\s+/g, '')}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
    notify('Đã tải Sổ Kế hoạch Giáo dục Năm học (.docx)!');
  };

  if (!effectiveDataset || !activePlan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8F7] text-sm text-slate-500">
        Đang mở trình soạn Kế hoạch Giáo dục Mầm non...
      </div>
    );
  }

  const activeAnnualAgeGroup: AgeGroupId =
    step === 'annual' ? libraryAgeGroup || activePlan.ageGroupId : activePlan.ageGroupId;
  const activeAnnualPlan = annualPlans?.[activeAnnualAgeGroup] || null;
  const unresolvedComments = (activePlan.reviewComments || []).filter((c) => !c.resolved).length;

  const STEPS: Array<{ id: WorkspaceStep; label: string }> = [
    { id: 'annual', label: '1. Năm học' },
    { id: 'board', label: '2. KH Tháng & Tuần' },
    { id: 'shared', label: '3. HĐ cả tuần' },
    { id: 'focus', label: '4. Giáo án Ngày' },
    { id: 'preview', label: '5. Bản in A4' },
    { id: 'closing', label: '6. Đánh giá & Duyệt' },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F6F8F7]">
      {/* =================================================================== */}
      {/* CALM, UNCLUTTERED 3-GROUP TOP HEADER                                */}
      {/* =================================================================== */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
        {/* GROUP 1 (Left): Single clean Plan & Grade Dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowPlanMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-left transition hover:bg-slate-100"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <span className="max-w-[175px] truncate">
                  Tuần {activePlan.weekNumber} · {activePlan.className}
                </span>
                {activePlan.status === 'APPROVED' && (
                  <span
                    title="Đã được BGH phê duyệt trực tuyến"
                    className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800"
                  >
                    Đã duyệt
                  </span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <div className="max-w-[195px] truncate text-[11px] text-slate-500">
                {activePlan.subThemeName}
              </div>
            </div>
          </button>

          {/* Clean Dropdown Menu containing School Class Selector, 4 Grades, Saved Plans & Actions */}
          {showPlanMenu && (
            <div className="absolute top-13 left-0 z-50 w-84 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              {schoolCtx.connected && (
                <div className="mb-3 rounded-xl border border-blue-100 bg-[#EFF6FF] p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#1E3A8A]">
                    <span className="truncate">{schoolCtx.tenTruong}</span>
                    <span className="shrink-0 rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] text-[#1D4ED8]">
                      {schoolCtx.namHoc}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <select
                      value={schoolCtx.selectedLopByGrade[activeAnnualAgeGroup] || ''}
                      onChange={(e) => handleSelectRealSchoolClass(e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8]"
                    >
                      {schoolCtx.classes.map((cls) => (
                        <option key={cls.lop_code} value={cls.lop_code}>
                          Lớp {cls.ten_lop} (Mã lớp: {cls.lop_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Chuyển nhanh 4 Khối lớp
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                {effectiveDataset.ageGroups.map((ag) => {
                  const isCur = ag.id === activeAnnualAgeGroup;
                  return (
                    <button
                      key={ag.id}
                      onClick={() => handleSwitchGrade(ag.id)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition ${
                        isCur ? 'bg-[#1D4ED8] text-white' : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      {ag.short}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Giáo án của tôi ({plans.length})
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {plans.map((p) => {
                  const isCur = p.id === activePlan.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePlanId(p.id);
                        setLibraryAgeGroup(p.ageGroupId);
                        setStructuredRevision((r) => r + 1);
                        setDirty(false);
                        setShowPlanMenu(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        isCur
                          ? 'bg-[#DBEAFE] font-bold text-[#1E3A8A]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">
                        Tuần {p.weekNumber} · {p.className} — {p.subThemeName}
                      </span>
                      {p.status === 'APPROVED' && (
                        <span className="shrink-0 text-[10px] font-bold text-blue-700">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-xs">
                <button
                  onClick={() => {
                    setShowPlanMenu(false);
                    setShowNewModal(true);
                  }}
                  className="block w-full rounded-lg px-2.5 py-2 text-left font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                >
                  + Tạo kế hoạch tuần mới
                </button>
                <button
                  onClick={handleDuplicateNextWeek}
                  className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  Nhân bản sang tuần kế tiếp
                </button>
                {schoolCtx.connected && (
                  <>
                    <button
                      onClick={handleOpenCopyModal}
                      className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Sao chép KH sang lớp khác cùng khối
                    </button>
                    <button
                      onClick={handleOpenTrashModal}
                      className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Thùng rác / Khôi phục tuần đã xóa
                    </button>
                  </>
                )}
                <button
                  onClick={() => docxInputRef.current?.click()}
                  className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  Nhập file Word (.docx) có sẵn
                </button>
                <button
                  onClick={() => {
                    setShowPlanMenu(false);
                    setLibraryModalTab('media');
                  }}
                  className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  Bài mẫu &amp; Kho Media giảng dạy
                </button>
                <button
                  onClick={() => {
                    setShowPlanMenu(false);
                    setLibraryModalTab('bank');
                  }}
                  className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  Mở Kho tra cứu ({crawledSummary.totalDocs || 0} tài liệu)
                </button>
                {plans.length > 1 && (
                  <button
                    onClick={() => handleDeletePlan(activePlan.id)}
                    className="block w-full rounded-lg px-2.5 py-2 text-left font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Xóa giáo án tuần này
                  </button>
                )}
              </div>
            </div>
          )}

          <input
            ref={docxInputRef}
            type="file"
            accept=".docx"
            onChange={handleImportDocxFile}
            className="hidden"
          />
        </div>

        {/* GROUP 2 (Center): Clean End-to-End Text Stepper */}
        <nav className="flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-1 xl:flex-none xl:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEPS.map((st) => {
            const active = step === st.id;
            const showBadge = st.id === 'closing' && unresolvedComments > 0;
            return (
              <button
                key={st.id}
                onClick={() => setStep(st.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#1D4ED8] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                }`}
              >
                <span>{st.label}</span>
                {showBadge && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {unresolvedComments}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* GROUP 3 (Right): Guide + Save + Export (clean text-only buttons) */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowGuideModal(true)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1D4ED8] hover:bg-white hover:text-[#1D4ED8]"
          >
            Hướng dẫn
          </button>

          <button
            onClick={() => savePlanToServer(activePlan, false)}
            disabled={saving}
            title="Lưu (Ctrl+S) — Tự động lưu sau 2.5 giây"
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              dirty
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {saving ? 'Đang lưu...' : dirty ? 'Lưu' : lastSavedAt ? `Đã lưu ${lastSavedAt}` : 'Đã lưu'}
          </button>

          <button
            onClick={() => {
              if (step === 'annual' && activeAnnualPlan) {
                triggerAnnualDocxDownload();
              } else {
                triggerDownload(
                  '/api/export/docx',
                  activePlan,
                  `KeHoach_Tuan${activePlan.weekNumber}_${activePlan.className.replace(/\s+/g, '')}.docx`
                );
              }
            }}
            className="rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            {step === 'annual' ? 'Xuất Sổ Năm' : 'Xuất Word'}
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* ACTIVE STEP VIEW                                                    */}
      {/* =================================================================== */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {step === 'annual' && activeAnnualPlan && (
          <AnnualCurriculumView
            annualPlan={activeAnnualPlan}
            allPlans={plans}
            dataset={effectiveDataset}
            onSwitchGrade={handleSwitchGrade}
            onSaveAnnualPlan={handleSaveAnnualPlan}
            onCreateOrOpenWeek={handleCreateOrOpenWeekFromAnnual}
          />
        )}

        {step === 'board' && (
          <WeeklyBoardView
            plan={activePlan}
            annualPlan={activeAnnualPlan}
            allPlans={plans}
            dataset={effectiveDataset}
            onUpdatePlan={handleStructuredUpdate}
            onSaveAnnualPlan={handleSaveAnnualPlan}
            onSwitchGrade={handleSwitchGrade}
            onOpenGuide={() => setShowGuideModal(true)}
            onOpenLessonEditor={(dayIdx, target) => {
              setFocusTarget(
                target.kind === 'main'
                  ? { dayIdx, kind: 'main', lessonId: target.lessonId }
                  : { dayIdx, kind: 'afternoon' }
              );
              setStep('focus');
            }}
            onGoToStep={setStep}
          />
        )}

        {step === 'shared' && (
          <SharedBlocksView
            plan={activePlan}
            dataset={effectiveDataset}
            onUpdatePlan={handleStructuredUpdate}
            onOpenGuide={() => setShowGuideModal(true)}
            onGoToStep={setStep}
          />
        )}

        {step === 'focus' && (
          <FocusedWordStudio
            plan={activePlan}
            allPlans={plans}
            dataset={effectiveDataset}
            initialTarget={focusTarget}
            onUpdatePlan={handleStructuredUpdate}
            onOpenFullLibrary={(t) => setLibraryModalTab(t)}
            onGoToPreview={() => setStep('preview')}
          />
        )}

        {step === 'preview' && (
          <FullPreviewAuditView
            plan={activePlan}
            dataset={effectiveDataset}
            crawledTotalDocs={crawledSummary.totalDocs}
            structuredRevision={structuredRevision}
            onFullHtmlChange={handleFullHtmlChange}
            onExportFullDocx={(latestHtml) =>
              triggerDownload(
                '/api/export/docx',
                activePlan,
                `KeHoach_Tuan${activePlan.weekNumber}_${activePlan.className.replace(/\s+/g, '')}.docx`,
                latestHtml
              )
            }
            onExportParentDocx={() =>
              triggerDownload(
                '/api/export/parent-schedule-docx',
                activePlan,
                `LichTuan${activePlan.weekNumber}_PhuHuynh_${activePlan.className.replace(/\s+/g, '')}.docx`
              )
            }
            onExportXlsx={() =>
              triggerDownload(
                '/api/export/xlsx',
                activePlan,
                `KeHoach_Tuan${activePlan.weekNumber}_${activePlan.className.replace(/\s+/g, '')}.xlsx`
              )
            }
            onOpenFullLibrary={(t) => setLibraryModalTab(t)}
            onNotify={notify}
          />
        )}

        {step === 'closing' && activeAnnualPlan && (
          <AssessmentAndApprovalView
            plan={activePlan}
            allPlans={plans}
            annualPlan={activeAnnualPlan}
            dataset={effectiveDataset}
            assessments={assessments}
            onSaveAssessment={handleSaveAssessment}
            onUpdatePlan={handleStructuredUpdate}
            onBulkApprovePlans={handleBulkApprovePlans}
            onJumpToSection={handleJumpToSectionFromReview}
            onGoToAnnualRoster={() => setStep('annual')}
            onGoToPreview={() => setStep('preview')}
            onSelectSchoolClass={handleSelectRealSchoolClass}
            onNotify={notify}
          />
        )}
      </div>

      {/* Modal Sao chép KH giữa các lớp cùng khối (chuẩn Vietec Video #14) */}
      {showCopyClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">
              Sao chép Kế hoạch sang lớp khác cùng khối
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Nguồn: <strong>Lớp {activePlan.className}</strong> ({schoolCtx.tenTruong}). Hệ thống tự động cập nhật tên lớp và giáo viên chủ nhiệm tương ứng ở lớp nhận.
            </p>

            <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="radio"
                  checked={copyMode === 'WEEK'}
                  onChange={() => setCopyMode('WEEK')}
                />
                <span>Sao chép trọn bộ Giáo án Tuần {activePlan.weekNumber} ({activePlan.subThemeName})</span>
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="radio"
                  checked={copyMode === 'ANNUAL'}
                  onChange={() => setCopyMode('ANNUAL')}
                />
                <span>Sao chép Khung Kế hoạch Năm học, TKB &amp; 9 Chủ đề Tháng</span>
              </label>
            </div>

            <div className="mt-3">
              <div className="text-xs font-bold text-slate-700">Chọn các lớp cùng khối nhận bản sao:</div>
              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5 text-xs">
                {schoolCtx.classes
                  .filter(
                    (c) =>
                      c.nhom_tuoi === activePlan.ageGroupId &&
                      c.lop_code !== schoolCtx.selectedLopByGrade[activePlan.ageGroupId]
                  )
                  .map((cls) => {
                    const checked = copyTargets.includes(cls.lop_code);
                    return (
                      <label key={cls.lop_code} className="flex items-center gap-2 py-0.5 text-slate-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCopyTargets((prev) =>
                              checked ? prev.filter((x) => x !== cls.lop_code) : [...prev, cls.lop_code]
                            )
                          }
                        />
                        <span className="font-medium">
                          Lớp {cls.ten_lop} <span className="text-slate-400">(Mã: {cls.lop_code})</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCopyClassModal(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={copyingBusy || copyTargets.length === 0}
                onClick={handleExecuteCopyAcrossClasses}
                className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E40AF] disabled:opacity-50"
              >
                {copyingBusy ? 'Đang sao chép...' : `Sao chép sang ${copyTargets.length} lớp`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thùng rác & Khôi phục giáo án tuần đã xóa (chuẩn Vietec Video #23) */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Thùng rác — Khôi phục Giáo án Tuần đã xóa ({schoolCtx.tenTruong})
              </h3>
              <select
                value={trashClassFilter}
                onChange={(e) => setTrashClassFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
              >
                <option value="ALL">Tất cả các lớp ({trashedWeeks.length})</option>
                {schoolCtx.classes.map((c) => (
                  <option key={c.lop_code} value={c.lop_code}>
                    Lớp {c.ten_lop} ({c.lop_code})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Các giáo án tuần khi xóa được giữ an toàn trong thùng rác để khôi phục lại ngay cả khi lớp đã xóa hết tuần đang soạn.
            </p>
            {(() => {
              const visibleTrash =
                trashClassFilter === 'ALL'
                  ? trashedWeeks
                  : trashedWeeks.filter((tw) => tw.lop_code === trashClassFilter);
              return (
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {visibleTrash.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                      Thùng rác trống — không có giáo án tuần nào đang chờ khôi phục.
                    </div>
                  ) : (
                    visibleTrash.map((tw) => (
                      <div
                        key={`${tw.lop_code}_${tw.tuan_thu}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                              {tw.ten_lop || `Lớp ${tw.lop_code}`}
                            </span>
                            <span className="truncate">
                              Tuần {tw.tuan_thu} (Tháng {tw.thang}): {tw.ten_nhanh_tuan}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            Chủ đề: {tw.ten_chu_de} · {tw.tu_ngay} → {tw.den_ngay}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreTrashedWeek(tw)}
                          className="shrink-0 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E40AF]"
                        >
                          Khôi phục
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showGuideModal && (
        <UserGuideModal
          onClose={() => setShowGuideModal(false)}
          onGoToStep={(st) => setStep(st)}
        />
      )}

      {showNewModal && (
        <NewPlanModal
          ageGroups={effectiveDataset.ageGroups}
          defaultAgeGroup={libraryAgeGroup || activePlan.ageGroupId}
          annualPlans={annualPlans}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreatePlan}
        />
      )}

      {libraryModalTab && (
        <ReferenceLibraryModal
          initialTab={libraryModalTab}
          dataset={effectiveDataset}
          selectedAgeGroup={libraryAgeGroup}
          onSelectAgeGroup={setLibraryAgeGroup}
          activePlanTitle={`Tuần ${activePlan.weekNumber} – Lớp ${activePlan.className}`}
          crawledSummary={crawledSummary}
          onRefreshSummary={fetchCrawledSummary}
          onAttachMt={handleAttachMtFromModal}
          onInsertExcelActivity={(obj: ObjectiveItem, act: SuggestedActivity) =>
            handleAddLessonFromModal(act.text, act.type, obj.code, obj)
          }
          onApplySavedTemplate={(tpl) => handleApplySavedTemplateFromLibrary(tpl)}
          onInsertCrawledLesson={(les, mt, ag) => {
            const obj = effectiveDataset.objectives.find((o) => o.ageGroupId === ag && o.code === mt);
            handleAddLessonFromModal(les.topic, les.subject, mt, obj);
          }}
          onClose={() => setLibraryModalTab(null)}
        />
      )}

      {/* Smart Toast with 1-Click Undo */}
      {toast && (
        <div className="fixed right-5 bottom-8 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          <span>{toast.msg}</span>
          {toast.canUndo && undoSnapshot && (
            <button
              onClick={handleUndoLastChange}
              className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-300 hover:bg-blue-500/30"
            >
              Hoàn tác
            </button>
          )}
        </div>
      )}
    </div>
  );
}
