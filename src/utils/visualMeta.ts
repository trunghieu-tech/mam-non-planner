import { normVN } from './helpers';

export interface DomainVisual {
  key: 'PTTC' | 'PTNT' | 'PTNN' | 'PT_TCKNXH' | 'PTTM';
  short: string;
  label: string;
  borderClass: string;
  badgeClass: string;
  pillActiveClass: string;
  dotClass: string;
  mtBadgeClass: string;
}

export const DOMAIN_VISUALS: DomainVisual[] = [
  {
    key: 'PTTC',
    short: 'Thể chất',
    label: 'Phát triển Thể chất',
    borderClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    pillActiveClass: 'bg-emerald-600 text-white border-emerald-600',
    dotClass: 'bg-emerald-500',
    mtBadgeClass: 'bg-emerald-600 text-white',
  },
  {
    key: 'PTNT',
    short: 'Nhận thức',
    label: 'Phát triển Nhận thức',
    borderClass: 'border-l-sky-500',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    pillActiveClass: 'bg-sky-600 text-white border-sky-600',
    dotClass: 'bg-sky-500',
    mtBadgeClass: 'bg-sky-600 text-white',
  },
  {
    key: 'PTNN',
    short: 'Ngôn ngữ',
    label: 'Phát triển Ngôn ngữ',
    borderClass: 'border-l-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    pillActiveClass: 'bg-amber-600 text-white border-amber-600',
    dotClass: 'bg-amber-500',
    mtBadgeClass: 'bg-amber-600 text-white',
  },
  {
    key: 'PT_TCKNXH',
    short: 'TC – KNXH',
    label: 'Tình cảm & KNXH',
    borderClass: 'border-l-rose-500',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    pillActiveClass: 'bg-rose-600 text-white border-rose-600',
    dotClass: 'bg-rose-500',
    mtBadgeClass: 'bg-rose-600 text-white',
  },
  {
    key: 'PTTM',
    short: 'Thẩm mỹ',
    label: 'Phát triển Thẩm mỹ',
    borderClass: 'border-l-violet-500',
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
    pillActiveClass: 'bg-violet-600 text-white border-violet-600',
    dotClass: 'bg-violet-500',
    mtBadgeClass: 'bg-violet-600 text-white',
  },
];

export function getDomainVisual(domain: string): DomainVisual {
  const d = normVN(domain);
  if (d.includes('the chat')) return DOMAIN_VISUALS[0];
  if (d.includes('nhan thuc')) return DOMAIN_VISUALS[1];
  if (d.includes('ngon ngu')) return DOMAIN_VISUALS[2];
  if (d.includes('tinh cam') || d.includes('xa hoi')) return DOMAIN_VISUALS[3];
  if (d.includes('tham my')) return DOMAIN_VISUALS[4];
  return DOMAIN_VISUALS[0];
}

export interface SubjectVisual {
  label: string;
  chipClass: string;
  accentBg: string;
}

export function getSubjectVisual(subjectOrType: string): SubjectVisual {
  const s = normVN(subjectOrType);
  if (s.includes('gdan') || s.includes('am nhac')) {
    return {
      label: 'Âm nhạc (GDAN)',
      chipClass: 'bg-violet-100 text-violet-800 border-violet-200',
      accentBg: 'bg-violet-50/70',
    };
  }
  if (s.includes('tao hinh')) {
    return {
      label: 'Tạo hình',
      chipClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
      accentBg: 'bg-fuchsia-50/70',
    };
  }
  if (s.includes('ptvd') || s.includes('the duc') || s.includes('van dong')) {
    return {
      label: 'Vận động (PTVĐ)',
      chipClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accentBg: 'bg-emerald-50/70',
    };
  }
  if (s.includes('lqvt') || s.includes('toan')) {
    return {
      label: 'Làm quen Toán',
      chipClass: 'bg-sky-100 text-sky-800 border-sky-200',
      accentBg: 'bg-sky-50/70',
    };
  }
  if (s.includes('mtxq') || s.includes('kham pha') || s.includes('kpkh') || s.includes('kpxh') || s.includes('nbtn')) {
    return {
      label: 'Khám phá (MTXQ)',
      chipClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      accentBg: 'bg-cyan-50/70',
    };
  }
  if (s.includes('lqvh') || s.includes('van hoc') || s.includes('tho') || s.includes('truyen')) {
    return {
      label: 'Văn học (LQVH)',
      chipClass: 'bg-amber-100 text-amber-800 border-amber-200',
      accentBg: 'bg-amber-50/70',
    };
  }
  if (s.includes('lqcc') || s.includes('chu cai')) {
    return {
      label: 'Chữ cái (LQCC)',
      chipClass: 'bg-orange-100 text-orange-800 border-orange-200',
      accentBg: 'bg-orange-50/70',
    };
  }
  if (s.includes('kns') || s.includes('ky nang') || s.includes('le giao')) {
    return {
      label: 'Kỹ năng sống',
      chipClass: 'bg-rose-100 text-rose-800 border-rose-200',
      accentBg: 'bg-rose-50/70',
    };
  }
  if (s.includes('ngoai troi') || s.includes('hdnt')) {
    return {
      label: 'HĐ Ngoài trời',
      chipClass: 'bg-lime-100 text-lime-800 border-lime-200',
      accentBg: 'bg-lime-50/70',
    };
  }
  if (s.includes('goc')) {
    return {
      label: 'HĐ Góc',
      chipClass: 'bg-teal-100 text-teal-800 border-teal-200',
      accentBg: 'bg-teal-50/70',
    };
  }
  return {
    label: subjectOrType || 'Hoạt động',
    chipClass: 'bg-slate-100 text-slate-700 border-slate-200',
    accentBg: 'bg-slate-50',
  };
}

export const FIVE_CORNERS = [
  'Góc phân vai',
  'Góc xây dựng',
  'Góc nghệ thuật',
  'Góc học tập – Thư viện',
  'Góc thiên nhiên',
] as const;

/**
 * Kiểm tra chính xác 1 hoạt động (từ 345 MT Excel) có thuộc đúng môn học đang chọn hay không.
 * Ưu tiên kiểm tra chặt theo nhãn `act.type` chuẩn Excel + từ khóa có dấu tiếng Việt (không dùng substring mờ như 'hat'/'ve').
 */
export function activityMatchesSubject(actType: string, actText: string, subjectCode: string): boolean {
  const t = normVN(actType || '');
  const low = (actText || '').toLowerCase();
  switch (subjectCode) {
    case 'PTVĐ':
      return t.includes('ptvd') || t.includes('the duc') || t.includes('tro choi van dong');
    case 'GDAN':
      return (
        t.includes('am nhac') ||
        t.includes('gdan') ||
        (!t.includes('tao hinh') &&
          (low.includes('dạy hát') ||
            low.includes('nghe hát') ||
            low.includes('vận động theo nhạc') ||
            low.includes('trò chơi âm nhạc')))
      );
    case 'Tạo hình':
      return (
        t.includes('tao hinh') ||
        (!t.includes('am nhac') &&
          !t.includes('sinh hoat') &&
          !t.includes('gdan') &&
          (low.includes('tạo hình') ||
            /(^|[\s,.:;(\-“"])(vẽ|nặn|xé dán|cắt dán|tô màu)\b/i.test(low)))
      );
    case 'LQVT':
      return (
        t.includes('lqvt') ||
        t.includes('toan') ||
        low.includes('số lượng') ||
        low.includes('chữ số') ||
        low.includes('tách gộp') ||
        low.includes('đếm đến') ||
        low.includes('hình tròn') ||
        low.includes('hình vuông') ||
        low.includes('đo độ dài') ||
        low.includes('quy tắc sắp xếp')
      );
    case 'MTXQ':
      return (
        t.includes('kpkh') ||
        t.includes('kpxh') ||
        t.includes('mtxq') ||
        t.includes('nbtn') ||
        t.includes('nbpb') ||
        t.includes('trai nghiem') ||
        t.includes('steam')
      );
    case 'LQVH':
      return (
        t.includes('lqvh') ||
        t.includes('van hoc') ||
        low.includes('bài thơ') ||
        low.includes('đọc thơ') ||
        low.includes('kể chuyện') ||
        low.includes('truyện ')
      );
    case 'LQCC':
      return (
        t.includes('lqcc') ||
        low.includes('chữ cái') ||
        low.includes('tập tô') ||
        low.includes('đồ nét') ||
        low.includes('sao chép chữ')
      );
    case 'KNS':
      return (
        t.includes('kns') ||
        t.includes('ky nang') ||
        t.includes('sinh hoat') ||
        t.includes('cham soc') ||
        t.includes('le giao')
      );
    default:
      return true;
  }
}

/**
 * Kiểm tra 1 Mục tiêu (ObjectiveItem) có khớp chặt cả Lĩnh vực phát triển lẫn Môn học cụ thể hay không.
 */
export function objectiveMatchesSubject(
  obj: { ageGroupId?: string; domain: string; subGroup?: string; description: string; eduContent?: string; activities: Array<{ type: string; text: string }> },
  subjectCode: string
): boolean {
  const dom = normVN(obj.domain || '');
  // Nhà trẻ (24–36T) gộp Thẩm mỹ (MT41 Âm nhạc, MT42 Tạo hình) vào "IV. Tình cảm & KNXH"
  const isNhaTreCombined =
    (obj.ageGroupId === 'NHA_TRE_24_36T' && dom.includes('tinh cam')) ||
    (dom.includes('tinh cam') && dom.includes('tham my'));

  // 1. Cổng lọc Lĩnh vực phát triển bắt buộc (không bao giờ để PTVĐ/Vệ sinh lọt vào GDAN, Tạo hình, LQVT!)
  switch (subjectCode) {
    case 'PTVĐ':
      if (!dom.includes('the chat')) return false;
      break;
    case 'GDAN':
    case 'Tạo hình':
      if (!dom.includes('tham my') && !isNhaTreCombined) return false;
      break;
    case 'LQVT':
    case 'MTXQ':
      if (!dom.includes('nhan thuc')) return false;
      break;
    case 'LQVH':
    case 'LQCC':
      if (!dom.includes('ngon ngu')) return false;
      break;
    case 'KNS':
      if (!dom.includes('tinh cam') && !dom.includes('the chat')) return false;
      break;
  }

  // 2. Nếu có ít nhất 1 hoạt động chuẩn thuộc đúng môn này -> khớp 100%!
  if (obj.activities.some((a) => activityMatchesSubject(a.type, a.text, subjectCode))) {
    return true;
  }

  // Nếu mục tiêu thuộc Thẩm mỹ nhưng chỉ có HĐ học của môn kia (VD: chỉ có Âm nhạc khi đang chọn Tạo hình) -> loại!
  if (subjectCode === 'GDAN' && obj.activities.some((a) => normVN(a.type).includes('tao hinh'))) {
    return false;
  }
  if (subjectCode === 'Tạo hình' && obj.activities.some((a) => normVN(a.type).includes('am nhac'))) {
    return false;
  }

  // 3. Fallback kiểm tra mô tả MT bằng từ khóa tiếng Việt CÓ DẤU + ranh giới từ (không khớp 'phát' với 'hát'!)
  const low = `${obj.description} ${obj.eduContent || ''}`.toLowerCase();
  switch (subjectCode) {
    case 'PTVĐ':
      return low.includes('vận động') || low.includes('thể dục') || low.includes('thăng bằng') || /(^|[\s,])(bật|bò|ném|chạy|trèo)\s/i.test(low);
    case 'GDAN':
      return /(^|[\s,.:;(\-“"])(hát|âm nhạc|giai điệu|nhạc cụ|vận động theo nhạc)/i.test(low);
    case 'Tạo hình':
      return /(^|[\s,.:;(\-“"])(tạo hình|vẽ|nặn|xé dán|cắt dán|tô màu|xếp hình)/i.test(low);
    case 'LQVT':
      return low.includes('đếm') || low.includes('số lượng') || low.includes('chữ số') || low.includes('tách gộp') || low.includes('hình học') || low.includes('khối cầu') || low.includes('đo độ dài') || low.includes('quy tắc');
    case 'MTXQ':
      return !(low.includes('chữ số') || low.includes('tách gộp') || low.includes('đo độ dài') || low.includes('số lượng'));
    case 'LQVH':
      return low.includes('thơ') || low.includes('truyện') || low.includes('kể chuyện') || low.includes('đồng dao') || low.includes('diễn cảm');
    case 'LQCC':
      return low.includes('chữ cái') || low.includes('đọc') || low.includes('viết') || low.includes('tập tô') || low.includes('sao chép');
    case 'KNS':
      return dom.includes('tinh cam') || low.includes('vệ sinh') || low.includes('an toàn') || low.includes('tự phục vụ') || low.includes('nguy hiểm') || low.includes('rửa tay');
    default:
      return true;
  }
}
