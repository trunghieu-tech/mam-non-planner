import type {
  AgeGroupId,
  DayPlan,
  DomainKey,
  LessonPlan,
  ObjectiveItem,
  WeeklyPlanDocument,
} from '../../shared/types';
import { buildThemeOutdoorObservations } from './themeRelevance';

export function normVN(str: string): string {
  return (str || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function fmtDateVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function addDaysISO(iso: string, days: number): string {
  const dt = new Date(iso + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return iso;
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function syncWeekDates(plan: WeeklyPlanDocument, mondayIso: string): WeeklyPlanDocument {
  const fridayIso = addDaysISO(mondayIso, 4);
  const updatedDays: DayPlan[] = plan.days.map((d, idx) => ({
    ...d,
    dateStr: addDaysISO(mondayIso, idx),
  }));
  return {
    ...plan,
    weekStartDate: mondayIso,
    weekEndDate: fridayIso,
    days: updatedDays,
  };
}

export function domainBadgeStyle(domain: string): string {
  const d = normVN(domain);
  if (d.includes('the chat')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (d.includes('nhan thuc')) return 'bg-sky-50 text-sky-800 border-sky-200';
  if (d.includes('ngon ngu')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (d.includes('tinh cam')) return 'bg-rose-50 text-rose-800 border-rose-200';
  if (d.includes('tham my')) return 'bg-violet-50 text-violet-800 border-violet-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function domainToKey(domain: string): DomainKey {
  const d = normVN(domain);
  if (d.includes('the chat')) return 'PTTC';
  if (d.includes('nhan thuc')) return 'PTNT';
  if (d.includes('ngon ngu')) return 'PTNN';
  if (d.includes('tham my')) return 'PTTM';
  return 'PT_TCKNXH';
}

export function inferSubjectFromActivityType(type: string, domain: string): {
  subjectCode: string;
  subjectFullTitle: string;
  domainTitle: string;
} {
  const t = normVN(type);
  const d = normVN(domain);
  if (t.includes('ptvd') || t.includes('the duc') || d.includes('the chat')) {
    return { subjectCode: 'PTVĐ', subjectFullTitle: 'HOẠT ĐỘNG THỂ DỤC GIỜ HỌC', domainTitle: 'LĨNH VỰC PHÁT TRIỂN THỂ CHẤT' };
  }
  if (t.includes('lqvt') || t.includes('toan')) {
    return { subjectCode: 'LQVT', subjectFullTitle: 'HOẠT ĐỘNG LÀM QUEN VỚI TOÁN', domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC' };
  }
  if (t.includes('kpkh') || t.includes('kpxh') || t.includes('steam') || t.includes('nbtn') || t.includes('nbpb') || d.includes('nhan thuc')) {
    return { subjectCode: 'MTXQ', subjectFullTitle: 'HOẠT ĐỘNG KHÁM PHÁ KHOA HỌC / MTXQ', domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC' };
  }
  if (t.includes('lqcc') || t.includes('chu cai')) {
    return { subjectCode: 'LQCC', subjectFullTitle: 'HOẠT ĐỘNG LÀM QUEN CHỮ CÁI', domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ' };
  }
  if (t.includes('lqvh') || t.includes('van hoc') || d.includes('ngon ngu')) {
    return { subjectCode: 'LQVH', subjectFullTitle: 'HOẠT ĐỘNG LÀM QUEN VĂN HỌC', domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ' };
  }
  if (t.includes('am nhac') || t.includes('gdan')) {
    return { subjectCode: 'GDAN', subjectFullTitle: 'HOẠT ĐỘNG ÂM NHẠC', domainTitle: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ' };
  }
  if (t.includes('tao hinh') || d.includes('tham my')) {
    return { subjectCode: 'Tạo hình', subjectFullTitle: 'HOẠT ĐỘNG TẠO HÌNH', domainTitle: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ' };
  }
  return { subjectCode: 'KNS', subjectFullTitle: 'HOẠT ĐỘNG GIÁO DỤC KỸ NĂNG XÃ HỘI', domainTitle: 'LĨNH VỰC PHÁT TRIỂN TÌNH CẢM – XÃ HỘI' };
}

export function buildLessonFromSuggestion(
  topicTitle: string,
  subjectCode: string,
  subjectFullTitle: string,
  domainTitle: string,
  mtCode: string,
  obj?: ObjectiveItem
): LessonPlan {
  return {
    id: `les_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    slotType: 'MAIN',
    domainTitle,
    subjectCode,
    subjectFullTitle,
    topicTitle,
    subTopics: [],
    linkedMtCodes: mtCode ? [mtCode] : [],
    aims: [
      obj ? `Đạt mục tiêu ${obj.code}: ${obj.description}` : `Trẻ nắm được kiến thức trọng tâm của đề tài "${topicTitle}".`,
      obj?.eduContent ? `Rèn kỹ năng: ${obj.eduContent}` : 'Rèn kỹ năng thực hành, quan sát và diễn đạt mạch lạc.',
      'Trẻ hứng thú, tích cực tham gia hoạt động và biết giữ gìn đồ dùng học tập.',
    ],
    preparation: [
      'Đồ dùng trực quan, tranh ảnh / nhạc đệm phù hợp với đề tài.',
      'Đồ dùng thực hành đủ cho mỗi trẻ theo nhóm và cá nhân.',
    ],
    steps: [
      {
        title: 'Hoạt động 1: Ổn định tổ chức – Gây hứng thú',
        details: [
          'Cô cho trẻ hát hoặc chơi trò chơi ngắn gắn với chủ đề tuần để tạo tâm thế hứng thú.',
          `Trò chuyện gợi mở, dẫn dắt giới thiệu đề tài “${topicTitle}”.`,
        ],
      },
      {
        title: 'Hoạt động 2: Nội dung trọng tâm – Trải nghiệm & Thực hành',
        details: [
          'Cô hướng dẫn trực quan / làm mẫu kết hợp đặt câu hỏi gợi mở cho trẻ khám phá.',
          'Tổ chức cho cả lớp, tổ, nhóm và cá nhân trẻ trực tiếp thực hành; cô bao quát hỗ trợ kịp thời.',
        ],
      },
      {
        title: 'Hoạt động 3: Trò chơi củng cố & Kết thúc',
        details: [
          'Tổ chức trò chơi ôn luyện nhẹ nhàng giúp củng cố kiến thức, kỹ năng vừa học.',
          'Cô nhận xét, tuyên dương trẻ và hướng dẫn thu dọn đồ dùng gọn gàng.',
        ],
      },
    ],
  };
}

export interface QualityCheckItem {
  ok: boolean;
  label: string;
  detail: string;
}

export function runQualityChecks(plan: WeeklyPlanDocument): QualityCheckItem[] {
  const allMtSet = new Set<string>();
  for (const b of plan.themeObjectives) for (const c of b.mtCodes) allMtSet.add(c);
  for (const d of plan.days) {
    for (const l of d.mainLessons) for (const c of l.linkedMtCodes) allMtSet.add(c);
    if (d.afternoonLesson) for (const c of d.afternoonLesson.linkedMtCodes) allMtSet.add(c);
  }
  const teachingDays = plan.days.filter((d) => !d.isHoliday);
  const expectedDays = teachingDays.length;
  const daysWithMain = teachingDays.filter((d) => d.mainLessons.length > 0).length;
  const daysWithAft = teachingDays.filter(
    (d) => d.afternoonLesson !== null || d.extracurricularTitle.trim()
  ).length;
  const minAftNeeded = Math.max(0, expectedDays - 1);
  const datesConsistent =
    plan.days.length === 5 &&
    plan.days[0].dateStr === plan.weekStartDate &&
    plan.days[4].dateStr === plan.weekEndDate;

  return [
    {
      ok: Boolean(plan.schoolName && plan.teacherName && plan.principalName && plan.themeName),
      label: 'Thông tin hành chính & Bìa chuẩn BGD',
      detail: `${plan.schoolName} | GV: ${plan.teacherName} | BGH: ${plan.principalName}`,
    },
    {
      ok: datesConsistent,
      label: 'Tính nhất quán ngày tháng (Thứ 2 → Thứ 6)',
      detail: datesConsistent
        ? `Đồng bộ chuẩn từ ${fmtDateVN(plan.weekStartDate)} đến ${fmtDateVN(plan.weekEndDate)}`
        : 'Ngày đầu/cuối tuần chưa khớp danh sách 5 ngày (bấm Đồng bộ ngày ở Tab 1)',
    },
    {
      ok: allMtSet.size >= 5,
      label: 'Độ phủ Mã Mục tiêu (MT) gắn kết',
      detail: `Đã gắn ${allMtSet.size} mã MT chuẩn (${Array.from(allMtSet).slice(0, 8).join(', ')}${allMtSet.size > 8 ? '...' : ''})`,
    },
    {
      ok: plan.morningExercise.moves.length >= 4 && plan.cornerTable.length >= 3 && plan.outdoorTable.length >= 3,
      label: 'Hoạt động cả tuần (Thể dục sáng, Ngoài trời, Góc chơi)',
      detail: `${plan.morningExercise.moves.length} động tác TDS • ${plan.outdoorTable.length} mục HĐNT • ${plan.cornerTable.length} góc chơi`,
    },
    {
      ok: daysWithMain === expectedDays,
      label: `Đủ tiết Hoạt động có chủ đích (${expectedDays} ngày học)`,
      detail: `${daysWithMain}/${expectedDays} ngày học có tiết chính (${plan.days.reduce((s, d) => s + d.mainLessons.length, 0)} tiết tổng cộng)`,
    },
    {
      ok: daysWithAft >= minAftNeeded,
      label: 'Hoạt động chiều & HĐNK',
      detail: `${daysWithAft}/${expectedDays} ngày học đã bố trí hoạt động chiều`,
    },
  ];
}

export function createBlankPlan(opts: {
  ageGroupId: AgeGroupId;
  className: string;
  teacherName: string;
  schoolName: string;
  governingBody: string;
  principalName: string;
  themeName: string;
  subThemeName: string;
  weekNumber: number;
  weekStartDate: string;
}): WeeklyPlanDocument {
  const dayLabels: Array<{ d: 2 | 3 | 4 | 5 | 6; lbl: string }> = [
    { d: 2, lbl: 'Thứ hai' },
    { d: 3, lbl: 'Thứ ba' },
    { d: 4, lbl: 'Thứ tư' },
    { d: 5, lbl: 'Thứ năm' },
    { d: 6, lbl: 'Thứ sáu' },
  ];
  const weekEndDate = addDaysISO(opts.weekStartDate, 4);
  const themeEndDate = addDaysISO(opts.weekStartDate, 18);
  const outdoorByDay = buildThemeOutdoorObservations(opts.subThemeName || opts.themeName);
  const isNhaTre = opts.ageGroupId === 'NHA_TRE_24_36T';
  const cleanSub = opts.subThemeName || opts.themeName;

  return {
    id: `plan_${Date.now()}`,
    status: 'DRAFT',
    updatedAt: new Date().toISOString(),
    governingBody: opts.governingBody || 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
    schoolName: opts.schoolName || 'TRƯỜNG MẦM NON HOÀNG GIA',
    schoolYear: '2026 – 2027',
    ageGroupId: opts.ageGroupId,
    className: opts.className,
    teacherName: opts.teacherName,
    principalName: opts.principalName || 'Nguyễn Thị Thủy',
    themeName: opts.themeName.toUpperCase(),
    themeTotalWeeks: 3,
    themeStartDate: opts.weekStartDate,
    themeEndDate,
    weekNumber: opts.weekNumber,
    subThemeName: cleanSub,
    weekStartDate: opts.weekStartDate,
    weekEndDate,
    includeThemeSection: opts.weekNumber === 1,
    themeObjectives: isNhaTre
      ? [
          { domainKey: 'PTTC', domainTitle: '1. Phát triển thể chất', customGoals: ['Trẻ thực hiện được các động tác thể dục đơn giản và vận động cơ bản cùng cô.'], mtCodes: ['MT1'] },
          { domainKey: 'PTNT', domainTitle: '2. Phát triển nhận thức', customGoals: ['Trẻ nhận biết tên gọi, màu sắc và đặc điểm nổi bật của đồ vật quen thuộc trong chủ đề.'], mtCodes: [] },
          { domainKey: 'PTNN', domainTitle: '3. Phát triển ngôn ngữ', customGoals: ['Trẻ hiểu và nói được từ/câu ngắn rõ ràng, thích nghe cô đọc thơ, kể chuyện.'], mtCodes: [] },
          { domainKey: 'PT_TCKNXH', domainTitle: '4. Phát triển tình cảm, kỹ năng xã hội và thẩm mỹ', customGoals: ['Trẻ biết chào hỏi, chơi thân thiện cùng bạn; thích hát múa, di màu, bóp nặn theo hứng thú.'], mtCodes: [] },
        ]
      : [
          { domainKey: 'PTTC', domainTitle: '1. Phát triển thể chất', customGoals: ['Trẻ thực hiện nhịp nhàng các bài tập phát triển chung và vận động cơ bản.'], mtCodes: ['MT1'] },
          { domainKey: 'PTNT', domainTitle: '2. Phát triển nhận thức', customGoals: ['Trẻ thích tìm hiểu, khám phá sự vật, hiện tượng gần gũi trong chủ đề.'], mtCodes: [] },
          { domainKey: 'PTNN', domainTitle: '3. Phát triển ngôn ngữ', customGoals: ['Trẻ mạnh dạn giao tiếp, đọc thơ, kể chuyện diễn cảm theo chủ đề.'], mtCodes: [] },
          { domainKey: 'PTTM', domainTitle: '4. Phát triển thẩm mỹ', customGoals: ['Trẻ hào hứng ca hát, vận động theo nhạc và tạo ra sản phẩm tạo hình đẹp.'], mtCodes: [] },
          { domainKey: 'PT_TCKNXH', domainTitle: '5. Phát triển tình cảm và kỹ năng xã hội', customGoals: ['Trẻ biết lễ phép, hợp tác vui chơi cùng bạn và giữ gìn đồ dùng đồ chơi.'], mtCodes: [] },
        ],
    contentNetwork: [
      {
        id: 'b1',
        branchTitle: `Tuần ${opts.weekNumber}: ${cleanSub}`,
        items: [
          `Trò chuyện, khám phá đặc điểm nổi bật gắn với “${cleanSub}”`,
          `Hoạt động văn học, âm nhạc và tạo hình theo chủ đề “${cleanSub}”`,
          `Rèn nề nếp vệ sinh, kỹ năng tự phục vụ và vui chơi đoàn kết cùng bạn`,
        ],
      },
      {
        id: 'b2',
        branchTitle: `Tuần ${opts.weekNumber + 1}: Mở rộng chủ đề ${opts.themeName.toLowerCase()}`,
        items: [
          'Khám phá mở rộng các sự vật, hiện tượng quen thuộc trong chủ đề',
          'Thực hành trải nghiệm và tạo hình sáng tạo từ nguyên vật liệu mở',
        ],
      },
      {
        id: 'b3',
        branchTitle: `Tuần ${opts.weekNumber + 2}: Tổng kết & Trải nghiệm chủ đề`,
        items: [
          'Ôn luyện kiến thức, kỹ năng trọng tâm của toàn chủ đề',
          'Trưng bày sản phẩm, biểu diễn văn nghệ và giao lưu cùng bạn bè',
        ],
      },
    ],
    activityNetwork: isNhaTre
      ? [
          { domainKey: 'PTTC', domainTitle: 'PHÁT TRIỂN THỂ CHẤT', items: ['Thể dục sáng đơn giản (2l × 4n), vận động cơ bản, trò chơi vận động nhẹ và tập tự phục vụ'] },
          { domainKey: 'PTNT', domainTitle: 'PHÁT TRIỂN NHẬN THỨC', items: ['Nhận biết tập nói (NBTN), nhận biết phân biệt màu sắc – kích thước cơ bản (NBPB)'] },
          { domainKey: 'PTNN', domainTitle: 'PHÁT TRIỂN NGÔN NGỮ', items: ['Nghe đọc thơ, kể chuyện ngắn có tranh minh họa, trò chuyện gọi tên đồ vật gần gũi'] },
          { domainKey: 'PT_TCKNXH', domainTitle: 'PHÁT TRIỂN TÌNH CẢM, KNXH & THẨM MỸ', items: ['Chơi thao tác vai (bế em, nấu ăn), tập chào hỏi lễ phép; nghe hát, nhún nhảy, di màu và bóp đất nặn'] },
        ]
      : [
          { domainKey: 'PTTC', domainTitle: 'PHÁT TRIỂN THỂ CHẤT', items: ['Thể dục sáng, VĐCB, trò chơi vận động, rèn kỹ năng tự phục vụ'] },
          { domainKey: 'PTNT', domainTitle: 'PHÁT TRIỂN NHẬN THỨC', items: ['Khám phá khoa học/xã hội, làm quen với toán theo chủ đề'] },
          { domainKey: 'PTNN', domainTitle: 'PHÁT TRIỂN NGÔN NGỮ', items: ['Đọc thơ, kể chuyện, trò chuyện sáng, làm quen chữ viết'] },
          { domainKey: 'PTTM', domainTitle: 'PHÁT TRIỂN THẨM MỸ', items: ['Dạy hát, nghe hát, trò chơi âm nhạc, vẽ/nặn/xé dán'] },
          { domainKey: 'PT_TCKNXH', domainTitle: 'PHÁT TRIỂN TÌNH CẢM – XÃ HỘI', items: ['Chơi phân vai, xây dựng, rèn nề nếp lễ giáo và kỹ năng sống'] },
        ],
    weeklyObjectives: isNhaTre
      ? [
          { domainKey: 'PTTC', domainTitle: '1. Phát triển thể chất', goals: ['Tham gia vui vẻ thể dục sáng và vận động cơ bản đơn giản cùng cô.'] },
          { domainKey: 'PTNT', domainTitle: '2. Phát triển nhận thức', goals: ['Nhận biết và chỉ gọi tên được đồ vật, màu sắc, kích thước quen thuộc trong chủ đề.'] },
          { domainKey: 'PTNN', domainTitle: '3. Phát triển ngôn ngữ', goals: ['Nói rõ từ, câu ngắn và thích nghe cô đọc thơ, kể chuyện ngắn.'] },
          { domainKey: 'PT_TCKNXH', domainTitle: '4. Phát triển tình cảm, kỹ năng xã hội và thẩm mỹ', goals: ['Biết chào cô, chơi thân thiện cạnh bạn; thích hát múa, di màu, bóp nặn cùng cô.'] },
        ]
      : [
          { domainKey: 'PTNT', domainTitle: '1. Phát triển nhận thức', goals: ['Biết tên gọi và đặc điểm nổi bật của sự vật trong chủ đề nhánh tuần.'] },
          { domainKey: 'PTNN', domainTitle: '2. Phát triển ngôn ngữ', goals: ['Trả lời trọn câu, đọc thuộc thơ và lắng nghe chuyện kể.'] },
          { domainKey: 'PTTC', domainTitle: '3. Phát triển thể chất', goals: ['Tham gia tích cực thể dục sáng và vận động cơ bản.'] },
          { domainKey: 'PTTM', domainTitle: '4. Phát triển thẩm mỹ', goals: ['Hát đúng giai điệu và hoàn thành sản phẩm tạo hình.'] },
          { domainKey: 'PT_TCKNXH', domainTitle: '5. Phát triển tình cảm – xã hội', goals: ['Lễ phép chào hỏi, chơi đoàn kết và cất đồ chơi gọn gàng.'] },
        ],
    etiquetteNotes: isNhaTre
      ? ['Tập cho trẻ biết khoanh tay chào cô, chào ba mẹ khi đến lớp và ra về.', 'Tập nói “ạ”, “vâng ạ”, “cảm ơn” khi được cô nhắc nhở.']
      : ['Biết khoanh tay chào cô, chào ba mẹ khi đến lớp và ra về.', 'Biết nói lời cảm ơn, xin lỗi, giữ gìn vệ sinh chung.'],
    laborHygieneNotes: isNhaTre
      ? ['Tập nhận biết ký hiệu tủ đồ, tự cất dép đúng nơi quy định với sự hướng dẫn của cô.', 'Rửa tay lau mặt sạch sẽ trước khi ăn và sau khi chơi.']
      : ['Tự lấy và cất đồ dùng cá nhân đúng ký hiệu.', 'Rửa tay bằng xà phòng trước khi ăn và sau khi đi vệ sinh.'],
    welcomeRoutineNotes: isNhaTre
      ? ['Vệ sinh lớp thông thoáng, đón trẻ âu yếm vỗ về tạo cảm giác an toàn và trao đổi nhanh với phụ huynh.', 'Cho trẻ chơi nhẹ với đồ chơi an toàn cỡ lớn trong lớp trong lúc chờ đủ bạn.']
      : ['Vệ sinh lớp thông thoáng, đón trẻ niềm nở và trao đổi nhanh với phụ huynh.', 'Trò chuyện cùng trẻ về chủ đề trong tuần và cho trẻ chơi nhẹ ở các góc.'],
    praiseStandards: [
      'Đi học đều, đúng giờ, biết chào hỏi lễ phép.',
      'Chú ý lắng nghe cô trong giờ học, hăng hái phát biểu.',
      'Chơi đoàn kết với bạn và giữ gìn vệ sinh, đồ dùng gọn gàng.',
    ],
    praiseSongStart: 'Càng lớn càng ngoan',
    praiseSongWeekEnd: 'Cả tuần đều ngoan',
    morningExercise: isNhaTre
      ? {
          aims: ['Trẻ vui vẻ tập các động tác thể dục sáng đơn giản theo cô để cơ thể khỏe mạnh.'],
          preparation: ['Sân tập sạch sẽ, nhạc thiếu nhi vui tươi.'],
          warmup: 'Cô dắt trẻ đi vòng tròn nhẹ nhàng theo tiếng nhạc vui rồi đứng quanh cô.',
          moves: [
            { group: 'Hô hấp', name: 'Thổi bóng bay nhẹ (2l × 4n)', steps: 'Đứng thoải mái, hít vào nhẹ nhàng rồi thổi hơi ra cùng cô.' },
            { group: 'Tay', name: 'Hai tay giơ cao – hạ xuống (2l × 4n)', steps: 'Đưa hai tay lên cao vẫy nhẹ rồi hạ xuống xuôi người.' },
            { group: 'Bụng', name: 'Cúi người chạm gối (2l × 4n)', steps: 'Cúi nhẹ chạm hai tay vào đầu gối rồi đứng thẳng lên.' },
            { group: 'Chân', name: 'Ngồi xuống – đứng lên (2l × 4n)', steps: 'Ngồi khuỵu gối nhẹ rồi đứng thẳng dậy cùng cô.' },
          ],
          cooldown: 'Đi nhẹ nhàng 1 vòng thả lỏng, vỗ tay khen bé ngoan rồi vào lớp.',
        }
      : {
          aims: ['Trẻ tập đều, đúng nhịp các động tác phát triển nhóm cơ và hô hấp.'],
          preparation: ['Sân tập sạch sẽ, nhạc thể dục sáng.'],
          warmup: 'Đi vòng tròn kết hợp các kiểu chân, chạy nhanh chậm rồi về hàng ngang.',
          moves: [
            { group: 'Hô hấp', name: 'Hít thở sâu / Thổi bóng bay (2l × 8n)', steps: 'Đứng chân chữ V, hít vào bằng mũi thở ra nhẹ nhàng.' },
            { group: 'Tay', name: 'Hai tay đưa ra trước, lên cao (2l × 8n)', steps: 'Đưa tay nhịp nhàng theo nhạc.' },
            { group: 'Bụng', name: 'Đứng cúi gập người (2l × 8n)', steps: 'Hai chân rộng bằng vai, cúi gập người chạm mũi chân.' },
            { group: 'Chân', name: 'Ngồi khuỵu gối (2l × 8n)', steps: 'Khuỵu gối thẳng lưng, hai tay đưa ra trước.' },
            { group: 'Bật', name: 'Bật tiến về trước (2l × 8n)', steps: 'Hai tay chống hông, bật chụm chân tiếp đất nhẹ nhàng.' },
          ],
          cooldown: 'Đi nhẹ nhàng thả lỏng 1–2 vòng rồi vào lớp.',
        },
    outdoorTable: [
      { category: 'CHU_DICH', title: 'Quan sát có mục đích theo chủ đề từng ngày', requirements: ['Phát triển khả năng quan sát và diễn đạt.'], preparation: ['Sân trường sạch sẽ, an toàn.'], procedure: ['Cô giới thiệu nội dung quan sát, gợi mở câu hỏi cho trẻ thảo luận.'] },
      { category: 'TCVD', title: isNhaTre ? 'TCVĐ: Bóng tròn to / Trời nắng trời mưa' : 'TCVĐ: Mèo đuổi chuột / Lộn cầu vồng', requirements: ['Rèn sự nhanh nhẹn, khéo léo.'], preparation: ['Sân rộng thoáng mát.'], procedure: ['Giới thiệu luật chơi, tổ chức cho trẻ chơi 3–4 lượt.'] },
      { category: 'TCDG', title: isNhaTre ? 'TCDG: Chi chi chành chành / Nu na nu nống' : 'TCDG: Chi chi chành chành', requirements: ['Phát triển phản xạ và ghi nhớ đồng dao.'], preparation: ['Không gian sân trường.'], procedure: ['Chia nhóm nhỏ cùng chơi vui vẻ.'] },
      { category: 'TU_DO', title: 'Chơi tự do với đồ chơi sân trường', requirements: ['Chơi an toàn, biết chờ đến lượt.'], preparation: ['Phấn, vòng, bóng, đồ chơi ngoài trời.'], procedure: ['Cô bao quát đảm bảo an toàn, nhận xét và cho trẻ rửa tay vào lớp.'] },
    ],
    cornerTable: isNhaTre
      ? [
          { cornerName: 'Góc thao tác vai', contents: ['Bế em, ru em ngủ, cho búp bê ăn'], requirements: ['Biết thao tác mô phỏng nhẹ nhàng, thân thiện.'], preparation: ['Búp bê, bộ bát thìa nhựa an toàn.'], organization: ['Cô gợi mở và chơi cùng trẻ theo nhóm nhỏ.'] },
          { cornerName: 'Góc hoạt động với đồ vật', contents: ['Xếp chồng 4–6 khối gỗ, xâu hạt to'], requirements: ['Rèn sự khéo léo của bàn tay, ngón tay.'], preparation: ['Khối gỗ màu cỡ lớn, hạt gỗ xâu dây an toàn.'], organization: ['Cô hướng dẫn trẻ xếp chồng và gọi tên màu sắc.'] },
          { cornerName: 'Góc nghệ thuật', contents: ['Di màu bút sáp to, bóp đất nặn, nhún nhảy theo nhạc'], requirements: ['Trẻ thích thú với màu sắc và âm thanh vui tươi.'], preparation: ['Giấy khổ lớn, bút sáp to, đất nặn mềm, trống lắc.'], organization: ['Khuyến khích trẻ trải nghiệm tự do theo hứng thú.'] },
          { cornerName: 'Góc sách tranh', contents: ['Xem sách tranh bìa cứng cỡ lớn, chỉ gọi tên đồ vật'], requirements: ['Biết mở nhẹ từng trang tranh cùng cô.'], preparation: ['Sách tranh bìa cứng có hình ảnh to, rõ nét.'], organization: ['Cô ngồi cạnh cùng xem và trò chuyện với trẻ.'] },
          { cornerName: 'Góc thiên nhiên', contents: ['Tưới cây bằng bình mini, sờ cảm nhận lá cây'], requirements: ['Biết yêu quý cây xanh và chơi an toàn.'], preparation: ['Bình tưới nhỏ, khăn lau lá, chậu cây xanh.'], organization: ['Cô hướng dẫn trẻ chăm sóc cây nhẹ nhàng.'] },
        ]
      : [
          { cornerName: 'Góc phân vai', contents: ['Bán hàng, Nấu ăn, Gia đình'], requirements: ['Biết nhập vai và giao tiếp lịch sự.'], preparation: ['Bộ đồ chơi nấu ăn, kệ hàng.'], organization: ['Thỏa thuận vai chơi và liên kết các góc.'] },
          { cornerName: 'Góc xây dựng – lắp ráp', contents: ['Xây dựng công trình theo chủ đề'], requirements: ['Biết phối hợp khối gỗ, hợp tác nhóm.'], preparation: ['Khối gỗ, hàng rào, cây xanh.'], organization: ['Phân công nhóm xây dựng và giới thiệu sản phẩm.'] },
          { cornerName: 'Góc nghệ thuật', contents: ['Vẽ, tô màu, nặn, ca hát theo chủ đề'], requirements: ['Biết sử dụng bút màu, nhạc cụ.'], preparation: ['Giấy vẽ, sáp màu, đất nặn, phách tre.'], organization: ['Khuyến khích trẻ sáng tạo và trưng bày sản phẩm.'] },
          { cornerName: 'Góc học tập – thư viện', contents: ['Xem sách tranh, kể chuyện, ghép thẻ'], requirements: ['Biết giữ gìn sách, lật trang đúng chiều.'], preparation: ['Sách tranh, thẻ chữ/số, lô tô.'], organization: ['Hướng dẫn trẻ xem tranh theo nhóm nhỏ.'] },
          { cornerName: 'Góc thiên nhiên / khoa học', contents: ['Chăm sóc cây xanh, thí nghiệm vui'], requirements: ['Biết tưới cây, lau lá bảo vệ cây xanh.'], preparation: ['Bình tưới, khăn lau lá.'], organization: ['Hướng dẫn trẻ chăm sóc cây hằng ngày.'] },
        ],
    days: dayLabels.map((item, idx) => ({
      dayOfWeek: item.d,
      dayLabel: item.lbl,
      dateStr: addDaysISO(opts.weekStartDate, idx),
      showPraiseStandards: idx === 0,
      outdoorObservation: outdoorByDay[idx] || outdoorByDay[0],
      mainLessons: [],
      extracurricularTitle: '',
      afternoonLesson: null,
      evalHealth: '',
      evalEmotionBehavior: '',
      evalKnowledgeSkill: '',
    })),
  };
}
