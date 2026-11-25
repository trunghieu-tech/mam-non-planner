import type {
  AgeGroupId,
  AnnualPlanDocument,
  ObjectiveItem,
  StudentRosterItem,
  ThemeMonthAllocation,
  WeeklyTimetableTemplate,
} from './types.js';

export function buildDefaultTimetable(ageGroupId: AgeGroupId): WeeklyTimetableTemplate {
  switch (ageGroupId) {
    case 'NHA_TRE_24_36T':
      return {
        oddWeek: [['PTVĐ'], ['NBTN'], ['GDAN'], ['LQVH'], ['Tạo hình']],
        evenWeek: [['PTVĐ'], ['NBTN'], ['LQVH'], ['GDAN'], ['Tạo hình']],
      };
    case 'MAM_3_4T':
      return {
        oddWeek: [['GDAN'], ['PTVĐ'], ['MTXQ'], ['LQVH'], ['KNS', 'Tạo hình']],
        evenWeek: [['PTVĐ'], ['MTXQ'], ['LQVT'], ['GDAN'], ['Tạo hình']],
      };
    case 'CHOI_4_5T':
      return {
        oddWeek: [['GDAN', 'PTVĐ'], ['MTXQ'], ['Tạo hình'], ['KNS', 'LQVT'], ['LQVH']],
        evenWeek: [['PTVĐ'], ['MTXQ'], ['LQVH'], ['LQVT', 'GDAN'], ['Tạo hình', 'KNS']],
      };
    case 'LA_5_6T':
    default:
      return {
        oddWeek: [['GDAN', 'PTVĐ'], ['MTXQ', 'LQVH'], ['KNS', 'Tạo hình'], ['LQVT'], ['LQCC']],
        evenWeek: [['PTVĐ'], ['MTXQ'], ['LQVT', 'LQCC'], ['GDAN', 'LQVH'], ['Tạo hình', 'KNS']],
      };
  }
}

const DEFAULT_STUDENTS_SAMPLE: Array<{ fullName: string; gender: 'Nam' | 'Nữ'; dob: string; note?: string }> = [
  { fullName: 'Nguyễn Minh An', gender: 'Nam', dob: '12/03/2022' },
  { fullName: 'Trần Bảo Ngọc', gender: 'Nữ', dob: '24/05/2022' },
  { fullName: 'Lê Hoàng Khôi', gender: 'Nam', dob: '08/01/2022' },
  { fullName: 'Phạm Hà My', gender: 'Nữ', dob: '19/07/2022' },
  { fullName: 'Hoàng Gia Huy', gender: 'Nam', dob: '03/09/2022', note: 'Cần khích lệ mạnh dạn phát biểu' },
  { fullName: 'Vũ Tuệ Nhi', gender: 'Nữ', dob: '15/04/2022' },
  { fullName: 'Đặng Quốc Bảo', gender: 'Nam', dob: '28/10/2022' },
  { fullName: 'Bùi Khánh Linh', gender: 'Nữ', dob: '11/06/2022' },
  { fullName: 'Đỗ Minh Khang', gender: 'Nam', dob: '22/02/2022' },
  { fullName: 'Ngô Thảo Vy', gender: 'Nữ', dob: '30/08/2022', note: 'Cần rèn thêm kỹ năng cầm bút / tự xúc ăn' },
  { fullName: 'Dương Tuấn Kiệt', gender: 'Nam', dob: '14/11/2022' },
  { fullName: 'Lý Ngọc Hân', gender: 'Nữ', dob: '05/12/2022' },
  { fullName: 'Phan Đức Phúc', gender: 'Nam', dob: '17/05/2022' },
  { fullName: 'Trương Bảo Châu', gender: 'Nữ', dob: '09/03/2022' },
  { fullName: 'Hồ Thiên Ân', gender: 'Nam', dob: '26/09/2022' },
];

interface MonthThemeTemplate {
  monthNumber: number;
  monthLabel: string;
  startDate: string;
  totalWeeks: number;
  themeName: string;
  subThemes: string[];
}

const NINE_MONTH_TEMPLATES: Record<'NHA_TRE' | 'MAU_GIAO', MonthThemeTemplate[]> = {
  NHA_TRE: [
    {
      monthNumber: 9,
      monthLabel: 'Tháng 9',
      startDate: '2026-09-07',
      totalWeeks: 4,
      themeName: 'LỚP NHÀ TRẺ VUI VẺ CỦA BÉ',
      subThemes: ['Ngày hội bé đến lớp', 'Cô giáo và các bạn của bé', 'Bé vui Tết Trung thu', 'Làm quen nề nếp lớp học'],
    },
    {
      monthNumber: 10,
      monthLabel: 'Tháng 10',
      startDate: '2026-10-05',
      totalWeeks: 4,
      themeName: 'BẢN THÂN ĐÁNG YÊU CỦA BÉ',
      subThemes: ['Tên gọi và khuôn mặt đáng yêu', 'Đôi bàn tay – bàn chân xinh', 'Bé ăn ngoan – ngủ giỏi', 'Tập giữ cơ thể sạch sẽ'],
    },
    {
      monthNumber: 11,
      monthLabel: 'Tháng 11',
      startDate: '2026-11-02',
      totalWeeks: 4,
      themeName: 'ĐỒ DÙNG – ĐỒ CHƠI CỦA BÉ',
      subThemes: ['Đồ dùng ăn uống quen thuộc', 'Đồ chơi bé thích ở lớp', 'Bông hoa tặng cô giáo 20/11', 'Cất giữ đồ chơi gọn gàng'],
    },
    {
      monthNumber: 12,
      monthLabel: 'Tháng 12',
      startDate: '2026-11-30',
      totalWeeks: 5,
      themeName: 'GIA ĐÌNH THÂN YÊU CỦA BÉ',
      subThemes: ['Ông bà, bố mẹ của bé', 'Ngôi nhà ấm áp của bé', 'Đồ dùng trong gia đình', 'Bé ngoan lễ phép ở nhà', 'Chào đón năm mới vui tươi'],
    },
    {
      monthNumber: 1,
      monthLabel: 'Tháng 1',
      startDate: '2027-01-04',
      totalWeeks: 4,
      themeName: 'CÂY XANH – HOA QUẢ & MÙA XUÂN',
      subThemes: ['Cây xanh sân trường', 'Các loại hoa đẹp mùa xuân', 'Quả ngọt bé thích ăn', 'Bé vui đón Tết Nguyên đán'],
    },
    {
      monthNumber: 2,
      monthLabel: 'Tháng 2',
      startDate: '2027-02-15',
      totalWeeks: 3,
      themeName: 'NHỮNG CON VẬT ĐÁNG YÊU',
      subThemes: ['Con gà, con vịt quanh nhà', 'Chó con, mèo con đáng yêu', 'Con cá bơi dưới nước'],
    },
    {
      monthNumber: 3,
      monthLabel: 'Tháng 3',
      startDate: '2027-03-08',
      totalWeeks: 4,
      themeName: 'PHƯƠNG TIỆN GIAO THÔNG QUEN THUỘC',
      subThemes: ['Quà nhỏ tặng bà và mẹ 8/3', 'Xe đạp, xe máy, ô tô quen thuộc', 'Đoàn tàu và máy bay', 'Ngồi xe an toàn cùng bố mẹ'],
    },
    {
      monthNumber: 4,
      monthLabel: 'Tháng 4',
      startDate: '2027-04-05',
      totalWeeks: 4,
      themeName: 'NƯỚC & HIỆN TƯỢNG TỰ NHIÊN',
      subThemes: ['Nước sạch cần cho bé', 'Trời nắng – trời mưa', 'Ngày và đêm', 'Trang phục mùa hè mát mẻ'],
    },
    {
      monthNumber: 5,
      monthLabel: 'Tháng 5',
      startDate: '2027-05-03',
      totalWeeks: 4,
      themeName: 'MÙA HÈ & BÉ LÊN LỚP MẪU GIÁO',
      subThemes: ['Mùa hè vui khỏe của bé', 'Bé nhớ Bác Hồ kính yêu', 'Ôn luyện thói quen bé ngoan', 'Tạm biệt lớp Nhà trẻ – Lên lớp Mầm'],
    },
  ],
  MAU_GIAO: [
    {
      monthNumber: 9,
      monthLabel: 'Tháng 9',
      startDate: '2026-09-07',
      totalWeeks: 4,
      themeName: 'TRƯỜNG MẦM NON CỦA BÉ',
      subThemes: ['Trường Mầm non thân yêu của bé', 'Lớp học, cô giáo và bạn bè', 'Bé vui hội Trăng rằm Trung thu', 'Nề nếp bé ngoan ở lớp'],
    },
    {
      monthNumber: 10,
      monthLabel: 'Tháng 10',
      startDate: '2026-10-05',
      totalWeeks: 4,
      themeName: 'BẢN THÂN BÉ',
      subThemes: ['Tôi là ai – Cơ thể kỳ diệu của bé', 'Năm giác quan đáng quý của bé', 'Thực phẩm giúp bé lớn khỏe', 'Bé tự phục vụ và giữ an toàn'],
    },
    {
      monthNumber: 11,
      monthLabel: 'Tháng 11',
      startDate: '2026-11-02',
      totalWeeks: 4,
      themeName: 'GIA ĐÌNH & NGÀY NHÀ GIÁO 20/11',
      subThemes: ['Gia đình thân yêu của bé', 'Ngôi nhà và đồ dùng gia đình', 'Tri ân cô giáo ngày 20/11', 'Nhu cầu và niềm vui gia đình'],
    },
    {
      monthNumber: 12,
      monthLabel: 'Tháng 12',
      startDate: '2026-11-30',
      totalWeeks: 5,
      themeName: 'NGHỀ NGHIỆP & THẾ GIỚI ĐỘNG VẬT',
      subThemes: ['Một số nghề phổ biến quanh bé', 'Nghề sản xuất và dịch vụ gần gũi', 'Chú bộ đội kính yêu (22/12)', 'Những con vật nuôi trong gia đình', 'Động vật sống trong rừng & dưới nước'],
    },
    {
      monthNumber: 1,
      monthLabel: 'Tháng 1',
      startDate: '2027-01-04',
      totalWeeks: 4,
      themeName: 'THẾ GIỚI THỰC VẬT & TẾT MÙA XUÂN',
      subThemes: ['Cây xanh và môi trường sống', 'Các loại rau, củ, quả bổ dưỡng', 'Các loài hoa khoe sắc mùa xuân', 'Bé vui đón Tết cổ truyền dân tộc'],
    },
    {
      monthNumber: 2,
      monthLabel: 'Tháng 2',
      startDate: '2027-02-15',
      totalWeeks: 3,
      themeName: 'MÙA XUÂN & LỄ HỘI QUÊ HƯƠNG',
      subThemes: ['Không khí mùa xuân tươi đẹp', 'Côn trùng và chim chóc mùa xuân', 'Giữ gìn cây xanh vườn trường'],
    },
    {
      monthNumber: 3,
      monthLabel: 'Tháng 3',
      startDate: '2027-03-08',
      totalWeeks: 4,
      themeName: 'PHƯƠNG TIỆN VÀ LUẬT LỆ GIAO THÔNG',
      subThemes: ['Yêu thương bà, mẹ và cô ngày 8/3', 'Phương tiện giao thông đường bộ', 'Giao thông đường thủy – hàng không', 'Bé chấp hành tín hiệu & luật giao thông'],
    },
    {
      monthNumber: 4,
      monthLabel: 'Tháng 4',
      startDate: '2027-04-05',
      totalWeeks: 4,
      themeName: 'NƯỚC & CÁC HIỆN TƯỢNG TỰ NHIÊN',
      subThemes: ['Nguồn nước sạch và ích lợi của nước', 'Nắng, mưa, gió, mây và cầu vồng', 'Sự thay đổi ngày – đêm và các mùa', 'Bảo vệ môi trường – Tiết kiệm điện nước'],
    },
    {
      monthNumber: 5,
      monthLabel: 'Tháng 5',
      startDate: '2027-05-03',
      totalWeeks: 4,
      themeName: 'QUÊ HƯƠNG – ĐẤT NƯỚC – BÁC HỒ & TRƯỜNG TIỂU HỌC',
      subThemes: ['Quê hương, Thủ đô Hà Nội & đất nước Việt Nam', 'Bác Hồ kính yêu với các cháu thiếu nhi (19/5)', 'Mùa hè sôi động và an toàn phòng đuối nước', 'Tạm biệt trường Mầm non – Sẵn sàng lên lớp trên'],
    },
  ],
};

function defaultClassName(ageGroupId: AgeGroupId): string {
  switch (ageGroupId) {
    case 'NHA_TRE_24_36T':
      return 'Nhà trẻ 1 (24–36T)';
    case 'MAM_3_4T':
      return 'Mầm 1 (3–4T)';
    case 'CHOI_4_5T':
      return 'Chồi 1 (4–5T)';
    case 'LA_5_6T':
      return 'Lá 1 (5–6T)';
  }
}

function birthYearByGrade(ageGroupId: AgeGroupId): string {
  switch (ageGroupId) {
    case 'NHA_TRE_24_36T':
      return '2024';
    case 'MAM_3_4T':
      return '2023';
    case 'CHOI_4_5T':
      return '2022';
    case 'LA_5_6T':
      return '2021';
  }
}

/**
 * Tự động xây dựng Kế hoạch Năm học 9 tháng (34–35 tuần) cho từng khối tuổi,
 * phân bổ ĐỦ 100% mã MT của khối đó vào các tháng (theo nhãn tháng chuẩn + rải đều các MT "Xuyên suốt").
 */
export function buildDefaultAnnualPlan(
  ageGroupId: AgeGroupId,
  allObjectives: ObjectiveItem[]
): AnnualPlanDocument {
  const isNhaTre = ageGroupId === 'NHA_TRE_24_36T';
  const templates = isNhaTre ? NINE_MONTH_TEMPLATES.NHA_TRE : NINE_MONTH_TEMPLATES.MAU_GIAO;
  const gradeObjs = allObjectives.filter((o) => o.ageGroupId === ageGroupId);

  const byMonthNum = new Map<number, string[]>();
  const yearRoundCodes: string[] = [];

  for (const o of gradeObjs) {
    const mMatch = (o.month || '').match(/(\d{1,2})/);
    if (mMatch) {
      const mNum = Number(mMatch[1]);
      if (!byMonthNum.has(mNum)) byMonthNum.set(mNum, []);
      byMonthNum.get(mNum)!.push(o.code);
    } else {
      yearRoundCodes.push(o.code);
    }
  }

  // Rải đều các mã MT "Xuyên suốt" vào 9 tháng đầu năm để 100% MT của khối đều được lên lịch theo dõi!
  const themes: ThemeMonthAllocation[] = templates.map((tpl, idx) => {
    const directCodes = byMonthNum.get(tpl.monthNumber) || [];
    const distributedYearRound = yearRoundCodes.filter((_, yIdx) => yIdx % templates.length === idx);
    const merged = Array.from(new Set([...directCodes, ...distributedYearRound]));
    const subThemes = tpl.subThemes.map((st, wIdx) =>
      ageGroupId === 'LA_5_6T' && tpl.monthNumber === 5 && wIdx === 3
        ? 'Bé sẵn sàng tâm thế vào Lớp 1 Trường Tiểu học'
        : st
    );

    return {
      id: `ath_${ageGroupId}_m${tpl.monthNumber}`,
      order: idx + 1,
      monthNumber: tpl.monthNumber,
      monthLabel: tpl.monthLabel,
      themeName: tpl.themeName,
      totalWeeks: tpl.totalWeeks,
      startDate: tpl.startDate,
      subThemes,
      plannedMtCodes: merged,
      // Chọn sẵn tối đa 5 mã MT trọng tâm đầu tiên làm mục tiêu Đánh giá (★) trong tháng
      assessmentMtCodes: merged.slice(0, Math.min(5, merged.length)),
    };
  });

  const byr = birthYearByGrade(ageGroupId);
  const gradePrefix =
    ageGroupId === 'NHA_TRE_24_36T'
      ? 'NT'
      : ageGroupId === 'MAM_3_4T'
      ? 'M3'
      : ageGroupId === 'CHOI_4_5T'
      ? 'C4'
      : 'L5';
  const students: StudentRosterItem[] = DEFAULT_STUDENTS_SAMPLE.map((st, idx) => ({
    id: `stu_${ageGroupId}_${idx + 1}`,
    studentCode: `${gradePrefix}${String(26001 + idx)}`,
    fullName: st.fullName,
    gender: st.gender,
    dob: st.dob.replace(/\/\d{4}$/, `/${byr}`),
    note: st.note,
  }));

  return {
    id: `annual_${ageGroupId}`,
    ageGroupId,
    updatedAt: new Date().toISOString(),
    profile: {
      ageGroupId,
      schoolName: 'TRƯỜNG MẦM NON HOÀNG GIA',
      governingBody: 'UBND PHƯỜNG THUẬN AN – TP. HỒ CHÍ MINH',
      schoolYear: '2026 – 2027',
      className: defaultClassName(ageGroupId),
      teacherName: 'Nguyễn Thị Bé Diệu',
      coTeacherName: 'Trần Thị Minh Thư',
      principalName: 'Nguyễn Thị Thủy',
      students,
    },
    timetable: buildDefaultTimetable(ageGroupId),
    endOfYearMtCodes: gradeObjs.map((o) => o.code),
    nonObjectiveActivitiesNote:
      'Đón trẻ đầu năm học, làm quen nề nếp sinh hoạt lớp, tổ chức Ngày hội đến trường, Vui Tết Trung thu, Chào mừng 20/11, Vui Xuân đón Tết và Tổng kết năm học.',
    themes,
  };
}
