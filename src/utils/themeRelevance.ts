import { normVN } from './helpers';

interface ThemeGroup {
  id: string;
  triggers: string[];
  keywords: string[];
  seasonal?: boolean;
}

const PRESCHOOL_THEME_GROUPS: ThemeGroup[] = [
  {
    id: 'toys',
    triggers: ['do choi', 'do dung do choi'],
    keywords: ['do choi', 'bup be', 'qua bong', 'xep chong', 'khoi go', 'xau hat', 'lap rap', 'cat do choi', 'chia se do choi', 'bong bay', 'thu bong', 'o to do choi', 'xep hinh'],
  },
  {
    id: 'school',
    triggers: ['truong mam non', 'ngay hoi den truong', 'lop hoc cua be', 'truong mau giao'],
    keywords: ['truong mam non', 'lop hoc', 'co giao', 'ban be', 'do choi', 'san truong', 'mau giao', 'di hoc', 'ky hieu ca nhan'],
  },
  {
    id: 'self',
    triggers: ['ban than', 'co the', 'toi la ai', 'be lon', 'giac quan'],
    keywords: ['ban than', 'co the', 'giac quan', 'khuon mat', 'doi tay', 'ban chan', 'doi mat', 'so thich', 'dieu be thich', 'tu phuc vu', 'suc khoe', 'dinh duong'],
  },
  {
    id: 'family',
    triggers: ['gia dinh', 'ngoi nha', 'nguoi than', 'bo me', 'ong ba'],
    keywords: ['gia dinh', 'bo me', 'ba me', 'ong ba', 'anh chi', 'nguoi than', 'ngoi nha', 'do dung gia dinh', 'yeu me', 'ca nha', 'chau yeu ba', 'giup me', 'bua com gia dinh'],
  },
  {
    id: 'career',
    triggers: ['nghe nghiep', 'nghe pho bien', 'chu bo doi', 'ngay 20/11', 'nha giao'],
    keywords: ['nghe nghiep', 'bac si', 'cong an', 'bo doi', 'nong dan', 'tho xay', 'ban hang', 'co giao', 'lai xe', 'dung cu nghe', 'san pham nghe'],
  },
  {
    id: 'animals',
    triggers: ['dong vat', 'con vat', 'the gioi dong vat', 'vat nuoi'],
    keywords: ['con vat', 'dong vat', 'vat nuoi', 'con ga', 'con meo', 'con cho', 'con ca', 'con tho', 'con vit', 'con voi', 'chim', 'buom', 'duoi nuoc', 'trong rung'],
  },
  {
    id: 'plants',
    triggers: ['thuc vat', 'cay xanh', 'hoa qua', 'vuon rau', 'the gioi thuc vat'],
    keywords: ['cay xanh', 'hoa qua', 'vuon rau', 'la cay', 'gieo hat', 'trai cay', 'bong hoa', 'mam xanh', 'thuc vat', 'cham soc cay'],
  },
  {
    id: 'tet',
    triggers: ['tet', 'mua xuan', 'banh chung', 'hoa dao', 'hoa mai'],
    keywords: ['ngay tet', 'mua xuan', 'sac xuan', 'hoa dao', 'hoa mai', 'banh chung', 'den long', 'tranh dong ho', 'mung tuoi', 'chuc tet', 'giao thua'],
    seasonal: true,
  },
  {
    id: 'midautumn',
    triggers: ['trung thu', 'ram thang 8', 'ruoc den'],
    keywords: ['trung thu', 'ruoc den', 'mua lan', 'chu cuoi', 'chi hang', 'banh nuong', 'banh deo', 'mam ngu qua'],
    seasonal: true,
  },
  {
    id: 'traffic',
    triggers: ['giao thong', 'phuong tien', 'duong bo', 'duong thuy', 'duong hang khong'],
    keywords: ['giao thong', 'phuong tien', 'o to', 'xe dap', 'xe may', 'tau hoa', 'may bay', 'thuyen', 'den do', 'den xanh', 'den vang', 'nga tu', 'mu bao hiem', 'luat giao thong', 'bien bao', 'duong bo', 'duong thuy', 'vo lang'],
  },
  {
    id: 'nature',
    triggers: ['hien tuong tu nhien', 'mua he', 'thoi tiet', 'nang mua', 'nuoc va'],
    keywords: ['hien tuong tu nhien', 'thoi tiet', 'cau vong', 'mua he', 'tiet kiem nuoc', 'chim noi', 'mat troi', 'ngay va dem', 'nang mua'],
  },
  {
    id: 'homeland',
    triggers: ['que huong', 'dat nuoc', 'bac ho', 'thu do', 'viet nam'],
    keywords: ['que huong', 'dat nuoc', 'bac ho', 'viet nam', 'ha noi', 'lang bac', 'co do sao vang', 'danh lam'],
    seasonal: true,
  },
  {
    id: 'primary',
    triggers: ['tieu hoc', 'lop 1', 'chia tay'],
    keywords: ['tieu hoc', 'lop 1', 'cap sach', 'bang den', 'chia tay', 'ra truong'],
    seasonal: true,
  },
];

// Loại toàn bộ từ đơn chung chung để KHÔNG BAO GIỜ gắn nhầm "Khớp chủ đề" tràn lan
const STOP_WORDS = new Set([
  'cua', 'cho', 'voi', 'cac', 'nhung', 'chu', 'de', 'nhanh', 'tuan', 'be', 'tre', 'em', 'lop',
  'va', 'o', 'trong', 've', 'mot', 'so', 'do', 'choi', 'duong', 'bo', 'thich', 'quen', 'than',
  'yeu', 'vui', 'dep', 'ngoan', 'lon', 'nho', 'hay', 'tot', 'phuong', 'tien', 'ngay', 'thang',
  'quanh', 'dieu', 'ky', 'nha', 'con', 'vat', 'cung', 'hoc', 'hoat', 'dong', 'nguoi', 'khi',
]);

function hasWordBoundaryPhrase(haystack: string, phrase: string): boolean {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`).test(haystack);
}

export function extractPlanMonthNumber(isoDate?: string): number | null {
  if (!isoDate || !isoDate.includes('-')) return null;
  const m = Number(isoDate.split('-')[1]);
  return m >= 1 && m <= 12 ? m : null;
}

export function extractPlanMonthLabel(isoDate?: string): string {
  const m = extractPlanMonthNumber(isoDate);
  return m ? `Tháng ${m}` : '';
}

export interface ThemeRelevanceResult {
  score: number;
  matchesTheme: boolean;
  matchesMonth: boolean;
  isSeasonalConflict: boolean;
}

/**
 * Chấm điểm chính xác mức độ khớp Chủ đề & Tháng của Mục tiêu / Đề tài so với kế hoạch tuần.
 * - Dùng ranh giới từ nghiêm ngặt + cụm từ chủ đề có nghĩa (không khớp nhầm từ đơn chung chung như "đồ", "chơi", "đường", "bộ").
 * - Ưu tiên rõ rệt "Đúng Tháng X" (+40) để MT đúng tháng luôn đứng trước MT tháng khác.
 * - Phạt nặng các bài lễ hội lệch mùa (VD: Tết / Trung thu khi đang soạn Giao thông hay Gia đình).
 */
export function scoreThemeRelevance(
  candidateText: string,
  planThemeName: string,
  planSubThemeName = '',
  itemMonth = '',
  planStartDate = ''
): ThemeRelevanceResult {
  const planHay = normVN(`${planThemeName} ${planSubThemeName}`);
  const itemHay = normVN(candidateText);

  const activeGroups = PRESCHOOL_THEME_GROUPS.filter((g) =>
    g.triggers.some((t) => hasWordBoundaryPhrase(planHay, t))
  );

  let themeScore = 0;
  let strongPhraseHits = 0;

  // 1. Exact phrase matching from active preschool theme group(s)
  for (const g of activeGroups) {
    for (const kw of g.keywords) {
      if (hasWordBoundaryPhrase(itemHay, kw)) {
        const isMultiWord = kw.includes(' ');
        themeScore += isMultiWord ? 26 : 14;
        if (isMultiWord) strongPhraseHits += 1;
      }
    }
  }

  // 2. Direct significant token/bigram overlap from plan theme (only when no theme group matched OR extra boost)
  const rawTokens = planHay
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const uniqueTokens = Array.from(new Set(rawTokens));
  let directHits = 0;
  for (const tk of uniqueTokens) {
    if (hasWordBoundaryPhrase(itemHay, tk)) {
      directHits += 1;
      themeScore += 12;
    }
  }

  // 3. Penalize obvious off-season/holiday conflicts
  const activeGroupIds = new Set(activeGroups.map((g) => g.id));
  let isSeasonalConflict = false;
  let penalty = 0;
  for (const g of PRESCHOOL_THEME_GROUPS) {
    if (!g.seasonal || activeGroupIds.has(g.id)) continue;
    const conflictHits = g.keywords.filter((kw) => hasWordBoundaryPhrase(itemHay, kw)).length;
    if (conflictHits >= 1) {
      isSeasonalConflict = true;
      penalty += 55 * conflictHits;
    }
  }

  // 4. Month matching (strong weight so exact month clearly outranks neighboring months!)
  let monthScore = 0;
  let matchesMonth = false;
  const planMonth = extractPlanMonthNumber(planStartDate);
  const itemMonthNorm = normVN(itemMonth);
  if (planMonth && itemMonthNorm) {
    if (new RegExp(`thang\\s*0?${planMonth}\\b`).test(itemMonthNorm)) {
      matchesMonth = true;
      monthScore += 42;
    } else if (itemMonthNorm.includes('xuyen suot') || itemMonthNorm.includes('ca nam')) {
      monthScore += 10;
    }
  }

  // Strict threshold so "Khớp chủ đề" ONLY appears when genuinely relevant!
  const matchesTheme =
    !isSeasonalConflict &&
    (strongPhraseHits >= 1 || themeScore >= 24 || directHits >= 2);

  return {
    score: themeScore + monthScore - penalty,
    matchesTheme,
    matchesMonth,
    isSeasonalConflict,
  };
}

/**
 * Tạo 5 nội dung Quan sát ngoài trời đa dạng, không lặp 1 câu giống nhau giữa 5 ngày,
 * bám sát Chủ đề nhánh của tuần mới.
 */
export function buildThemeOutdoorObservations(subThemeName: string): [string, string, string, string, string] {
  const cleanSub = (subThemeName || 'chủ đề tuần').trim();
  return [
    `Quan sát thời tiết buổi sáng, trò chuyện gợi mở về chủ đề “${cleanSub}”.`,
    `Dạo chơi quanh sân trường, quan sát cây xanh, vườn hoa và môi trường gần gũi.`,
    `Quan sát tranh ảnh, mô hình trực quan gắn với “${cleanSub}” và nêu nhận xét của bé.`,
    `Chăm sóc góc thiên nhiên của lớp (tưới cây, lau lá, nhặt lá vàng bỏ vào thùng rác).`,
    `Quan sát đồ chơi ngoài trời, vẽ phấn tự do trên sân và chia sẻ điều bé thích trong tuần.`,
  ];
}
