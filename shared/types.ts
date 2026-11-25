export type AgeGroupId = 'NHA_TRE_24_36T' | 'MAM_3_4T' | 'CHOI_4_5T' | 'LA_5_6T';

export interface AgeGroup {
  id: AgeGroupId;
  name: string;
  short: string;
  order: number;
}

export interface SuggestedActivity {
  id: string;
  objectiveId: string;
  ageGroupId: AgeGroupId;
  mtCode: string;
  domain: string;
  type: string;
  text: string;
  month: string;
  theme: string;
}

export interface ObjectiveItem {
  id: string;
  ageGroupId: AgeGroupId;
  ageGroupName: string;
  code: string;
  domain: string;
  subGroup: string;
  description: string;
  month: string;
  theme: string;
  source: string;
  eduContent: string;
  activities: SuggestedActivity[];
}

export interface ObjectivesDataset {
  ageGroups: AgeGroup[];
  objectives: ObjectiveItem[];
  totalObjectives: number;
  totalActivities: number;
}

export type DomainKey =
  | 'PTTC'
  | 'PTNT'
  | 'PTNN'
  | 'PTTM'
  | 'PT_TCKNXH';

export interface DomainObjectiveBlock {
  domainKey: DomainKey;
  domainTitle: string;
  customGoals: string[];
  mtCodes: string[];
}

export interface ContentNetworkBranch {
  id: string;
  branchTitle: string;
  items: string[];
}

export interface ActivityNetworkBranch {
  domainKey: DomainKey;
  domainTitle: string;
  items: string[];
}

export interface ExerciseMove {
  group: string; // Thở, Tay, Bụng, Chân, Bật
  name: string;  // VD: Thở 2: Thổi bóng bay (2l x 8n)
  steps: string; // Mô tả nhịp chi tiết (tùy chọn)
}

export interface MorningExercise {
  aims: string[];
  preparation: string[];
  warmup: string;
  moves: ExerciseMove[];
  cooldown: string;
}

export interface OutdoorRow {
  category: 'CHU_DICH' | 'TCVD' | 'TCDG' | 'TU_DO';
  title: string;
  requirements: string[];
  preparation: string[];
  procedure: string[];
}

export interface CornerRow {
  cornerName: string;
  contents: string[];
  requirements: string[];
  preparation: string[];
  organization: string[];
}

export interface LessonStep {
  title: string;
  details: string[];
}

export interface LessonMediaAttachment {
  id: string;
  kind: 'VIDEO' | 'SLIDE' | 'IMAGE' | 'DOC';
  title: string;
  url: string;
}

export interface LessonPlan {
  id: string;
  slotType: 'MAIN' | 'AFTERNOON';
  domainTitle: string;      // VD: LĨNH VỰC PHÁT TRIỂN THẨM MỸ
  subjectCode: string;      // GDAN, PTVĐ, MTXQ, LQVH, Tạo hình, LQVT, LQCC, NBTN, TTVS, LĐVS...
  subjectFullTitle: string; // VD: HOẠT ĐỘNG ÂM NHẠC
  topicTitle: string;       // VD: Dạy hát: Em đi mẫu giáo
  subTopics: string[];      // VD: ["Nghe hát: Ngày đầu tiên đi học", "TCAN: Tai ai thính"]
  linkedMtCodes: string[];  // ["MT89", "MT90"]
  aims: string[];           // I. Mục đích yêu cầu
  preparation: string[];    // II. Chuẩn bị
  steps: LessonStep[];      // III. Tổ chức hoạt động (HĐ 1..4)
  mediaItems?: LessonMediaAttachment[]; // Học liệu Media đính kèm (YC-051)
  richHtml?: string;        // Nội dung giàu định dạng Word riêng của tiết học (đồng bộ trực tiếp sang A4)
}

export interface DayPlan {
  dayOfWeek: 2 | 3 | 4 | 5 | 6;
  dayLabel: string; // "Thứ hai", "Thứ ba"...
  dateStr: string;  // "2026-09-07"
  isHoliday?: boolean;
  holidayName?: string; // VD: "Nghỉ Lễ 30/4" hoặc "Ngày Nhà giáo VN 20/11"
  showPraiseStandards: boolean;
  outdoorObservation: string;
  mainLessons: LessonPlan[];
  extracurricularTitle: string; // VD: "HĐNK: Học nhảy Aerobic"
  afternoonLesson: LessonPlan | null;
  evalHealth: string;
  evalEmotionBehavior: string;
  evalKnowledgeSkill: string;
  /** Đánh giá trẻ hàng ngày theo Mã MT của ngày hôm đó (YC-052): dailyEvaluations[studentId][mtCode] */
  dailyEvaluations?: Record<string, Record<string, MtEvalLevel>>;
}

export interface ReviewComment {
  id: string;
  authorRole: 'TEACHER' | 'HEAD_TEACHER' | 'PRINCIPAL';
  authorName: string;
  targetSection: string; // VD: "Mục tiêu tuần", "Thứ hai", "Thứ tư"...
  content: string;
  createdAt: string;
  resolved?: boolean;
}

export interface WeeklyPlanDocument {
  id: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'NEEDS_REVISION' | 'APPROVED';
  updatedAt: string;
  /** Liên kết ngược về Chủ đề tháng trong Kế hoạch Năm học */
  annualThemeId?: string;
  /** Đánh dấu giáo viên đã gõ chỉnh sửa tay trực tiếp trên bản tổng A4 ở Bước 4 */
  hasManualFullDocEdits?: boolean;
  /** Thông tin trình ký & phê duyệt trực tuyến của Tổ trưởng / BGH */
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  reviewComments?: ReviewComment[];
  /** Nội dung soạn thảo trực tiếp dạng văn bản giàu định dạng (giống Microsoft Word) */
  editorHtml?: string;

  // Thông tin bìa & hành chính chuẩn BGD
  governingBody: string;     // VD: UBND PHƯỜNG THUẬN AN – TP HCM
  schoolName: string;        // VD: TRƯỜNG MẦM NON HOÀNG GIA
  schoolYear: string;        // VD: 2026 – 2027
  ageGroupId: AgeGroupId;
  className: string;         // VD: Lá 1
  teacherName: string;       // VD: Nguyễn Thị Bé Diệu
  principalName: string;     // VD: Nguyễn Thị Thủy

  // Chủ đề & Tuần
  themeName: string;         // VD: TRƯỜNG MẦM NON CỦA BÉ
  themeTotalWeeks: number;   // VD: 3
  themeStartDate: string;    // "2026-09-07"
  themeEndDate: string;      // "2026-09-25"
  weekNumber: number;        // VD: 1
  subThemeName: string;      // VD: Trường Mầm Non Của Bé
  weekStartDate: string;     // "2026-09-07"
  weekEndDate: string;       // "2026-09-11"
  includeThemeSection: boolean; // In kèm Trang bìa + Mục tiêu/Mạng chủ đề (mặc định true cho Tuần 1)

  // Phần Chủ đề
  themeObjectives: DomainObjectiveBlock[];
  contentNetwork: ContentNetworkBranch[];
  activityNetwork: ActivityNetworkBranch[];

  // Phần Mục tiêu Tuần
  weeklyObjectives: {
    domainKey: DomainKey;
    domainTitle: string;
    goals: string[];
  }[];

  // Khối dùng chung cả tuần (tự đồng bộ xuống 5 ngày!)
  etiquetteNotes: string[];       // Lễ giáo
  laborHygieneNotes: string[];    // Lao động vệ sinh
  welcomeRoutineNotes: string[];  // Đón trẻ
  praiseStandards: string[];      // 3 Tiêu chuẩn bé ngoan
  praiseSongStart: string;        // Bài hát nêu gương
  praiseSongWeekEnd: string;      // Bài hát cuối tuần
  morningExercise: MorningExercise;
  outdoorTable: OutdoorRow[];
  cornerTable: CornerRow[];

  // 5 ngày Thứ 2 -> Thứ 6
  days: DayPlan[];
}

// ============================================================================
// PHẦN 1: KẾ HOẠCH NĂM HỌC (9 THÁNG / 35 TUẦN) & HỒ SƠ LỚP CỐ ĐỊNH
// ============================================================================

export interface StudentRosterItem {
  id: string;
  fullName: string;
  dob?: string;
  gender?: 'Nam' | 'Nữ';
  note?: string; // VD: "Dị ứng hải sản", "Cần rèn phát âm"
}

export interface ClassProfile {
  ageGroupId: AgeGroupId;
  schoolName: string;
  governingBody: string;
  schoolYear: string;
  className: string;
  teacherName: string;
  coTeacherName?: string;
  principalName: string;
  students: StudentRosterItem[];
}

export interface ThemeMonthAllocation {
  id: string;
  order: number;          // 1..9 (Tháng 9 -> Tháng 5)
  monthNumber: number;    // 9, 10, 11, 12, 1, 2, 3, 4, 5
  monthLabel: string;     // "Tháng 9"
  themeName: string;      // VD: "TRƯỜNG MẦM NON CỦA BÉ"
  totalWeeks: number;     // 3 hoặc 4 tuần
  startDate: string;      // Thứ hai tuần đầu của chủ đề
  subThemes: string[];    // Tên chủ đề nhánh từng tuần (Tuần 1..Tuần N)
  festivalNote?: string;  // Ngày hội, ngày lễ trong tháng (YC-045)
  plannedMtCodes: string[];     // Danh sách mã MT dạy trong tháng/chủ đề này (✓)
  assessmentMtCodes?: string[]; // Danh sách mã MT chọn ĐÁNH GIÁ trong tháng (★)
  /** Phân bổ cụ thể mã MT của tháng xuống từng tuần nhánh 0..3 (KHGD Tháng — YC-047) */
  weeklyMtAllocation?: Record<string, string[]>;
}

/** Khung Thời khóa biểu Tuần lẻ / Tuần chẵn (5 ngày T2..T6 -> danh sách mã môn học) */
export interface WeeklyTimetableTemplate {
  oddWeek: string[][];  // 5 phần tử ứng với Thứ 2..Thứ 6 của Tuần lẻ (Tuần 1, 3, 5...)
  evenWeek: string[][]; // 5 phần tử ứng với Thứ 2..Thứ 6 của Tuần chẵn (Tuần 2, 4, 6...)
}

export interface AnnualPlanDocument {
  id: string;
  ageGroupId: AgeGroupId;
  updatedAt: string;
  profile: ClassProfile;
  timetable?: WeeklyTimetableTemplate;
  /** Mục tiêu phát triển mở rộng riêng của lớp/trường ngoài 345 MT gốc (YC-044, hiển thị chữ đỏ) */
  customObjectives?: ObjectiveItem[];
  themes: ThemeMonthAllocation[];
}

/** Bài giảng mẫu cá nhân giáo viên lưu từ Bước 3 để tái sử dụng (YC-038) */
export interface SavedLessonTemplate {
  id: string;
  ageGroupId: AgeGroupId;
  subjectCode: string;
  topicTitle: string;
  linkedMtCodes: string[];
  richHtml: string;
  createdBy: string;
  createdAt: string;
}

/** Tài nguyên Kho Media & Học liệu điện tử chia sẻ (YC-053) */
export interface SharedMediaResource {
  id: string;
  kind: 'VIDEO' | 'SLIDE' | 'IMAGE' | 'ELEARNING' | 'DOC';
  title: string;
  url: string;
  subjectCode: string;
  ageGroupId: AgeGroupId | 'ALL';
  themeName: string;
  author: string;
  createdAt: string;
}

// ============================================================================
// PHẦN 2: KHO NGỮ LIỆU TÁC PHẨM CHI TIẾT (THƠ, TRUYỆN, BÀI HÁT, ĐỒNG DAO, LQCC)
// ============================================================================

export interface LiteraryWorkItem {
  id: string;
  kind: 'POEM' | 'STORY' | 'SONG' | 'RIDDLE' | 'LQCC';
  title: string;
  author: string;
  ageGroups: AgeGroupId[];
  themes: string[];
  contentText: string;          // Lời thơ / Lời bài hát / Tóm tắt cốt truyện / Cấu tạo nét chữ
  dialogueQuestions: string[];  // 4-5 câu hỏi đàm thoại sát nội dung tác phẩm
  educationalNote: string;      // Giáo dục thái độ / thông điệp lồng ghép
}

// ============================================================================
// PHẦN 3: BẢNG ĐÁNH GIÁ TRẺ CUỐI CHỦ ĐỀ THEO MÃ MT (3 TRẠNG THÁI + GHI CHÚ RIÊNG)
// ============================================================================

export type MtEvalLevel = 'ACHIEVED' | 'NEEDS_SUPPORT' | 'NOT_EVALUATED';

export interface ThemeAssessmentDocument {
  id: string;
  ageGroupId: AgeGroupId;
  className: string;
  schoolName: string;
  teacherName: string;
  principalName: string;
  schoolYear: string;
  themeName: string;
  durationText: string;
  mtCodes: string[];
  // Nhận xét chung việc thực hiện chủ đề (cả lớp)
  executedObjectivesNote: string;
  childrenInterestNote: string;
  advantagesDifficultiesNote: string;
  nextThemeAdjustmentNote: string;
  // Ma trận đánh giá từng trẻ theo từng mã MT: 'ACHIEVED' | 'NEEDS_SUPPORT' | 'NOT_EVALUATED'
  evaluations: Record<string, Record<string, MtEvalLevel>>;
  // Ngày đánh giá cụ thể (dd/mm/yyyy) được đồng bộ từ Đánh giá trẻ hàng ngày (YC-052)
  evalDates?: Record<string, Record<string, string>>;
  // Ghi chú tổng kết riêng cho từng trẻ trong chủ đề/tháng (YC-040)
  studentNotes?: Record<string, string>;
  updatedAt: string;
}
