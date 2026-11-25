import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  FileText,
  GraduationCap,
  HelpCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
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
    Promise.all([
      fetch('/api/objectives').then((r) => r.json()),
      fetch('/api/plans').then((r) => r.json()),
      fetch('/api/annual-plans').then((r) => r.json()).catch(() => ({ annualPlans: null })),
      fetch('/api/assessments').then((r) => r.json()).catch(() => ({ assessments: [] })),
    ]).then(([objData, planData, annualData, assessData]) => {
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
      if (list.length > 0) {
        const storedId = sessionStorage.getItem('mn_active_plan_id');
        const picked = list.find((p) => p.id === storedId) || list[0];
        setActivePlanId(picked.id);
        setLibraryAgeGroup(picked.ageGroupId);
      }
    });
    fetchCrawledSummary();
  }, []);

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
      } else if (step !== 'annual') {
        setShowNewModal(true);
      }
    },
    [plans, dataset, notify, step]
  );

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
      setPlans((prev) => [data.plan, ...prev]);
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

      const res = await fetch('/api/import/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.imported) {
        notify(data.error || 'Không đọc được file .docx này.');
        return;
      }
      const imp = data.imported;
      const prof = annualPlans?.[imp.ageGroupId as AgeGroupId]?.profile;
      const blank = createBlankPlan({
        ageGroupId: imp.ageGroupId,
        className: imp.className || prof?.className || 'Lá 1',
        teacherName: imp.teacherName || prof?.teacherName || 'Giáo viên lớp',
        schoolName: imp.schoolName || prof?.schoolName || 'TRƯỜNG MẦM NON',
        governingBody: prof?.governingBody || 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
        principalName: prof?.principalName || activePlan?.principalName || 'Ban Giám hiệu',
        themeName: imp.themeName,
        subThemeName: imp.subThemeName,
        weekNumber: imp.weekNumber,
        weekStartDate: activePlan?.weekStartDate || '2026-09-07',
      });
      const importedPlan: WeeklyPlanDocument = {
        ...blank,
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
        setPlans((prev) => [saved.plan, ...prev]);
        setActivePlanId(saved.plan.id);
        setLibraryAgeGroup(saved.plan.ageGroupId);
        setStep('preview');
        setDirty(false);
        notify(`Đã nhập "${file.name}" (${imp.wordCount.toLocaleString('vi-VN')} từ)!`);
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
    { id: 'annual', label: '1. Năm học & TKB' },
    { id: 'board', label: '2. KH Tháng & Tuần' },
    { id: 'shared', label: '3. Hoạt động cả tuần' },
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
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B6E5C] text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <span className="max-w-[165px] truncate">
                  Tuần {activePlan.weekNumber} · {activePlan.className}
                </span>
                {activePlan.status === 'APPROVED' && (
                  <span
                    title="Đã được BGH phê duyệt trực tuyến"
                    className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800"
                  >
                    ✓
                  </span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <div className="max-w-[185px] truncate text-[11px] text-slate-500">
                {activePlan.subThemeName}
              </div>
            </div>
          </button>

          {/* Clean Dropdown Menu containing 4 Grades, Saved Plans & Actions */}
          {showPlanMenu && (
            <div className="absolute top-13 left-0 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
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
                        isCur ? 'bg-[#0B6E5C] text-white' : 'text-slate-600 hover:bg-white'
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
                          ? 'bg-[#E6F4F1] font-bold text-[#074F42]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">
                        Tuần {p.weekNumber} · {p.className} — {p.subThemeName}
                      </span>
                      {p.status === 'APPROVED' && (
                        <span className="shrink-0 text-[10px] font-bold text-emerald-700">✓</span>
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
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-[#0B6E5C] hover:bg-[#E6F4F1]"
                >
                  <Plus className="h-4 w-4" /> Tạo kế hoạch tuần mới
                </button>
                <button
                  onClick={handleDuplicateNextWeek}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="h-4 w-4 text-slate-400" /> Nhân bản sang tuần kế tiếp
                </button>
                <button
                  onClick={() => docxInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Upload className="h-4 w-4 text-slate-400" /> Nhập file Word (.docx) có sẵn
                </button>
                <button
                  onClick={() => {
                    setShowPlanMenu(false);
                    setLibraryModalTab('media');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Database className="h-4 w-4 text-amber-500" /> Bài mẫu &amp; Kho Media giảng dạy
                </button>
                <button
                  onClick={() => {
                    setShowPlanMenu(false);
                    setLibraryModalTab('bank');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Database className="h-4 w-4 text-slate-400" /> Mở Kho tra cứu ({crawledSummary.totalDocs || 0} tài liệu)
                </button>
                {plans.length > 1 && (
                  <button
                    onClick={() => handleDeletePlan(activePlan.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Xóa giáo án tuần này
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
        <nav className="flex items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEPS.map((st) => {
            const active = step === st.id;
            const showBadge = st.id === 'closing' && unresolvedComments > 0;
            return (
              <button
                key={st.id}
                onClick={() => setStep(st.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#0B6E5C] text-white shadow-2xs'
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

        {/* GROUP 3 (Right): Guide + Save + Export (only 3 clean buttons!) */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#0B6E5C] hover:bg-white hover:text-[#0B6E5C]"
          >
            <HelpCircle className="h-4 w-4 text-[#0B6E5C]" />
            <span className="hidden xl:inline">Hướng dẫn</span>
          </button>

          <button
            onClick={() => savePlanToServer(activePlan, false)}
            disabled={saving}
            title="Lưu (Ctrl+S) — Tự động lưu sau 2.5 giây"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? (
              <Save className="h-3.5 w-3.5 animate-pulse text-[#0B6E5C]" />
            ) : dirty ? (
              <Save className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span className="hidden xl:inline">
              {saving ? 'Đang lưu' : dirty ? 'Lưu' : lastSavedAt ? `Đã lưu ${lastSavedAt}` : 'Đã lưu'}
            </span>
          </button>

          <button
            onClick={() =>
              triggerDownload(
                '/api/export/docx',
                activePlan,
                `KeHoach_Tuan${activePlan.weekNumber}_${activePlan.className.replace(/\s+/g, '')}.docx`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085A4B]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Xuất Word</span>
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
            onNotify={notify}
          />
        )}
      </div>

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
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              <RotateCcw className="h-3 w-3" /> Hoàn tác
            </button>
          )}
        </div>
      )}
    </div>
  );
}
