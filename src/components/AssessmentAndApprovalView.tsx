import React, { useEffect, useMemo, useState } from 'react';
import type {
  AnnualPlanDocument,
  MtEvalLevel,
  ObjectivesDataset,
  ReviewComment,
  ThemeAssessmentDocument,
  WeeklyPlanDocument,
} from '../../shared/types';
import { fmtDateVN } from '../utils/helpers';

interface Props {
  plan: WeeklyPlanDocument;
  allPlans: WeeklyPlanDocument[];
  annualPlan: AnnualPlanDocument;
  dataset: ObjectivesDataset;
  assessments: ThemeAssessmentDocument[];
  onSaveAssessment: (doc: ThemeAssessmentDocument, silent?: boolean) => Promise<void>;
  onUpdatePlan: (next: WeeklyPlanDocument, toastMsg?: string) => void;
  onBulkApprovePlans: (planIds: string[], approverName: string) => Promise<void>;
  onJumpToSection: (section: string) => void;
  onGoToAnnualRoster: () => void;
  onGoToPreview: () => void;
  onNotify: (msg: string) => void;
}

const EVAL_TEMPLATES = {
  executedObjectivesNote: [
    'Đa số trẻ đạt được các mục tiêu kiến thức, kỹ năng và thái độ đề ra trong chủ đề; các hoạt động phân bổ cân đối giữa các lĩnh vực phát triển.',
    'Thực hiện đầy đủ 100% mục tiêu dự kiến của chủ đề; nội dung giáo dục phù hợp nhận thức thực tế của trẻ tại lớp.',
  ],
  childrenInterestNote: [
    'Trẻ hào hứng tham gia hoạt động học có chủ đích, tích cực giao tiếp với cô và bạn trong giờ chơi góc và hoạt động ngoài trời.',
    'Trẻ mạnh dạn, tự tin thể hiện sản phẩm tạo hình, thuộc thơ/bài hát trong chủ đề và biết giữ gìn đồ dùng đồ chơi gọn gàng.',
  ],
  advantagesDifficultiesNote: [
    'Thuận lợi: Đồ dùng trực quan phong phú, phụ huynh phối hợp tốt. Khó khăn: 2–3 trẻ còn nhút nhát hoặc chú ý chưa bền trong hoạt động tập thể.',
    'Thuận lợi: Môi trường lớp học mở phát huy tính tích cực của trẻ. Khó khăn: Thời tiết thay đổi ảnh hưởng một số buổi quan sát ngoài trời.',
  ],
  nextThemeAdjustmentNote: [
    'Tăng cường rèn cá nhân ở hoạt động chiều và góc chơi cho các trẻ chưa đạt mục tiêu; bổ sung thêm học liệu mở cho chủ đề kế tiếp.',
    'Phối hợp trao đổi trực tiếp với phụ huynh để đồng hành rèn kỹ năng tự phục vụ và ngôn ngữ mạch lạc cho trẻ tại nhà.',
  ],
};

const QUICK_REVIEW_COMMENTS = [
  'Kế hoạch tuần phân bố cân đối các lĩnh vực, mục tiêu bám sát độ tuổi và chủ đề.',
  'Cần bổ sung thêm câu hỏi mở kích thích tư duy trẻ ở Hoạt động 2.',
  'Lưu ý chuẩn bị đồ dùng trực quan đảm bảo an toàn tuyệt đối cho trẻ khi trải nghiệm.',
  'Hoạt động góc và hoạt động chiều cần ghi rõ tên trò chơi rèn kỹ năng còn hạn chế của trẻ.',
];

const TARGET_SECTIONS = [
  'Mục tiêu tuần',
  'Hoạt động cả tuần (Thể dục / Góc / Ngoài trời)',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
];

export const AssessmentAndApprovalView: React.FC<Props> = ({
  plan,
  allPlans,
  annualPlan,
  dataset,
  assessments,
  onSaveAssessment,
  onUpdatePlan,
  onBulkApprovePlans,
  onJumpToSection,
  onGoToAnnualRoster,
  onGoToPreview,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'daily' | 'assessment' | 'yearEnd' | 'approval'>('assessment');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [activeRole, setActiveRole] = useState<'TEACHER' | 'BGH'>('TEACHER');
  const [selectedThemeName, setSelectedThemeName] = useState<string>(plan.themeName);
  const [approverInput, setApproverInput] = useState<string>(
    plan.principalName || annualPlan.profile.principalName || 'Nguyễn Thị Thủy'
  );
  const [commentSection, setCommentSection] = useState<string>('Thứ hai');
  const [commentText, setCommentText] = useState<string>('');
  const [exportingDocx, setExportingDocx] = useState<'summary' | 'individual' | null>(null);
  const [yearEndSyncedAt, setYearEndSyncedAt] = useState<string>('');
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    setSelectedThemeName(plan.themeName);
  }, [plan.themeName, plan.ageGroupId]);

  useEffect(() => {
    setApproverInput(plan.principalName || annualPlan.profile.principalName || 'Ban Giám hiệu');
  }, [plan.principalName, annualPlan.profile.principalName]);

  const gradeObjectives = useMemo(
    () => dataset.objectives.filter((o) => o.ageGroupId === plan.ageGroupId),
    [dataset.objectives, plan.ageGroupId]
  );

  const objByCode = useMemo(
    () => new Map(gradeObjectives.map((o) => [o.code, o])),
    [gradeObjectives]
  );

  const availableThemes = useMemo(() => {
    const names = new Set<string>();
    names.add(plan.themeName);
    annualPlan.themes.forEach((t) => names.add(t.themeName));
    allPlans
      .filter((p) => p.ageGroupId === plan.ageGroupId)
      .forEach((p) => names.add(p.themeName));
    return Array.from(names);
  }, [plan.themeName, plan.ageGroupId, annualPlan.themes, allPlans]);

  // Tự động thu thập các mã MT đã dạy + các MT đánh dấu sao (★) trong chủ đề đang chọn
  const collectedMtCodes = useMemo(() => {
    const codes = new Set<string>();
    const annualTheme = annualPlan.themes.find(
      (t) => t.themeName.trim().toLowerCase() === selectedThemeName.trim().toLowerCase()
    );
    annualTheme?.assessmentMtCodes?.forEach((c) => codes.add(c));

    const matchingWeeks = allPlans.filter(
      (p) =>
        p.ageGroupId === plan.ageGroupId &&
        p.themeName.trim().toLowerCase() === selectedThemeName.trim().toLowerCase()
    );
    matchingWeeks.forEach((wp) => {
      wp.themeObjectives.forEach((b) => b.mtCodes.forEach((c) => codes.add(c)));
      wp.days.forEach((d) => {
        if (d.isHoliday) return;
        d.mainLessons.forEach((l) => l.linkedMtCodes.forEach((c) => codes.add(c)));
        d.afternoonLesson?.linkedMtCodes.forEach((c) => codes.add(c));
      });
    });

    if (codes.size === 0 && annualTheme) {
      annualTheme.plannedMtCodes.forEach((c) => codes.add(c));
    }

    return Array.from(codes)
      .filter((c) => objByCode.has(c))
      .sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return na - nb;
      });
  }, [allPlans, plan.ageGroupId, selectedThemeName, annualPlan.themes, objByCode]);

  const students = annualPlan.profile.students || [];

  const assessmentId = useMemo(() => {
    const slug = selectedThemeName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return `assess_${plan.ageGroupId}_${slug}`;
  }, [plan.ageGroupId, selectedThemeName]);

  const existingAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId),
    [assessments, assessmentId]
  );

  const [draftAssessment, setDraftAssessment] = useState<ThemeAssessmentDocument>(() => {
    if (existingAssessment) return existingAssessment;
    const initEvals: Record<string, Record<string, MtEvalLevel>> = {};
    students.forEach((st) => {
      initEvals[st.id] = {};
      collectedMtCodes.forEach((c) => {
        initEvals[st.id][c] = 'ACHIEVED';
      });
    });
    return {
      id: assessmentId,
      ageGroupId: plan.ageGroupId,
      className: plan.className,
      schoolName: plan.schoolName,
      teacherName: plan.teacherName,
      principalName: plan.principalName,
      schoolYear: plan.schoolYear,
      themeName: selectedThemeName,
      durationText: `${fmtDateVN(plan.themeStartDate)} – ${fmtDateVN(plan.themeEndDate)}`,
      mtCodes: collectedMtCodes,
      executedObjectivesNote: EVAL_TEMPLATES.executedObjectivesNote[0],
      childrenInterestNote: EVAL_TEMPLATES.childrenInterestNote[0],
      advantagesDifficultiesNote: EVAL_TEMPLATES.advantagesDifficultiesNote[0],
      nextThemeAdjustmentNote: EVAL_TEMPLATES.nextThemeAdjustmentNote[0],
      evaluations: initEvals,
      studentNotes: {},
      updatedAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    if (existingAssessment) {
      const mergedMt = Array.from(new Set([...existingAssessment.mtCodes, ...collectedMtCodes]));
      setDraftAssessment({
        ...existingAssessment,
        className: plan.className,
        schoolName: plan.schoolName,
        teacherName: plan.teacherName,
        principalName: plan.principalName,
        mtCodes: mergedMt,
        studentNotes: existingAssessment.studentNotes || {},
      });
    } else {
      const annualTheme = annualPlan.themes.find(
        (t) => t.themeName.trim().toLowerCase() === selectedThemeName.trim().toLowerCase()
      );
      const initEvals: Record<string, Record<string, MtEvalLevel>> = {};
      students.forEach((st) => {
        initEvals[st.id] = {};
        collectedMtCodes.forEach((c) => {
          initEvals[st.id][c] = 'ACHIEVED';
        });
      });
      setDraftAssessment({
        id: assessmentId,
        ageGroupId: plan.ageGroupId,
        className: plan.className,
        schoolName: plan.schoolName,
        teacherName: plan.teacherName,
        principalName: plan.principalName,
        schoolYear: plan.schoolYear,
        themeName: selectedThemeName,
        durationText: annualTheme
          ? `${annualTheme.monthLabel} (${annualTheme.totalWeeks} tuần)`
          : `${fmtDateVN(plan.themeStartDate)} – ${fmtDateVN(plan.themeEndDate)}`,
        mtCodes: collectedMtCodes,
        executedObjectivesNote: EVAL_TEMPLATES.executedObjectivesNote[0],
        childrenInterestNote: EVAL_TEMPLATES.childrenInterestNote[0],
        advantagesDifficultiesNote: EVAL_TEMPLATES.advantagesDifficultiesNote[0],
        nextThemeAdjustmentNote: EVAL_TEMPLATES.nextThemeAdjustmentNote[0],
        evaluations: initEvals,
        studentNotes: {},
        updatedAt: new Date().toISOString(),
      });
    }
  }, [assessmentId, existingAssessment, collectedMtCodes, students, plan, selectedThemeName, annualPlan.themes]);

  const persistAssessment = (next: ThemeAssessmentDocument, silent = true) => {
    setDraftAssessment(next);
    void onSaveAssessment(next, silent);
  };

  // Xoay vòng 3 trạng thái chuẩn GoKids (YC-040): Đạt ✓ -> Chưa đạt △ -> Không ĐG — -> Đạt ✓
  const toggleCell = (studentId: string, mtCode: string) => {
    const cur = draftAssessment.evaluations?.[studentId]?.[mtCode] || 'ACHIEVED';
    const nextLv: MtEvalLevel =
      cur === 'ACHIEVED'
        ? 'NEEDS_SUPPORT'
        : cur === 'NEEDS_SUPPORT'
        ? 'NOT_EVALUATED'
        : 'ACHIEVED';
    const nextEvals = {
      ...draftAssessment.evaluations,
      [studentId]: {
        ...(draftAssessment.evaluations?.[studentId] || {}),
        [mtCode]: nextLv,
      },
    };
    persistAssessment({ ...draftAssessment, evaluations: nextEvals });
  };

  const updateStudentNote = (studentId: string, note: string) => {
    persistAssessment({
      ...draftAssessment,
      studentNotes: {
        ...(draftAssessment.studentNotes || {}),
        [studentId]: note,
      },
    });
  };

  const markAllAchieved = () => {
    const nextEvals: Record<string, Record<string, MtEvalLevel>> = {};
    students.forEach((st) => {
      nextEvals[st.id] = {};
      draftAssessment.mtCodes.forEach((c) => {
        nextEvals[st.id][c] = 'ACHIEVED';
      });
    });
    persistAssessment({ ...draftAssessment, evaluations: nextEvals }, false);
  };

  // --- SUB-TAB 0: ĐÁNH GIÁ TRẺ HÀNG NGÀY -> ĐỒNG BỘ SANG CUỐI CHỦ ĐỀ / THÁNG (YC-052) ---
  const activeDailyDay = plan.days[selectedDayIdx] || plan.days[0];
  const dayMtsWithTopics = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!activeDailyDay || activeDailyDay.isHoliday) return [];
    activeDailyDay.mainLessons.forEach((les) => {
      les.linkedMtCodes.forEach((code) => {
        if (!map.has(code)) map.set(code, []);
        map.get(code)!.push(`[${les.subjectCode}] ${les.topicTitle}`);
      });
    });
    activeDailyDay.afternoonLesson?.linkedMtCodes.forEach((code) => {
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(`[Chiều] ${activeDailyDay.afternoonLesson?.topicTitle || ''}`);
    });
    return Array.from(map.entries()).map(([code, topics]) => ({
      code,
      obj: objByCode.get(code),
      topics,
    }));
  }, [activeDailyDay, objByCode]);

  const toggleDailyCell = (studentId: string, mtCode: string) => {
    const cur = activeDailyDay.dailyEvaluations?.[studentId]?.[mtCode] || 'ACHIEVED';
    const nextLv: MtEvalLevel =
      cur === 'ACHIEVED'
        ? 'NEEDS_SUPPORT'
        : cur === 'NEEDS_SUPPORT'
        ? 'NOT_EVALUATED'
        : 'ACHIEVED';
    const nextDays = plan.days.map((d, idx) => {
      if (idx !== selectedDayIdx) return d;
      return {
        ...d,
        dailyEvaluations: {
          ...(d.dailyEvaluations || {}),
          [studentId]: {
            ...(d.dailyEvaluations?.[studentId] || {}),
            [mtCode]: nextLv,
          },
        },
      };
    });
    onUpdatePlan({ ...plan, days: nextDays });
  };

  // Đồng bộ toàn bộ kết quả Đánh giá trẻ hàng ngày trong Chủ đề sang Bảng Cuối Chủ đề / Tháng + gắn ngày đánh giá!
  const handleSyncFromDailyEvaluations = () => {
    const matchingWeeks = allPlans
      .filter(
        (p) =>
          p.ageGroupId === plan.ageGroupId &&
          p.themeName.trim().toLowerCase() === selectedThemeName.trim().toLowerCase()
      )
      .map((p) => (p.id === plan.id ? plan : p));

    const nextEvals: Record<string, Record<string, MtEvalLevel>> = JSON.parse(
      JSON.stringify(draftAssessment.evaluations || {})
    );
    const nextDates: Record<string, Record<string, string>> = JSON.parse(
      JSON.stringify(draftAssessment.evalDates || {})
    );
    const extraMts = new Set<string>(draftAssessment.mtCodes);
    let syncedDaysCount = 0;

    matchingWeeks.forEach((wp) => {
      wp.days.forEach((d) => {
        if (d.isHoliday) return;
        const dayCodes = new Set<string>();
        d.mainLessons.forEach((l) => l.linkedMtCodes.forEach((c) => dayCodes.add(c)));
        d.afternoonLesson?.linkedMtCodes.forEach((c) => dayCodes.add(c));
        if (dayCodes.size === 0) return;

        syncedDaysCount += 1;
        const vnDate = fmtDateVN(d.dateStr);
        dayCodes.forEach((code) => {
          extraMts.add(code);
          students.forEach((st) => {
            if (!nextEvals[st.id]) nextEvals[st.id] = {};
            if (!nextDates[st.id]) nextDates[st.id] = {};
            const dayLv = d.dailyEvaluations?.[st.id]?.[code] || 'ACHIEVED';
            nextEvals[st.id][code] = dayLv;
            nextDates[st.id][code] = vnDate;
          });
        });
      });
    });

    persistAssessment(
      {
        ...draftAssessment,
        mtCodes: Array.from(extraMts),
        evaluations: nextEvals,
        evalDates: nextDates,
      },
      false
    );
    setSubTab('assessment');
    onNotify(
      `Đã đồng bộ đánh giá hàng ngày (${syncedDaysCount} ngày có MT) sang Bảng Cuối Chủ đề kèm ngày đánh giá!`
    );
  };

  // Thống kê tổng hợp đạt MT (tính chuẩn trên số ô ĐƯỢC ĐÁNH GIÁ, không kéo tụt bởi Không ĐG!)
  const stats = useMemo(() => {
    const mtCodes = draftAssessment.mtCodes || [];
    if (students.length === 0 || mtCodes.length === 0) {
      return {
        avgPct: 100,
        notEvalCells: 0,
        supportStudents: [] as Array<{ name: string; codes: string[] }>,
      };
    }
    let evaluatedCells = 0;
    let passCells = 0;
    let notEvalCells = 0;
    const supportStudents: Array<{ name: string; codes: string[] }> = [];

    students.forEach((st) => {
      const missed: string[] = [];
      mtCodes.forEach((c) => {
        const lv = draftAssessment.evaluations?.[st.id]?.[c] || 'ACHIEVED';
        if (lv === 'NOT_EVALUATED') {
          notEvalCells += 1;
          return;
        }
        evaluatedCells += 1;
        if (lv === 'ACHIEVED') passCells += 1;
        else missed.push(c);
      });
      if (missed.length > 0) {
        supportStudents.push({ name: st.fullName, codes: missed });
      }
    });

    return {
      avgPct: evaluatedCells > 0 ? Math.round((passCells / evaluatedCells) * 100) : 100,
      notEvalCells,
      supportStudents,
    };
  }, [draftAssessment, students]);

  const handleExportDocx = async (kind: 'summary' | 'individual') => {
    setExportingDocx(kind);
    try {
      await onSaveAssessment(draftAssessment, true);
      const url =
        kind === 'summary'
          ? '/api/export/theme-assessment-docx'
          : '/api/export/individual-assessments-docx';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment: draftAssessment, students }),
      });
      if (!res.ok) {
        onNotify('Có lỗi khi tạo file Word đánh giá (.docx)');
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download =
        kind === 'summary'
          ? `PhieuDanhGiaChuDe_${plan.className.replace(/\s+/g, '')}_${selectedThemeName.replace(/\s+/g, '_')}.docx`
          : `PhieuCaNhanTungTre_${plan.className.replace(/\s+/g, '')}_${selectedThemeName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      onNotify(
        kind === 'summary'
          ? 'Đã xuất Phiếu Tổng hợp Đánh giá Chủ đề (.docx)!'
          : `Đã xuất Phiếu Đánh giá cá nhân cho ${students.length} trẻ (.docx)!`
      );
    } finally {
      setExportingDocx(null);
    }
  };

  // --- SUB-TAB 3: TỔNG HỢP ĐÁNH GIÁ CUỐI ĐỘ TUỔI (CẢ NĂM — YC-042) ---
  const gradeAssessments = useMemo(() => {
    const map = new Map<string, ThemeAssessmentDocument>();
    assessments
      .filter((a) => a.ageGroupId === plan.ageGroupId)
      .forEach((a) => map.set(a.id, a));
    // Luôn bao gồm bản nháp đang thao tác ở sub-tab 1
    if (draftAssessment.mtCodes.length > 0) {
      map.set(draftAssessment.id, draftAssessment);
    }
    return Array.from(map.values());
  }, [assessments, plan.ageGroupId, draftAssessment]);

  const yearEndSummary = useMemo(() => {
    const allMtSet = new Set<string>();
    gradeAssessments.forEach((a) => a.mtCodes.forEach((c) => allMtSet.add(c)));
    const allMts = Array.from(allMtSet).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });

    const rows = students.map((st) => {
      const finalByMt: Record<string, MtEvalLevel> = {};
      // Tổng hợp theo thứ tự: nếu trẻ đã đạt ở chủ đề gần nhất hoặc bất kỳ lần đánh giá nào -> ACHIEVED
      allMts.forEach((code) => {
        let state: MtEvalLevel = 'NOT_EVALUATED';
        for (const doc of gradeAssessments) {
          if (!doc.mtCodes.includes(code)) continue;
          const lv = doc.evaluations?.[st.id]?.[code] || 'ACHIEVED';
          if (lv === 'ACHIEVED') {
            state = 'ACHIEVED';
            break;
          }
          if (lv === 'NEEDS_SUPPORT') {
            state = 'NEEDS_SUPPORT';
          }
        }
        finalByMt[code] = state;
      });

      let pass = 0;
      let evalTotal = 0;
      const needSupportCodes: string[] = [];
      allMts.forEach((code) => {
        const lv = finalByMt[code];
        if (lv === 'NOT_EVALUATED') return;
        evalTotal += 1;
        if (lv === 'ACHIEVED') pass += 1;
        else needSupportCodes.push(code);
      });

      return {
        student: st,
        pass,
        evalTotal,
        pct: evalTotal > 0 ? Math.round((pass / evalTotal) * 100) : 100,
        needSupportCodes,
      };
    });

    const avgYearPct =
      rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 100;

    return { allMts, rows, avgYearPct };
  }, [gradeAssessments, students]);

  const handleSyncYearEnd = async () => {
    await onSaveAssessment(draftAssessment, true);
    const now = new Date();
    setYearEndSyncedAt(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    );
    onNotify(
      `Đã đồng bộ đánh giá cuối độ tuổi từ ${gradeAssessments.length} chủ đề (${yearEndSummary.allMts.length} mã MT)!`
    );
  };

  // --- LUỒNG TRÌNH KÝ & PHÊ DUYỆT BGH ---
  const comments = plan.reviewComments || [];
  const unresolvedCount = comments.filter((c) => !c.resolved).length;
  const unapprovedGradePlans = useMemo(
    () => allPlans.filter((p) => p.ageGroupId === plan.ageGroupId && p.status !== 'APPROVED'),
    [allPlans, plan.ageGroupId]
  );

  const handleSubmitForReview = () => {
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    onUpdatePlan(
      { ...plan, status: 'PENDING_REVIEW', submittedAt: stamp },
      'Đã gửi Kế hoạch tuần lên Tổ trưởng / Ban Giám hiệu duyệt!'
    );
  };

  const handleApproveOnline = () => {
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    onUpdatePlan(
      {
        ...plan,
        status: 'APPROVED',
        approvedBy: approverInput.trim() || plan.principalName || 'Ban Giám hiệu',
        approvedAt: stamp,
        hasManualFullDocEdits: false,
      },
      `Đã ký duyệt trực tuyến Kế hoạch Tuần ${plan.weekNumber}!`
    );
  };

  const handleBulkApproveAll = async () => {
    if (unapprovedGradePlans.length === 0) return;
    setBulkApproving(true);
    try {
      await onBulkApprovePlans(
        unapprovedGradePlans.map((p) => p.id),
        approverInput.trim() || plan.principalName || 'Ban Giám hiệu'
      );
    } finally {
      setBulkApproving(false);
    }
  };

  const handleRequestRevision = () => {
    onUpdatePlan(
      { ...plan, status: 'NEEDS_REVISION' },
      'Đã chuyển trạng thái sang "Cần chỉnh sửa theo góp ý"!'
    );
  };

  const handleRevokeApproval = () => {
    onUpdatePlan(
      { ...plan, status: 'DRAFT', approvedAt: undefined, approvedBy: undefined },
      'Đã mở khóa bản nháp để chỉnh sửa lại.'
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const now = new Date();
    const createdAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const item: ReviewComment = {
      id: `cmt_${Date.now()}`,
      authorRole: activeRole === 'BGH' ? 'PRINCIPAL' : 'TEACHER',
      authorName:
        activeRole === 'BGH'
          ? approverInput.trim() || plan.principalName || 'Tổ trưởng / BGH'
          : plan.teacherName || 'Giáo viên lớp',
      targetSection: commentSection,
      content: commentText.trim(),
      createdAt,
      resolved: false,
    };
    setCommentText('');
    onUpdatePlan(
      {
        ...plan,
        reviewComments: [item, ...comments],
        status:
          activeRole === 'BGH' && plan.status === 'PENDING_REVIEW'
            ? 'NEEDS_REVISION'
            : plan.status,
      },
      `Đã gắn góp ý vào mục "${commentSection}"!`
    );
  };

  const toggleResolveComment = (id: string) => {
    const next = comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c));
    onUpdatePlan({ ...plan, reviewComments: next });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F6F8F7] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Clean 4-Subtab Switcher (3-Tier Child Assessment + BGH Approval) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setSubTab('daily')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                subTab === 'daily'
                  ? 'bg-[#0B6E5C] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              1. Đánh giá Hàng ngày
            </button>
            <button
              onClick={() => setSubTab('assessment')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                subTab === 'assessment'
                  ? 'bg-[#0B6E5C] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              2. Cuối Chủ đề / Tháng
            </button>
            <button
              onClick={() => setSubTab('yearEnd')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                subTab === 'yearEnd'
                  ? 'bg-[#0B6E5C] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              3. Cuối Độ tuổi (Năm)
            </button>
            <button
              onClick={() => setSubTab('approval')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                subTab === 'approval'
                  ? 'bg-[#0B6E5C] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span>4. Trình ký &amp; Duyệt BGH</span>
              {unresolvedCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unresolvedCount}
                </span>
              )}
              {plan.status === 'APPROVED' && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Đã ký
                </span>
              )}
            </button>
          </div>

          {subTab === 'daily' ? (
            <button
              onClick={handleSyncFromDailyEvaluations}
              className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
            >
              Đồng bộ sang Cuối Chủ đề / Tháng →
            </button>
          ) : subTab === 'assessment' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExportDocx('individual')}
                disabled={exportingDocx !== null}
                className="rounded-xl border border-emerald-200 bg-[#F2F9F7] px-3.5 py-2 text-xs font-bold text-[#0B6E5C] transition hover:bg-[#E6F4F1] disabled:opacity-60"
              >
                {exportingDocx === 'individual' ? 'Đang xuất...' : 'Xuất Phiếu từng trẻ (.docx)'}
              </button>
              <button
                onClick={() => handleExportDocx('summary')}
                disabled={exportingDocx !== null}
                className="rounded-xl bg-[#0B6E5C] px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#085A4B] disabled:opacity-60"
              >
                {exportingDocx === 'summary' ? 'Đang xuất...' : 'Xuất Tổng hợp Chủ đề (.docx)'}
              </button>
            </div>
          ) : subTab === 'yearEnd' ? (
            <button
              onClick={handleSyncYearEnd}
              className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
            >
              Đồng bộ từ tất cả Chủ đề / Tháng
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <span className="px-2 font-medium text-slate-500">Góc nhìn:</span>
              <button
                onClick={() => setActiveRole('TEACHER')}
                className={`rounded-lg px-3 py-1 font-bold transition ${
                  activeRole === 'TEACHER'
                    ? 'bg-white text-[#0B6E5C] shadow-2xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Giáo viên lớp
              </button>
              <button
                onClick={() => setActiveRole('BGH')}
                className={`rounded-lg px-3 py-1 font-bold transition ${
                  activeRole === 'BGH'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tổ trưởng / BGH
              </button>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* SUB-TAB 0: ĐÁNH GIÁ TRẺ HÀNG NGÀY (YC-052 — CHUẨN GOKIDS KHUNG #27) */}
        {/* ================================================================= */}
        {subTab === 'daily' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#0B6E5C]">
                    Đánh giá Trẻ Hàng ngày theo Tiết dạy có gắn Mã MT • Tuần {plan.weekNumber}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Những ngày có dấu chấm xanh lá là ngày có tiết dạy gắn Mã MT. Sau khi đánh giá nhanh, bấm{' '}
                    <strong>“Đồng bộ sang Cuối Chủ đề / Tháng”</strong> để tự kéo kết quả kèm ngày đánh giá.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {plan.days.map((d, idx) => {
                  const hasMt =
                    !d.isHoliday &&
                    (d.mainLessons.some((l) => l.linkedMtCodes.length > 0) ||
                      (d.afternoonLesson?.linkedMtCodes.length || 0) > 0);
                  const active = idx === selectedDayIdx;
                  return (
                    <button
                      key={d.dayOfWeek}
                      type="button"
                      onClick={() => setSelectedDayIdx(idx)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                        active
                          ? 'border-[#0B6E5C] bg-[#0B6E5C] text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          hasMt ? (active ? 'bg-emerald-300' : 'bg-emerald-500') : 'bg-slate-300'
                        }`}
                      />
                      <span>
                        {d.dayLabel} ({fmtDateVN(d.dateStr).slice(0, 5)})
                      </span>
                    </button>
                  );
                })}
              </div>

              {dayMtsWithTopics.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  {activeDailyDay?.dayLabel} chưa có tiết dạy nào gắn Mã MT (hoặc là ngày nghỉ Lễ).
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#0B6E5C] text-white">
                        <th className="w-10 border-r border-emerald-700/50 px-2.5 py-2.5 text-center font-bold">
                          STT
                        </th>
                        <th className="min-w-[180px] border-r border-emerald-700/50 px-3 py-2.5 font-bold">
                          Họ và tên trẻ
                        </th>
                        {dayMtsWithTopics.map((m) => (
                          <th
                            key={m.code}
                            className="border-r border-emerald-700/50 px-3 py-2 text-center font-bold last:border-r-0"
                          >
                            <div>
                              {m.code}: {m.obj?.description || ''}
                            </div>
                            <div className="mt-0.5 text-[10px] font-normal text-emerald-100">
                              {m.topics.join(' · ')}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {students.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50/70">
                          <td className="border-r border-slate-100 px-2.5 py-2 text-center text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-900">
                            {st.fullName}
                          </td>
                          {dayMtsWithTopics.map((m) => {
                            const lv =
                              activeDailyDay.dailyEvaluations?.[st.id]?.[m.code] || 'ACHIEVED';
                            return (
                              <td
                                key={m.code}
                                className="border-r border-slate-100 p-1.5 text-center last:border-r-0"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleDailyCell(st.id, m.code)}
                                  className={`inline-flex min-w-[96px] items-center justify-center rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                                    lv === 'ACHIEVED'
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : lv === 'NEEDS_SUPPORT'
                                      ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {lv === 'ACHIEVED'
                                    ? 'Đạt ✓'
                                    : lv === 'NEEDS_SUPPORT'
                                    ? 'Chưa đạt △'
                                    : 'Vắng / Miễn'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 1: BẢNG ĐÁNH GIÁ TRẺ CUỐI CHỦ ĐỀ (3 TRẠNG THÁI + GHI CHÚ) */}
        {/* ================================================================= */}
        {subTab === 'assessment' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#0B6E5C]">
                    Hồ sơ Đánh giá Sự phát triển của trẻ cuối chủ đề • Lớp {plan.className}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">Chọn Chủ đề đánh giá:</span>
                    <select
                      value={selectedThemeName}
                      onChange={(e) => setSelectedThemeName(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-[#0B6E5C] focus:outline-none"
                    >
                      {availableThemes.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={onGoToAnnualRoster}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#0B6E5C] hover:bg-white hover:text-[#0B6E5C]"
                  >
                    Danh sách trẻ ({students.length} bé)
                  </button>
                  <button
                    onClick={handleSyncFromDailyEvaluations}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    Đồng bộ từ đánh giá ngày
                  </button>
                  <button
                    onClick={markAllAchieved}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    Đánh dấu tất cả Đạt ✓
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="text-[11px] font-medium text-slate-500">Sĩ số trẻ đánh giá</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{students.length} trẻ</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="text-[11px] font-medium text-slate-500">Số Mã MT trong chủ đề</div>
                  <div className="mt-1 text-xl font-bold text-[#0B6E5C]">
                    {draftAssessment.mtCodes.length} mục tiêu
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <div className="text-[11px] font-medium text-emerald-800">Tỷ lệ Đạt (trên trẻ có ĐG)</div>
                  <div className="mt-1 text-xl font-bold text-emerald-700">{stats.avgPct}%</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <div className="text-[11px] font-medium text-amber-900">Trẻ cần rèn / Miễn ĐG</div>
                  <div className="mt-1 text-xl font-bold text-amber-700">
                    {stats.supportStudents.length} trẻ
                    {stats.notEvalCells > 0 && (
                      <span className="ml-1.5 text-xs font-semibold text-slate-500">
                        ({stats.notEvalCells} ô miễn)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section I: Nhận xét chung */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  I. Đánh giá chung việc thực hiện Chủ đề của lớp
                </h3>
                <span className="text-[11px] text-slate-400">Tự động lưu khi nhập</span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(
                  [
                    { key: 'executedObjectivesNote', label: '1. Về mục tiêu của chủ đề' },
                    { key: 'childrenInterestNote', label: '2. Về nội dung & hứng thú tham gia của trẻ' },
                    { key: 'advantagesDifficultiesNote', label: '3. Thuận lợi & khó khăn thực tế' },
                    { key: 'nextThemeAdjustmentNote', label: '4. Phương hướng điều chỉnh chủ đề kế tiếp' },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700">{field.label}</label>
                      <button
                        type="button"
                        onClick={() => {
                          const samples = EVAL_TEMPLATES[field.key];
                          const nextSample =
                            draftAssessment[field.key] === samples[0] ? samples[1] : samples[0];
                          persistAssessment({ ...draftAssessment, [field.key]: nextSample });
                        }}
                        className="text-[11px] font-semibold text-[#0B6E5C] hover:underline"
                      >
                        Đổi câu mẫu gợi ý
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={draftAssessment[field.key]}
                      onChange={(e) =>
                        persistAssessment({ ...draftAssessment, [field.key]: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-xs leading-relaxed text-slate-800 focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Section II: Bảng ma trận Trẻ × Mã MT (3 trạng thái + Ghi chú riêng từng trẻ) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  II. Bảng đánh giá nhanh từng trẻ theo Mã MT (3 trạng thái chuẩn GoKids)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Bấm từng ô để chuyển vòng 3 mức:{' '}
                  <strong className="text-emerald-700">Đạt ✓ (+)</strong> →{' '}
                  <strong className="text-amber-700">Rèn △ (-)</strong> →{' '}
                  <strong className="text-slate-500">Không ĐG —</strong> (dùng khi trẻ nghỉ ốm dài ngày, không làm sai % lớp).
                </p>
              </div>

              {draftAssessment.mtCodes.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  Chủ đề này chưa có mã MT nào được gắn.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#0B6E5C] text-white">
                        <th className="w-10 border-r border-emerald-700/50 px-2 py-2.5 text-center font-bold">
                          STT
                        </th>
                        <th className="sticky left-0 z-10 min-w-[165px] border-r border-emerald-700/50 bg-[#0B6E5C] px-3 py-2.5 font-bold">
                          Họ và tên trẻ
                        </th>
                        {draftAssessment.mtCodes.map((code) => {
                          const o = objByCode.get(code);
                          return (
                            <th
                              key={code}
                              title={o ? `${code} (${o.domain}): ${o.description}` : code}
                              className="min-w-[74px] cursor-help border-r border-emerald-700/50 px-2 py-2 text-center font-bold"
                            >
                              <div>{code}</div>
                              {o && (
                                <div className="mt-0.5 max-w-[82px] truncate text-[9px] font-normal text-emerald-100">
                                  {o.description}
                                </div>
                              )}
                            </th>
                          );
                        })}
                        <th className="min-w-[72px] border-r border-emerald-700/50 px-2 py-2.5 text-center font-bold">
                          Tổng Đạt
                        </th>
                        <th className="min-w-[180px] px-3 py-2.5 font-bold">
                          Ghi chú riêng từng trẻ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {students.map((st, idx) => {
                        let passCount = 0;
                        let evalCount = 0;
                        draftAssessment.mtCodes.forEach((c) => {
                          const lv = draftAssessment.evaluations?.[st.id]?.[c] || 'ACHIEVED';
                          if (lv !== 'NOT_EVALUATED') evalCount += 1;
                          if (lv === 'ACHIEVED') passCount += 1;
                        });
                        return (
                          <tr key={st.id} className="hover:bg-slate-50/80">
                            <td className="border-r border-slate-100 px-2 py-2 text-center text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">
                              <div>{st.fullName}</div>
                              {st.dob && (
                                <div className="text-[10px] font-normal text-slate-400">{st.dob}</div>
                              )}
                            </td>
                            {draftAssessment.mtCodes.map((code) => {
                              const lv = draftAssessment.evaluations?.[st.id]?.[code] || 'ACHIEVED';
                              const evDate = draftAssessment.evalDates?.[st.id]?.[code];
                              return (
                                <td key={code} className="border-r border-slate-100 p-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleCell(st.id, code)}
                                    title="Bấm để chuyển vòng: Đạt ✓ → Rèn △ → Không ĐG —"
                                    className={`inline-flex w-full flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                                      lv === 'ACHIEVED'
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : lv === 'NEEDS_SUPPORT'
                                        ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span>
                                      {lv === 'ACHIEVED'
                                        ? 'Đạt ✓'
                                        : lv === 'NEEDS_SUPPORT'
                                        ? 'Rèn △'
                                        : 'Không ĐG'}
                                    </span>
                                    {evDate && (
                                      <span className="mt-0.5 rounded bg-amber-50/90 px-1 text-[9px] font-medium text-amber-800">
                                        {evDate.slice(0, 5)}
                                      </span>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="border-r border-slate-100 px-2 py-2 text-center font-bold text-slate-700">
                              {passCount}/{evalCount}
                            </td>
                            <td className="p-1.5">
                              <input
                                value={draftAssessment.studentNotes?.[st.id] ?? st.note ?? ''}
                                onChange={(e) => updateStudentNote(st.id, e.target.value)}
                                placeholder="Nhận xét riêng cho bé..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-[11px] text-slate-700 focus:border-[#0B6E5C] focus:bg-white focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="font-bold text-slate-800">
                  Tổng hợp tự động phục vụ điều chỉnh kế hoạch góc chơi &amp; hoạt động chiều tuần tới:
                </div>
                {stats.supportStudents.length === 0 ? (
                  <p className="mt-1 text-emerald-700">
                    ✓ 100% trẻ được đánh giá trong lớp đạt đầy đủ các mục tiêu của chủ đề{' '}
                    <strong>{selectedThemeName}</strong>.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-slate-700">
                    {stats.supportStudents.map((item) => (
                      <li key={item.name}>
                        • Bé <strong>{item.name}</strong> cần hỗ trợ rèn thêm ở mục tiêu:{' '}
                        <span className="font-bold text-amber-800">{item.codes.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 2: TỔNG HỢP ĐÁNH GIÁ CUỐI ĐỘ TUỔI (CẢ NĂM — YC-042)      */}
        {/* ================================================================= */}
        {subTab === 'yearEnd' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#0B6E5C]">
                    Tổng hợp Đánh giá Cuối độ tuổi (Cả năm học {plan.schoolYear}) • Lớp {plan.className}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Tự động tổng hợp kết quả từ <strong>{gradeAssessments.length} chủ đề / tháng</strong> đã đánh giá (giống chức năng <em>Đồng bộ đánh giá cuối tháng → cuối độ tuổi</em> của GoKids — không phải chấm lại từ đầu cuối năm).
                  </p>
                </div>
                {yearEndSyncedAt && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    ✓ Đã đồng bộ lúc {yearEndSyncedAt}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Số Chủ đề/Tháng đã có dữ liệu</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{gradeAssessments.length} chủ đề</div>
                </div>
                <div className="rounded-xl bg-[#F2F9F7] p-3">
                  <div className="text-[11px] text-[#074F42]">Tổng Mã MT đã đánh giá trong năm</div>
                  <div className="mt-1 text-xl font-bold text-[#0B6E5C]">
                    {yearEndSummary.allMts.length} / {gradeObjectives.length} MT
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-3">
                  <div className="text-[11px] text-emerald-800">Tỷ lệ Đạt trung bình cả năm</div>
                  <div className="mt-1 text-xl font-bold text-emerald-700">{yearEndSummary.avgYearPct}%</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#0B6E5C] text-white">
                      <th className="w-10 px-3 py-2.5 text-center font-bold">STT</th>
                      <th className="px-3 py-2.5 font-bold">Họ và tên trẻ</th>
                      <th className="px-3 py-2.5 text-center font-bold">Số MT Đạt / Đã ĐG</th>
                      <th className="px-3 py-2.5 text-center font-bold">Tỷ lệ Đạt cả năm</th>
                      <th className="px-3 py-2.5 font-bold">Các MT cần tiếp tục theo dõi cuối năm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {yearEndSummary.rows.map((r, idx) => (
                      <tr key={r.student.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {r.student.fullName}
                          {r.student.dob && (
                            <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                              ({r.student.dob})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-700">
                          {r.pass} / {r.evalTotal}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              r.pct >= 90
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.pct >= 75
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.needSupportCodes.length === 0 ? (
                            <span className="font-semibold text-emerald-700">
                              ✓ Đạt tốt tất cả các mục tiêu đã đánh giá
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-800">
                              {r.needSupportCodes.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 3: TRÌNH KÝ & PHÊ DUYỆT BGH + DUYỆT HÀNG LOẠT (YC-043)   */}
        {/* ================================================================= */}
        {subTab === 'approval' && (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Trạng thái Hồ sơ Giáo án Tuần {plan.weekNumber}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">Tình trạng hiện tại:</span>
                    {plan.status === 'APPROVED' ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        ✓ Đã phê duyệt trực tuyến
                      </span>
                    ) : plan.status === 'PENDING_REVIEW' ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Đang chờ Tổ trưởng / BGH duyệt
                      </span>
                    ) : plan.status === 'NEEDS_REVISION' ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                        Cần chỉnh sửa theo góp ý
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                        Bản nháp đang soạn
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div>
                      • Giáo viên phụ trách: <strong>{plan.teacherName}</strong> ({plan.className})
                    </div>
                    <div>
                      • Chủ đề nhánh: <strong>{plan.subThemeName}</strong>
                    </div>
                    {plan.submittedAt && (
                      <div>
                        • Thời gian gửi duyệt: <strong>{plan.submittedAt}</strong>
                      </div>
                    )}
                  </div>

                  {plan.status === 'APPROVED' && (
                    <div className="mt-4 rounded-xl border-2 border-emerald-600/70 bg-emerald-50/80 p-3 text-center">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                        ✓ ĐÃ PHÊ DUYỆT TRỰC TUYẾN
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-900">
                        Người ký duyệt: {plan.approvedBy || plan.principalName}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Thời gian ký: {plan.approvedAt}
                      </div>
                      <button
                        type="button"
                        onClick={onGoToPreview}
                        className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-[#0B6E5C] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#085A4B]"
                      >
                        Xem con dấu trên trang A4 (Bước 4) →
                      </button>
                    </div>
                  )}
                </div>

                {activeRole === 'TEACHER' ? (
                  <div className="mt-4 space-y-2.5">
                    <div className="text-xs text-slate-600">
                      Sau khi hoàn thiện lịch tuần và nội dung các tiết học, cô bấm nút dưới đây để nộp sổ trực tuyến lên Tổ chuyên môn / Ban Giám hiệu:
                    </div>
                    {plan.status !== 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={handleSubmitForReview}
                        className="w-full rounded-xl bg-[#0B6E5C] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#085A4B]"
                      >
                        {plan.status === 'PENDING_REVIEW'
                          ? 'Cập nhật & Gửi lại bản mới cho BGH'
                          : 'Nộp Kế hoạch tuần lên Tổ trưởng / BGH duyệt'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRevokeApproval}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mở khóa bản nháp để điều chỉnh bổ sung
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
                    <div className="text-xs font-bold text-amber-900">
                      Thao tác dành cho Tổ trưởng chuyên môn / Ban Giám hiệu
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">
                        Họ tên &amp; chức vụ người ký duyệt (in vào ô Ký duyệt cuối trang A4):
                      </label>
                      <input
                        value={approverInput}
                        onChange={(e) => setApproverInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#0B6E5C] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleApproveOnline}
                        className="rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        Phê duyệt &amp; Ký số
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestRevision}
                        className="rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Yêu cầu chỉnh sửa
                      </button>
                    </div>

                    {unapprovedGradePlans.length > 0 && (
                      <div className="border-t border-amber-200/80 pt-3">
                        <div className="text-[11px] text-amber-950">
                          Có <strong>{unapprovedGradePlans.length} giáo án tuần</strong> của khối này chưa ký duyệt:
                        </div>
                        <button
                          type="button"
                          disabled={bulkApproving}
                          onClick={handleBulkApproveAll}
                          className="mt-2 w-full rounded-xl border border-emerald-600 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          {bulkApproving
                            ? 'Đang ký duyệt hàng loạt...'
                            : `Ký duyệt hàng loạt tất cả (${unapprovedGradePlans.length} tuần)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900">
                  Nhận xét chuyên môn &amp; Phản hồi gắn theo từng mục
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tổ trưởng / BGH chọn đúng ngày hoặc mục cần góp ý; giáo viên bấm{' '}
                  <strong>“Mở sửa ngay →”</strong> để nhảy thẳng tới phần đó và báo lại BGH khi sửa xong.
                </p>

                <form
                  onSubmit={handleAddComment}
                  className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">Mục nhận xét:</label>
                    <select
                      value={commentSection}
                      onChange={(e) => setCommentSection(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#0B6E5C] focus:outline-none"
                    >
                      {TARGET_SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REVIEW_COMMENTS.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCommentText(sample)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-[#0B6E5C] hover:text-[#0B6E5C]"
                      >
                        + {sample.slice(0, 44)}...
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        activeRole === 'BGH'
                          ? 'Nhập nhận xét chuyên môn của Tổ trưởng / BGH...'
                          : 'Nhập ghi chú giải trình hoặc trao đổi của giáo viên...'
                      }
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0B6E5C] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-bold text-white hover:bg-[#085A4B]"
                    >
                      Gửi góp ý
                    </button>
                  </div>
                </form>

                <div className="mt-4 space-y-2.5">
                  {comments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                      Chưa có nhận xét nào cho Kế hoạch Tuần {plan.weekNumber}.
                    </div>
                  ) : (
                    comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        className={`rounded-xl border p-3.5 text-xs transition ${
                          cmt.resolved
                            ? 'border-slate-200 bg-slate-50/70 opacity-75'
                            : cmt.authorRole !== 'TEACHER'
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-emerald-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                cmt.authorRole !== 'TEACHER'
                                  ? 'bg-amber-200/80 text-amber-950'
                                  : 'bg-[#E6F4F1] text-[#0B6E5C]'
                              }`}
                            >
                              {cmt.authorRole !== 'TEACHER' ? 'Tổ trưởng / BGH' : 'Giáo viên'}:{' '}
                              {cmt.authorName}
                            </span>
                            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              Mục: {cmt.targetSection}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">{cmt.createdAt}</span>
                        </div>

                        <p className="mt-2 leading-relaxed text-slate-800">{cmt.content}</p>

                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2">
                          <button
                            type="button"
                            onClick={() => onJumpToSection(cmt.targetSection)}
                            className="font-bold text-[#0B6E5C] hover:underline"
                          >
                            Mở sửa mục “{cmt.targetSection}” ngay →
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleResolveComment(cmt.id)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                              cmt.resolved
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                            }`}
                          >
                            {cmt.resolved ? 'Đã xử lý xong' : 'Đánh dấu đã xử lý'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
