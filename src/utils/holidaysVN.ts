export interface SchoolDateMarker {
  label: string;
  isDayOff: boolean; // true = nghỉ lễ chính thức (không xếp tiết chính), false = sự kiện/lễ hội trường
}

/**
 * Nhận diện tự động Ngày nghỉ Lễ chính thức & Ngày sự kiện mầm non lớn theo ngày dương lịch (YYYY-MM-DD)
 * để cảnh báo / hỗ trợ cô đánh dấu nghỉ lễ ngay trên Lịch tuần.
 */
export function detectSchoolHolidayOrEvent(isoDate: string): SchoolDateMarker | null {
  if (!isoDate || !isoDate.includes('-')) return null;
  const [, m, d] = isoDate.split('-');
  const md = `${m}-${d}`;

  // Các ngày nghỉ Lễ chính thức theo Bộ luật Lao động
  if (md === '01-01') return { label: 'Nghỉ Tết Dương lịch (01/01)', isDayOff: true };
  if (md === '09-02') return { label: 'Nghỉ Lễ Quốc khánh (02/09)', isDayOff: true };
  if (md === '04-30') return { label: 'Nghỉ Lễ Giải phóng miền Nam (30/04)', isDayOff: true };
  if (md === '05-01') return { label: 'Nghỉ Ngày Quốc tế Lao động (01/05)', isDayOff: true };
  // Giỗ Tổ Hùng Vương 10/3 ÂL năm 2027 rơi vào 16/04/2027 (năm 2026 rơi vào 26/04/2026)
  if (isoDate === '2027-04-16' || isoDate === '2026-04-27') {
    return { label: 'Nghỉ Lễ Giỗ Tổ Hùng Vương (10/3 ÂL)', isDayOff: true };
  }
  // Nghỉ Tết Nguyên đán Đinh Mùi 2027 (khoảng đầu tháng 02/2027)
  if (isoDate >= '2027-02-04' && isoDate <= '2027-02-12') {
    return { label: 'Nghỉ Tết Nguyên đán cổ truyền', isDayOff: true };
  }

  // Các ngày Lễ hội / Sự kiện đặc trưng trong trường mầm non (vẫn đón trẻ, tổ chức hoạt động lễ hội)
  if (md === '09-05') return { label: 'Ngày Hội đến trường của Bé (05/09)', isDayOff: false };
  if (md === '10-20') return { label: 'Ngày Phụ nữ Việt Nam (20/10)', isDayOff: false };
  if (md === '11-20') return { label: 'Ngày Nhà giáo Việt Nam (20/11)', isDayOff: false };
  if (md === '12-22') return { label: 'Ngày thành lập QĐND Việt Nam (22/12)', isDayOff: false };
  if (md === '03-08') return { label: 'Ngày Quốc tế Phụ nữ (08/03)', isDayOff: false };
  if (md === '05-19') return { label: 'Kỷ niệm Ngày sinh Bác Hồ (19/05)', isDayOff: false };
  if (md === '06-01') return { label: 'Ngày Quốc tế Thiếu nhi (01/06)', isDayOff: false };

  return null;
}
