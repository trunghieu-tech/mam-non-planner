import type { AgeGroupId, DomainKey, ExerciseMove, LessonPlan, LessonStep, ObjectiveItem } from '../../shared/types';
import { normVN } from './helpers';
import { findMatchingWork } from './worksLookup';

export interface SubjectMeta {
  code: string;
  shortLabel: string;
  fullTitle: string;
  domainKey: DomainKey;
  domainTitle: string;
  rhythm: 'ACTIVE' | 'CALM';
  pedagogySummary: string;
}

export const SUBJECT_CATALOG: SubjectMeta[] = [
  {
    code: 'PTVĐ',
    shortLabel: 'Thể dục (PTVĐ)',
    fullTitle: 'HOẠT ĐỘNG THỂ DỤC GIỜ HỌC',
    domainKey: 'PTTC',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN THỂ CHẤT',
    rhythm: 'ACTIVE',
    pedagogySummary: 'Khởi động → BTPTC → VĐCB (đội hình) → TCVĐ → Hồi tỉnh',
  },
  {
    code: 'GDAN',
    shortLabel: 'Âm nhạc (GDAN)',
    fullTitle: 'HOẠT ĐỘNG ÂM NHẠC',
    domainKey: 'PTTM',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ',
    rhythm: 'ACTIVE',
    pedagogySummary: 'Ổn định → Dạy hát / VĐTN → Nghe hát → Trò chơi âm nhạc',
  },
  {
    code: 'Tạo hình',
    shortLabel: 'Tạo hình',
    fullTitle: 'HOẠT ĐỘNG TẠO HÌNH',
    domainKey: 'PTTM',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN THẨM MỸ',
    rhythm: 'CALM',
    pedagogySummary: 'Ổn định → Quan sát mẫu → Làm mẫu/gợi ý → Trẻ thực hiện → Trưng bày',
  },
  {
    code: 'LQVH',
    shortLabel: 'Văn học (LQVH)',
    fullTitle: 'HOẠT ĐỘNG LÀM QUEN VĂN HỌC',
    domainKey: 'PTNN',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ',
    rhythm: 'CALM',
    pedagogySummary: 'Ổn định → Đọc/kể lần 1 & 2 → Đàm thoại trích dẫn → Trẻ đọc/kể',
  },
  {
    code: 'LQCC',
    shortLabel: 'Chữ cái (LQCC)',
    fullTitle: 'HOẠT ĐỘNG LÀM QUEN CHỮ CÁI',
    domainKey: 'PTNN',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ',
    rhythm: 'CALM',
    pedagogySummary: 'Ôn chữ cũ → Làm quen chữ/nét mới → So sánh → Trò chơi & Tập tô',
  },
  {
    code: 'LQVT',
    shortLabel: 'Làm quen Toán',
    fullTitle: 'HOẠT ĐỘNG LÀM QUEN VỚI TOÁN',
    domainKey: 'PTNT',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC',
    rhythm: 'CALM',
    pedagogySummary: 'Ôn cũ → Dạy kiến thức mới trên đồ vật → Trò chơi luyện tập → Thực hành',
  },
  {
    code: 'MTXQ',
    shortLabel: 'Khám phá (MTXQ)',
    fullTitle: 'HOẠT ĐỘNG KHÁM PHÁ KHOA HỌC – XÃ HỘI',
    domainKey: 'PTNT',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC',
    rhythm: 'ACTIVE',
    pedagogySummary: 'Gây hứng thú → Trải nghiệm/quan sát nhóm → Thảo luận → Trò chơi củng cố',
  },
  {
    code: 'KNS',
    shortLabel: 'Kỹ năng sống',
    fullTitle: 'HOẠT ĐỘNG GIÁO DỤC KỸ NĂNG XÃ HỘI',
    domainKey: 'PT_TCKNXH',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN TÌNH CẢM – XÃ HỘI',
    rhythm: 'ACTIVE',
    pedagogySummary: 'Tình huống gợi mở → Thảo luận xử lý → Thực hành đóng vai → Củng cố',
  },
  {
    code: 'STEAM',
    shortLabel: 'STEAM (5E / EDP)',
    fullTitle: 'HOẠT ĐỘNG GIÁO DỤC STEAM (MÔ HÌNH 5E / QUY TRÌNH EDP)',
    domainKey: 'PTNT',
    domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC – TÍCH HỢP STEAM',
    rhythm: 'ACTIVE',
    pedagogySummary: '5E (Gắn kết → Khám phá → Giải thích → Áp dụng → Đánh giá) hoặc EDP (Hỏi → Tưởng tượng → Bản vẽ → Chế tạo → Cải tiến)',
  },
];

export function getSubjectsForAgeGroup(ageGroupId: AgeGroupId): SubjectMeta[] {
  if (ageGroupId === 'NHA_TRE_24_36T') {
    return [
      SUBJECT_CATALOG[0], // PTVĐ
      {
        code: 'NBTN',
        shortLabel: 'Nhận biết tập nói',
        fullTitle: 'HOẠT ĐỘNG NHẬN BIẾT TẬP NÓI (NBTN)',
        domainKey: 'PTNN',
        domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ',
        rhythm: 'ACTIVE',
        pedagogySummary: 'Gây hứng thú → Quan sát gọi tên đồ vật → Tập nói câu ngắn → Trò chơi nhận biết',
      },
      {
        code: 'NBPB',
        shortLabel: 'HĐ đồ vật / NBPB',
        fullTitle: 'HOẠT ĐỘNG VỚI ĐỒ VẬT & NHẬN BIẾT PHÂN BIỆT',
        domainKey: 'PTNT',
        domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC',
        rhythm: 'CALM',
        pedagogySummary: 'Tạo hứng thú → Thao tác với đồ vật → Nhận biết màu sắc/kích thước → Trò chơi',
      },
      SUBJECT_CATALOG[3], // LQVH (Thơ - Truyện)
      SUBJECT_CATALOG[1], // GDAN
      SUBJECT_CATALOG[2], // Tạo hình
      SUBJECT_CATALOG[7], // KNS / Tự phục vụ
    ];
  }
  if (ageGroupId === 'MAM_3_4T') {
    return SUBJECT_CATALOG.filter((s) => s.code !== 'LQCC');
  }
  return SUBJECT_CATALOG;
}

export function resolveSubjectMeta(subjectCodeOrHint: string): SubjectMeta {
  const s = normVN(subjectCodeOrHint || '');
  if (s === 'nbtn') {
    return {
      code: 'NBTN',
      shortLabel: 'Nhận biết tập nói',
      fullTitle: 'HOẠT ĐỘNG NHẬN BIẾT TẬP NÓI (NBTN)',
      domainKey: 'PTNN',
      domainTitle: 'LĨNH VỰC PHÁT TRIỂN NGÔN NGỮ',
      rhythm: 'ACTIVE',
      pedagogySummary: 'Gây hứng thú → Quan sát gọi tên đồ vật → Tập nói câu ngắn → Trò chơi nhận biết',
    };
  }
  if (s === 'nbpb' || s === 'hdvdv') {
    return {
      code: 'NBPB',
      shortLabel: 'HĐ đồ vật / NBPB',
      fullTitle: 'HOẠT ĐỘNG VỚI ĐỒ VẬT & NHẬN BIẾT PHÂN BIỆT',
      domainKey: 'PTNT',
      domainTitle: 'LĨNH VỰC PHÁT TRIỂN NHẬN THỨC',
      rhythm: 'CALM',
      pedagogySummary: 'Tạo hứng thú → Thao tác với đồ vật → Nhận biết màu sắc/kích thước → Trò chơi',
    };
  }
  if (s.includes('steam') || s.includes('stem') || s.includes('5e') || s.includes('edp') || s.includes('thi nghiem')) return SUBJECT_CATALOG[8];
  if (s.includes('ptvd') || s.includes('the duc') || s.includes('van dong')) return SUBJECT_CATALOG[0];
  if (s.includes('gdan') || s.includes('am nhac') || s.includes('hat')) return SUBJECT_CATALOG[1];
  if (s.includes('tao hinh') || s.includes('ve') || s.includes('nan') || s.includes('xe dan')) return SUBJECT_CATALOG[2];
  if (s.includes('lqvh') || s.includes('van hoc') || s.includes('tho') || s.includes('truyen')) return SUBJECT_CATALOG[3];
  if (s.includes('lqcc') || s.includes('chu cai') || s.includes('tap to')) return SUBJECT_CATALOG[4];
  if (s.includes('lqvt') || s.includes('toan') || s.includes('dem') || s.includes('chu so')) return SUBJECT_CATALOG[5];
  if (s.includes('mtxq') || s.includes('kham pha') || s.includes('kpkh') || s.includes('kpxh') || s.includes('nbtn')) return SUBJECT_CATALOG[6];
  if (s.includes('kns') || s.includes('ky nang') || s.includes('ttvs') || s.includes('ldvs')) return SUBJECT_CATALOG[7];
  return SUBJECT_CATALOG[6];
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Làm gọn tên đề tài khi ghép vào câu văn mẫu sư phạm để không bao giờ bị lặp chữ
 * (VD: không bị `đề tài “Đề tài "Khám phá..."”` hay `tác phẩm “Dạy trẻ đọc thơ "Đôi mắt..."”`).
 */
function cleanTopicForSentence(raw: string): string {
  let s = (raw || '').trim();
  s = s.replace(/^(?:đề\s*tài|hoạt\s*động|dạy\s*trẻ\s*(?:đọc\s*thơ|kể\s*chuyện|hát|vẽ|nặn|tô\s*màu)|tổ\s*chức\s*cho\s*trẻ)\s*[:\-–]?\s*/i, '');
  s = s.replace(/^[“"']+|[”"'.]+$/g, '').trim();
  return s || raw.trim();
}

export function buildPedagogicalSteps(
  subjectCode: string,
  topicTitle: string,
  ageGroupId?: AgeGroupId
): {
  preparation: string[];
  steps: LessonStep[];
  extraDiagramHtml?: string;
} {
  const meta = resolveSubjectMeta(subjectCode);
  const cleanTitle = cleanTopicForSentence(topicTitle);
  const titleNorm = normVN(topicTitle);
  const isNhaTre = ageGroupId === 'NHA_TRE_24_36T';

  switch (meta.code) {
    case 'PTVĐ': {
      // BẮT BUỘC kiểm tra có dấu tiếng Việt để "bắt bóng" KHÔNG BAO GIỜ bị nhầm thành "bật nhảy"!
      const isJump = /(bật|nhảy|qua suối|qua rào|từ trên cao)/i.test(topicTitle);
      if (isNhaTre) {
        return {
          preparation: [
            'Sân tập / sàn lớp rộng rãi, sạch sẽ, an toàn; dụng cụ mềm phù hợp tay cầm của trẻ 24–36 tháng.',
            'Nhạc thiếu nhi vui tươi, tiết tấu vừa phải.',
          ],
          steps: [
            {
              title: 'Hoạt động 1: Khởi động nhẹ nhàng',
              details: [
                'Cô dắt trẻ đi vòng tròn nhẹ nhàng theo tiếng nhạc vui (đi thường, đi nhanh chậm cùng cô) rồi đứng thành vòng tròn rộng quanh cô.',
              ],
            },
            {
              title: 'Hoạt động 2: Bài tập phát triển chung (BTPTC – 2 lần × 4 nhịp)',
              details: [
                'Tay: Hai tay đưa ra trước, giơ lên cao (2 lần × 4 nhịp).',
                'Bụng: Đứng cúi gập người chạm gối (2 lần × 4 nhịp).',
                'Chân: Ngồi xuống – đứng lên nhẹ nhàng (2 lần × 4 nhịp).',
              ],
            },
            {
              title: 'Hoạt động 3: Vận động cơ bản (VĐCB): ' + cleanTitle,
              details: [
                isJump
                  ? 'Cô làm mẫu chậm, rõ từng động tác (chuẩn bị, nhún bật nhẹ và tiếp đất an toàn), vừa làm vừa trò chuyện tạo hứng thú cho trẻ.'
                  : 'Cô làm mẫu chậm, rõ ràng và gần gũi để trẻ quan sát cách phối hợp tay – chân – mắt thực hiện vận động.',
                'Cô mời lần lượt từng trẻ (hoặc từng cặp 2 bé) lên thực hiện cùng cô 2–3 lượt; cô đứng sát hỗ trợ, cầm tay giúp trẻ nhút nhát và vỗ tay khen ngợi kịp thời.',
              ],
            },
            {
              title: 'Hoạt động 4: Trò chơi vận động nhẹ & Hồi tỉnh',
              details: [
                'Tổ chức trò chơi vận động đơn giản quen thuộc (VD: Bóng tròn to / Trời nắng trời mưa) 2–3 lượt vui vẻ.',
                'Cho trẻ đi nhẹ nhàng 1 vòng thả lỏng, vỗ tay khen bé ngoan và vào lớp.',
              ],
            },
          ],
        };
      }
      return {
        preparation: [
          'Sân tập sạch sẽ, thoáng mát, an toàn; vạch chuẩn và dụng cụ tập phù hợp đề tài.',
          'Nhạc không lời sôi động cho phần khởi động, trọng động và nhạc nhẹ cho phần hồi tỉnh.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Khởi động',
            details: [
              'Cô cho trẻ đi vòng tròn kết hợp các kiểu đi (đi thường, đi mũi bàn chân, đi gót chân, chạy chậm, chạy nhanh rồi đi thường) theo nền nhạc, sau đó chuyển đội hình 3–4 hàng ngang giãn cách đều.',
            ],
          },
          {
            title: 'Hoạt động 2: Trọng động – a) Bài tập phát triển chung (BTPTC)',
            details: [
              'Tay: Hai tay đưa ra trước, lên cao (2 lần × 8 nhịp).',
              'Bụng: Đứng cúi gập người về phía trước (2 lần × 8 nhịp).',
              'Chân: Ngồi khuỵu gối (4 lần × 8 nhịp – nhấn mạnh nhóm cơ bổ trợ).',
              'Bật: Bật tách khép chân tại chỗ (2 lần × 8 nhịp).',
            ],
          },
          {
            title: 'Hoạt động 2: Trọng động – b) Vận động cơ bản (VĐCB): ' + cleanTitle,
            details: [
              'Chuyển đội hình 2 hàng ngang đứng đối diện nhau cách nhau 3–4m.',
              isJump
                ? 'Cô làm mẫu lần 1 trọn vẹn (không giải thích), lần 2 kết hợp phân tích rõ tư thế chuẩn bị, nhịp bật nhún và cách tiếp đất nhẹ nhàng, an toàn bằng mũi bàn chân.'
                : 'Cô làm mẫu lần 1 trọn vẹn (không giải thích), lần 2 kết hợp phân tích rõ tư thế chuẩn bị và cách phối hợp tay – chân – mắt nhịp nhàng, đúng kỹ thuật.',
              'Mời 2 trẻ khá lên thực hiện thử; cả lớp quan sát nhận xét.',
              'Tổ chức cho lần lượt từng đôi trẻ thực hiện 2–3 lượt; cô bao quát sửa sai kỹ thuật, sau đó tổ chức thi đua giữa 2 đội.',
            ],
          },
          {
            title: 'Hoạt động 2: Trọng động – c) Trò chơi vận động (TCVĐ)',
            details: [
              'Cô giới thiệu tên trò chơi vận động, nêu rõ luật chơi và cách chơi.',
              'Tổ chức cho trẻ chơi 3–4 lượt hào hứng, đảm bảo an toàn và động viên kịp thời.',
            ],
          },
          {
            title: 'Hoạt động 3: Hồi tỉnh',
            details: [
              'Cho trẻ đi nhẹ nhàng 1–2 vòng quanh sân, vung tay hít thở sâu thả lỏng cơ thể rồi xếp hàng vào lớp.',
            ],
          },
        ],
        extraDiagramHtml: `
          <p style="text-align: center;"><em>Sơ đồ đội hình tập Vận động cơ bản (2 hàng ngang đối diện):</em></p>
          <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
          <p style="text-align: center;"><code>──────── [ Dụng cụ / Cô làm mẫu ] ────────</code></p>
          <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
        `,
      };
    }

    case 'GDAN': {
      const matchedSong = findMatchingWork(topicTitle, 'GDAN');
      return {
        preparation: [
          matchedSong
            ? `Nhạc beat bài hát “${matchedSong.title}” (sáng tác: ${matchedSong.author}), nhạc bài nghe hát và dụng cụ âm nhạc (phách tre, xắc xô, mũ chóp kín).`
            : 'Nhạc beat bài hát trọng tâm, nhạc bài nghe hát và dụng cụ âm nhạc (phách tre, xắc xô, mũ chóp kín cho TCAN).',
          'Không gian lớp học rộng rãi, bố trí đội hình chữ U thân thiện.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định tổ chức – Gây hứng thú',
            details: [
              'Cô trò chuyện ngắn hoặc mở một đoạn giai điệu quen thuộc gắn với chủ đề tuần để dẫn dắt giới thiệu đề tài “' + cleanTitle + '”.',
            ],
          },
          {
            title: 'Hoạt động 2: Nội dung trọng tâm – ' + cleanTitle,
            details: [
              matchedSong
                ? `Cô hát mẫu lần 1 diễn cảm (không nhạc), giới thiệu bài hát “${matchedSong.title}” – nhạc sĩ ${matchedSong.author}. Lời ca trọng tâm: “${matchedSong.contentText.replace(/\n+/g, ' / ')}”.`
                : 'Cô hát mẫu lần 1 diễn cảm (không nhạc) và giới thiệu tên bài hát, tên tác giả.',
              matchedSong && matchedSong.dialogueQuestions.length > 0
                ? `Cô hát mẫu lần 2 kết hợp nhạc đệm và đàm thoại: ${matchedSong.dialogueQuestions.join(' ')}`
                : 'Cô hát mẫu lần 2 kết hợp nhạc đệm và điệu bộ minh họa; đàm thoại ngắn giúp trẻ cảm nhận nội dung, giai điệu bài hát.',
              'Tổ chức dạy trẻ hát / vận động theo nhạc: Cả lớp (2–3 lần) → Luân phiên từng Tổ → Nhóm bạn trai/bạn gái → Cá nhân trẻ. Cô chú ý sửa sai nhịp, cao độ và khích lệ trẻ thể hiện sắc thái vui tươi.',
            ],
          },
          {
            title: 'Hoạt động 3: Nghe hát',
            details: [
              matchedSong?.educationalNote
                ? `Cô giới thiệu bài nghe hát kết hợp: ${matchedSong.educationalNote} Cô hát diễn cảm lần 1 cho trẻ thưởng thức trọn vẹn.`
                : 'Cô giới thiệu bài nghe hát phù hợp chủ đề, hát diễn cảm lần 1 cho trẻ thưởng thức trọn vẹn.',
              'Lần 2 cô hát kết hợp giao lưu, khuyến khích trẻ đung đưa, nhún nhảy hưởng ứng theo nhịp.',
            ],
          },
          {
            title: 'Hoạt động 4: Trò chơi âm nhạc (TCAN) & Kết thúc',
            details: [
              'Giới thiệu tên trò chơi (VD: Tai ai thính / Đoán tên bạn hát / Nghe tiếng hát tìm đồ vật), phổ biến luật chơi và tổ chức 3–4 lượt.',
              'Cô nhận xét, tuyên dương trẻ và chuyển tiếp nhẹ nhàng sang hoạt động kế tiếp.',
            ],
          },
        ],
      };
    }

    case 'LQVH': {
      const matchedLit = findMatchingWork(topicTitle, 'LQVH');
      const isPoem =
        matchedLit?.kind === 'POEM' ||
        (/(doc tho|bai tho|\btho\b|dong dao|ca dao)/.test(titleNorm) && !/(truyen|ke chuyen)/.test(titleNorm));
      const isStory = matchedLit?.kind === 'STORY' || (/(truyen|ke chuyen|chuyen)/.test(titleNorm) && !isPoem);
      return {
        preparation: [
          isPoem
            ? `Tranh minh họa trình chiếu / bộ tranh rời minh họa bài thơ${matchedLit ? ` “${matchedLit.title}” (${matchedLit.author})` : ''}.`
            : `Tranh minh họa trình chiếu / bộ tranh rời hoặc rối tay minh họa câu chuyện${matchedLit ? ` “${matchedLit.title}”` : ''}.`,
          'Nhạc nền nhẹ nhàng tạo cảm xúc lắng nghe.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định tổ chức – Gây hứng thú',
            details: [
              `Cô cho trẻ hát hoặc giải câu đố ngắn gắn với chủ đề để dẫn dắt giới thiệu ${isPoem ? 'bài thơ' : isStory ? 'câu chuyện' : 'tác phẩm'} “${cleanTitle}”${matchedLit ? ` (${matchedLit.author})` : ''}.`,
            ],
          },
          {
            title: isPoem
              ? 'Hoạt động 2: Cô đọc thơ diễn cảm'
              : isStory
              ? 'Hoạt động 2: Cô kể chuyện diễn cảm'
              : 'Hoạt động 2: Cô đọc thơ / kể chuyện diễn cảm',
            details: [
              isPoem
                ? 'Lần 1: Cô đọc diễn cảm bài thơ kết hợp ánh mắt, cử chỉ, ngắt nghỉ đúng nhịp; giới thiệu tên bài thơ, tên tác giả.'
                : 'Lần 1: Cô kể chuyện diễn cảm kết hợp giọng điệu phù hợp từng nhân vật; giới thiệu tên truyện, tên tác giả.',
              ...(matchedLit
                ? [
                    isPoem
                      ? `Nội dung bài thơ “${matchedLit.title}”: ${matchedLit.contentText.replace(/\n+/g, ' / ')}`
                      : `Tóm tắt diễn biến truyện “${matchedLit.title}”: ${matchedLit.contentText}`,
                  ]
                : []),
              isPoem
                ? 'Lần 2: Cô đọc lại kết hợp trình chiếu tranh minh họa để trẻ cảm nhận hình ảnh và ghi nhớ lời thơ.'
                : 'Lần 2: Cô kể lại kết hợp tranh minh họa / rối tay để trẻ nắm rõ trình tự diễn biến câu chuyện.',
            ],
          },
          {
            title: 'Hoạt động 3: Đàm thoại – Trích dẫn – Giảng từ khó',
            details:
              matchedLit && matchedLit.dialogueQuestions.length > 0
                ? [
                    ...matchedLit.dialogueQuestions.map((q, qi) => `Câu hỏi ${qi + 1}: ${q}`),
                    matchedLit.educationalNote ||
                      'Giải thích ngắn gọn các từ khó bằng hình ảnh trực quan và giáo dục thái độ lễ phép, yêu thương.',
                  ]
                : [
                    isPoem
                      ? 'Đặt hệ thống câu hỏi gợi mở từ dễ đến khó (Tên bài thơ? Trong bài có những hình ảnh nào? Câu thơ nào thể hiện tình cảm yêu thương?); cô trích dẫn câu thơ minh họa.'
                      : 'Đặt hệ thống câu hỏi gợi mở từ dễ đến khó (Tên câu chuyện? Trong truyện có những nhân vật nào? Điều gì xảy ra và nhân vật đã xử lý ra sao? Qua câu chuyện con học được điều gì?).',
                    'Giải thích ngắn gọn các từ khó bằng hình ảnh trực quan và giáo dục thái độ lễ phép, yêu thương.',
                  ],
          },
          {
            title: isPoem
              ? 'Hoạt động 4: Trẻ đọc thơ cùng cô & Kết thúc'
              : isStory
              ? 'Hoạt động 4: Trẻ kể lại truyện / đóng vai & Kết thúc'
              : 'Hoạt động 4: Trẻ đọc thơ / kể chuyện cùng cô & Kết thúc',
            details: [
              isPoem
                ? 'Tổ chức cho cả lớp, từng tổ, nhóm nhỏ và cá nhân đọc thơ diễn cảm nối tiếp nhau; cô sửa phát âm, ngắt nhịp và động viên trẻ đọc to, rõ ràng.'
                : 'Tổ chức cho trẻ tập kể lại từng đoạn truyện cùng cô hoặc đóng vai nhân vật; cô sửa ngọng và khuyến khích trẻ nói trọn câu.',
              'Nhận xét, tuyên dương và kết thúc tiết học.',
            ],
          },
        ],
      };
    }

    case 'LQVT':
      return {
        preparation: [
          'Bộ đồ dùng trực quan của cô (nhóm đối tượng, thẻ số/hình khối khổ lớn, bảng gắn).',
          'Mỗi trẻ 1 rổ đồ dùng thực hành giống cô (thẻ số, lô tô, nhóm đồ vật đủ số lượng) và phiếu bài tập.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định tổ chức & Ôn kiến thức cũ',
            details: [
              'Tổ chức trò chơi khởi động nhanh (VD: Tìm nhóm bạn, Đếm nhanh đoán giỏi) giúp ôn lại biểu tượng toán đã học.',
            ],
          },
          {
            title: 'Hoạt động 2: Dạy kiến thức mới – ' + topicTitle,
            details: [
              'Cô hướng dẫn trẻ xếp đồ dùng từ trái sang phải, thao tác đếm / xếp tương ứng 1–1 / so sánh trực tiếp trên đồ vật thật.',
              'Đặt câu hỏi gợi mở giúp trẻ tự phát hiện mối quan hệ toán học, đặt thẻ số tương ứng và đọc to kết quả (lớp – tổ – cá nhân).',
            ],
          },
          {
            title: 'Hoạt động 3: Trò chơi luyện tập củng cố',
            details: [
              'Trò chơi 1 (Trò chơi tĩnh): Thi chọn nhanh thẻ số / ghép cặp theo yêu cầu của cô.',
              'Trò chơi 2 (Trò chơi động): Tìm đúng nhà / Về đúng đội theo số lượng hoặc hình dạng quy định.',
            ],
          },
          {
            title: 'Hoạt động 4: Thực hành phiếu bài tập & Kết thúc',
            details: [
              'Hướng dẫn trẻ làm bài tập ngắn trong vở/phiếu; cô bao quát hỗ trợ trẻ chậm, nhận xét tuyên dương và thu dọn đồ dùng.',
            ],
          },
        ],
      };

    case 'Tạo hình':
      if (isNhaTre) {
        return {
          preparation: [
            '1–2 sản phẩm mẫu đơn giản, màu sắc tươi sáng của cô để thu hút trẻ 24–36 tháng.',
            'Đất nặn mềm an toàn / bút sáp to / giấy vẽ khổ lớn và khăn ẩm lau tay đủ cho mỗi trẻ.',
          ],
          steps: [
            {
              title: 'Hoạt động 1: Ổn định – Gây hứng thú',
              details: [
                `Cô trò chuyện thân mật, cho trẻ chơi vận động nhẹ các ngón tay để dẫn dắt vào hoạt động “${cleanTitle}”.`,
              ],
            },
            {
              title: 'Hoạt động 2: Quan sát mẫu & Cô làm mẫu đơn giản',
              details: [
                'Cô cho trẻ quan sát sản phẩm mẫu, chỉ gọi tên màu sắc cơ bản (đỏ, xanh, vàng) và hình dạng quen thuộc.',
                'Cô làm mẫu chậm từng thao tác đơn giản (bóp mềm, lăn dọc / cầm sáp di màu / chấm màu) kết hợp lời nói nhẹ nhàng, vui vẻ.',
              ],
            },
            {
              title: 'Hoạt động 3: Trẻ thực hành trải nghiệm & Trưng bày',
              details: [
                'Cô cho trẻ ngồi thoải mái thực hành theo hứng thú; cô đến từng trẻ hỗ trợ, cầm tay giúp trẻ còn lúng túng và động viên liên tục.',
                'Khen ngợi sản phẩm của tất cả các bé, trưng bày ở góc sản phẩm của lớp và lau tay sạch sẽ.',
              ],
            },
          ],
        };
      }
      return {
        preparation: [
          '2–3 sản phẩm mẫu của cô đa dạng màu sắc/bố cục; giá trưng bày sản phẩm.',
          'Giấy A4, sáp màu / đất nặn / giấy màu / hồ dán / khăn lau tay đủ cho mỗi trẻ; nhạc không lời nhẹ.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định – Gây hứng thú',
            details: [
              'Cô tạo tình huống gợi mở (triển lãm tranh, món quà bất ngờ...) dẫn dắt vào đề tài “' + cleanTitle + '”.',
            ],
          },
          {
            title: 'Hoạt động 2: Quan sát vật mẫu & Đàm thoại ý tưởng',
            details: [
              'Cho trẻ quan sát sản phẩm mẫu; đàm thoại về màu sắc, hình dáng, bố cục và chất liệu tạo nên sản phẩm.',
              'Hỏi ý định của trẻ (Con định làm gì? Chọn màu gì? Sắp xếp bố cục thế nào?).',
            ],
          },
          {
            title: 'Hoạt động 3: Cô làm mẫu / Gợi ý kỹ năng tạo hình',
            details: [
              'Cô làm mẫu các thao tác kỹ thuật trọng tâm kết hợp giải thích chậm rãi, nhấn mạnh tư thế ngồi ngay ngắn và cách cầm bút/dụng cụ đúng.',
            ],
          },
          {
            title: 'Hoạt động 4: Trẻ thực hiện sản phẩm',
            details: [
              'Mở nhạc nhẹ cho trẻ thực hiện; cô đi từng bàn bao quát, gợi ý cho trẻ sáng tạo thêm chi tiết và hỗ trợ cầm tay hướng dẫn trẻ còn lúng túng.',
            ],
          },
          {
            title: 'Hoạt động 5: Trưng bày – Nhận xét sản phẩm & Kết thúc',
            details: [
              'Cho trẻ mang sản phẩm lên giá trưng bày; mời 2–3 trẻ giới thiệu sản phẩm mình thích và sản phẩm của bản thân.',
              'Cô nhận xét chung mang tính động viên, khen ngợi sự sáng tạo của trẻ và cất dọn đồ dùng sạch sẽ.',
            ],
          },
        ],
      };

    case 'LQCC': {
      const matchedLqcc = findMatchingWork(topicTitle, 'LQCC');
      return {
        preparation: [
          'Thẻ chữ cái / nét cơ bản khổ lớn, tranh từ chứa chữ cái; bảng từ, hộp thẻ chữ rời cho mỗi trẻ.',
          'Vở tập tô, bút chì đúng chuẩn và bàn ghế đúng chiều cao.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định – Ôn chữ cái đã học',
            details: [
              'Chơi trò chơi ngắn tìm nhanh thẻ chữ đã học xung quanh lớp hoặc qua bài hát bảng chữ cái.',
            ],
          },
          {
            title: 'Hoạt động 2: Làm quen chữ cái / nét mới – ' + cleanTitle,
            details: [
              'Cho trẻ quan sát tranh chứa từ và thẻ chữ rời; cô phát âm mẫu chuẩn 3 lần.',
              'Cho cả lớp, tổ, nhóm, cá nhân phát âm; cô lắng nghe sửa ngọng kịp thời.',
              matchedLqcc
                ? `Phân tích cấu tạo nét chữ chi tiết: ${matchedLqcc.contentText.replace(/\n+/g, ' ')}`
                : 'Phân tích cấu tạo các nét của chữ cái; giới thiệu chữ in hoa, in thường, viết thường.',
            ],
          },
          {
            title: 'Hoạt động 3: So sánh nét giống & khác nhau',
            details:
              matchedLqcc && matchedLqcc.dialogueQuestions.length > 0
                ? matchedLqcc.dialogueQuestions
                : ['Cho trẻ tìm điểm giống và khác nhau giữa các chữ cái/nét trong bài để khắc sâu biểu tượng.'],
          },
          {
            title: 'Hoạt động 4: Trò chơi với chữ cái & Thực hành tập tô',
            details: [
              matchedLqcc?.educationalNote ||
                'Chơi trò chơi xếp hột hạt / tìm chữ cái còn thiếu trong từ; hướng dẫn trẻ ngồi đúng tư thế, cầm bút bằng 3 đầu ngón tay và thực hành tập tô.',
              'Hướng dẫn trẻ ngồi thẳng lưng, cầm bút bằng 3 đầu ngón tay và tô trùng khít theo chiều mũi tên trong vở tập tô.',
            ],
          },
        ],
      };
    }

    case 'KNS': {
      const topicNorm = normVN(topicTitle);
      const isSafetyTopic = /(dien|nguy hiem|an toan|phich nuoc|nuoc soi|ban la|dao keo|chay|duoi nuoc|nguoi la|lac|thuoc|leo treo)/.test(topicNorm);
      const isHygieneTopic = /(rua tay|danh rang|ve sinh|lau mat|suc mieng|cat giay|cat dep|mac ao|xuc an|tu phuc vu|gap quan ao)/.test(topicNorm);

      if (isSafetyTopic) {
        return {
          preparation: [
            `Tranh ảnh / video tình huống minh họa hành vi an toàn và nguy hiểm gắn với đề tài “${cleanTitle}”.`,
            'Bộ thẻ hình hành vi đúng – sai (kèm thẻ mặt cười / mặt mếu) cho trò chơi củng cố; mô hình đồ dùng mô phỏng an toàn (không dùng vật thật gây nguy hiểm).',
          ],
          steps: [
            {
              title: 'Hoạt động 1: Ổn định tổ chức – Tình huống gợi mở',
              details: [
                `Cô kể một tình huống ngắn hoặc cho trẻ xem đoạn tranh/video về bạn nhỏ gặp nguy hiểm liên quan đến “${cleanTitle}”.`,
                'Đặt câu hỏi gợi mở (Bạn nhỏ trong tranh đang làm gì? Điều đó có an toàn không? Vì sao?) để dẫn dắt vào bài học.',
              ],
            },
            {
              title: 'Hoạt động 2: Nhận biết nguy cơ & Cách phòng tránh an toàn',
              details: [
                `Cô cho trẻ quan sát lần lượt từng bức tranh tình huống về “${cleanTitle}”; giải thích rõ hậu quả nguy hiểm bằng ngôn ngữ gần gũi, dễ hiểu.`,
                'Cô hướng dẫn trẻ quy tắc an toàn cần ghi nhớ: tuyệt đối không tự ý chạm/lại gần vật nguy hiểm, biết tránh xa và gọi người lớn (ba mẹ, cô giáo) giúp đỡ ngay khi cần.',
              ],
            },
            {
              title: 'Hoạt động 3: Thực hành xử lý tình huống & Trò chơi củng cố',
              details: [
                'Mời từng nhóm trẻ thực hành đóng vai xử lý 2–3 tình huống giả định an toàn; cô nhận xét, khắc sâu kỹ năng tự bảo vệ.',
                'Trò chơi củng cố “Bé chọn đúng – sai”: trẻ chọn tranh hành vi an toàn gắn bảng mặt cười và gạch bỏ hành vi nguy hiểm; cô tuyên dương, kết thúc tiết học.',
              ],
            },
          ],
        };
      }

      if (isHygieneTopic) {
        return {
          preparation: [
            `Đồ dùng thực hành cá nhân đầy đủ, sạch sẽ phù hợp đề tài “${cleanTitle}” (xà phòng, khăn đúng ký hiệu / bàn chải / đồ dùng cá nhân).`,
            'Tranh minh họa từng bước quy trình thực hiện theo thứ tự rõ ràng.',
          ],
          steps: [
            {
              title: 'Hoạt động 1: Ổn định tổ chức – Gây hứng thú',
              details: [
                `Cô trò chuyện hoặc hát bài hát về vệ sinh, tự phục vụ để dẫn dắt giới thiệu đề tài “${cleanTitle}”.`,
              ],
            },
            {
              title: 'Hoạt động 2: Cô làm mẫu & Phân tích từng bước thực hiện',
              details: [
                'Cô làm mẫu trọn vẹn lần 1, sau đó làm mẫu chậm lần 2 kết hợp giải thích rõ ràng từng thao tác để trẻ dễ ghi nhớ.',
                'Mời 1–2 trẻ lên thực hiện mẫu trước lớp; cả lớp quan sát, nhận xét cùng cô.',
              ],
            },
            {
              title: 'Hoạt động 3: Trẻ thực hành kỹ năng & Củng cố',
              details: [
                'Chia trẻ thành các nhóm nhỏ lần lượt thực hành đúng quy trình; cô bao quát uốn nắn thao tác cho từng trẻ còn lúng túng.',
                'Nhận xét, khen ngợi trẻ thực hiện gọn gàng, sạch sẽ và nhắc trẻ duy trì thói quen tốt hằng ngày ở lớp cũng như ở nhà.',
              ],
            },
          ],
        };
      }

      return {
        preparation: [
          `Tranh ảnh / video tình huống giao tiếp ứng xử gắn với đề tài “${cleanTitle}”.`,
          'Bộ thẻ hành vi đúng – sai (mặt cười / mặt mếu) và đồ dùng đóng vai cho 3–4 nhóm nhỏ.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định tổ chức – Tình huống gợi mở',
            details: [
              `Cô tạo tình huống thực tế gần gũi hoặc kể câu chuyện ngắn dẫn dắt vào đề tài “${cleanTitle}”.`,
            ],
          },
          {
            title: 'Hoạt động 2: Thảo luận & Hướng dẫn cách ứng xử phù hợp',
            details: [
              'Cô đặt câu hỏi gợi mở giúp trẻ nhận xét hành vi nên làm và không nên làm trong từng tình huống.',
              'Cô khái quát lời nói, cử chỉ lịch sự/phù hợp và làm mẫu để trẻ quan sát.',
            ],
          },
          {
            title: 'Hoạt động 3: Thực hành đóng vai & Trò chơi củng cố',
            details: [
              'Mời từng cặp/nhóm trẻ lên đóng vai xử lý tình huống; cô động viên và khích lệ trẻ mạnh dạn.',
              'Tổ chức trò chơi chọn thẻ hành vi đúng – sai để củng cố bài học; cô nhận xét tuyên dương và kết thúc.',
            ],
          },
        ],
      };
    }

    default:
      // MTXQ / NBTN (Nhận biết tập nói cho Nhà trẻ vs Khám phá khoa học – xã hội cho Mẫu giáo)
      if (isNhaTre) {
        return {
          preparation: [
            `Đồ vật thật an toàn, cỡ lớn hoặc tranh ảnh rõ nét gắn với đề tài “${cleanTitle}”.`,
            'Rổ đồ chơi trực quan cho mỗi trẻ sờ, cầm nắm và gọi tên.',
          ],
          steps: [
            {
              title: 'Hoạt động 1: Ổn định – Gây hứng thú',
              details: [
                `Cô cho trẻ hát hoặc chơi trò chơi “Chiếc túi kỳ diệu” lấy ra đồ vật thật để giới thiệu đề tài “${cleanTitle}”.`,
              ],
            },
            {
              title: 'Hoạt động 2: Nhận biết – Tập nói cùng cô',
              details: [
                'Cô đưa từng đồ vật/tranh ảnh ra, phát âm mẫu to, rõ ràng tên gọi, màu sắc và công dụng đơn giản.',
                'Cho cả lớp, nhóm nhỏ và từng cá nhân trẻ chỉ vào đồ vật, lặp lại từ mới rõ tiếng; cô khích lệ và sửa phát âm nhẹ nhàng.',
              ],
            },
            {
              title: 'Hoạt động 3: Trò chơi củng cố “Tìm nhanh theo yêu cầu của cô” & Kết thúc',
              details: [
                'Cô gọi tên đồ vật/đặc điểm để trẻ chọn nhanh giơ lên và nói to tên; cô khen ngợi, vỗ tay động viên và thu dọn đồ chơi.',
              ],
            },
          ],
        };
      }
      return {
        preparation: [
          'Vật thật / tranh ảnh / video trực quan gắn với đề tài “' + cleanTitle + '”.',
          'Đồ dùng trải nghiệm cho 3–4 nhóm nhỏ và bộ thẻ lô tô phục vụ trò chơi củng cố.',
        ],
        steps: [
          {
            title: 'Hoạt động 1: Ổn định tổ chức – Gây hứng thú',
            details: [
              'Cô tạo tình huống thực tế hoặc câu đố vui gắn với chủ đề để dẫn dắt giới thiệu đề tài “' + cleanTitle + '”.',
            ],
          },
          {
            title: 'Hoạt động 2: Trẻ trực tiếp khám phá – Trải nghiệm theo nhóm',
            details: [
              'Chia trẻ thành 3–4 nhóm nhỏ cùng quan sát, sờ, thử nghiệm trực tiếp với đồ dùng/tình huống.',
              'Cô đặt câu hỏi gợi mở khuyến khích trẻ quan sát kỹ và trao đổi với bạn trong nhóm.',
            ],
          },
          {
            title: 'Hoạt động 3: Chia sẻ – Thảo luận & Cô khái quát kiến thức',
            details: [
              'Mời đại diện các nhóm trình bày điều vừa khám phá; cô tổng hợp, mở rộng liên hệ thực tế và giáo dục kỹ năng/thái độ phù hợp.',
            ],
          },
          {
            title: 'Hoạt động 4: Trò chơi củng cố & Kết thúc',
            details: [
              'Tổ chức trò chơi phân loại / chọn hành vi đúng – sai / ghép cặp theo nhóm; cô nhận xét tuyên dương và thu dọn đồ dùng.',
            ],
          },
        ],
      };

    case 'STEAM': {
      const isEdp = /(che tao|thiet ke|lam |lap rap|edp|mo hinh)/.test(normVN(topicTitle));
      if (isEdp) {
        return {
          preparation: [
            `Nguyên vật liệu mở cho dự án "${cleanTopicForSentence(topicTitle)}": Bìa carton, que kem, ống hút, giấy màu, kéo an toàn, keo sữa, băng dính, thước đo.`,
            'Giấy A3 & bút dạ cho từng nhóm vẽ bản thiết kế sơ phác; bàn trưng bày sản phẩm STEAM.',
          ],
          steps: [
            {
              title: 'Bước 1 (Ask – Đặt vấn đề / Xác định thử thách thực tế)',
              details: [
                `Cô đưa ra câu chuyện / tình huống có vấn đề gắn với đề tài "${cleanTopicForSentence(topicTitle)}" và thống nhất tiêu chí sản phẩm cần đạt (bền chắc, đúng công năng, thẩm mỹ).`,
              ],
            },
            {
              title: 'Bước 2 (Imagine – Tưởng tượng & Thảo luận giải pháp)',
              details: [
                'Trẻ thảo luận theo nhóm nhỏ, khám phá các vật liệu trên khay và đề xuất ý tưởng chế tạo sản phẩm.',
              ],
            },
            {
              title: 'Bước 3 (Plan – Lập kế hoạch & Vẽ bản thiết kế)',
              details: [
                'Đại diện nhóm phác thảo bản vẽ thiết kế trên giấy A3, phân công nhiệm vụ và lựa chọn nguyên vật liệu phù hợp.',
              ],
            },
            {
              title: 'Bước 4 (Create – Chế tạo sản phẩm theo bản thiết kế)',
              details: [
                'Các nhóm tiến hành đo, cắt, ghép nối, trang trí tạo sản phẩm theo bản vẽ; cô quan sát và đặt câu hỏi gợi mở hỗ trợ kỹ thuật.',
              ],
            },
            {
              title: 'Bước 5 (Improve – Thử nghiệm, Đánh giá & Cải tiến)',
              details: [
                'Trẻ kiểm thử sản phẩm trước lớp đối chiếu với tiêu chí ban đầu, chia sẻ điểm muốn cải tiến tốt hơn và thu dọn góc STEAM.',
              ],
            },
          ],
        };
      }
      return {
        preparation: [
          `Bộ học liệu khám phá "${cleanTopicForSentence(topicTitle)}" cho 3–4 nhóm: Khay trải nghiệm, kính lúp, vật mẫu thật, phiếu ghi chép quan sát bằng hình vẽ của trẻ.`,
          'Video/hình ảnh mở rộng hiện tượng thực tế, nhạc nhẹ khi trẻ làm thí nghiệm.',
        ],
        steps: [
          {
            title: 'Bước 1 (E1: Engage – Gắn kết & Khơi gợi tò mò)',
            details: [
              `Cô tạo tình huống bất ngờ liên quan đến "${cleanTopicForSentence(topicTitle)}", đặt câu hỏi dự đoán "Điều gì sẽ xảy ra?" để huy động hiểu biết ban đầu của trẻ.`,
            ],
          },
          {
            title: 'Bước 2 (E2: Explore – Trực tiếp Khám phá & Thử nghiệm)',
            details: [
              'Trẻ chia nhóm tự tay thao tác thí nghiệm, quan sát bằng đa giác quan và ghi nhận kết quả vào bảng ghi chép hình ảnh của nhóm.',
            ],
          },
          {
            title: 'Bước 3 (E3: Explain – Chia sẻ & Giải thích)',
            details: [
              'Các nhóm trình bày bảng ghi chép quan sát; cô đặt câu hỏi mở giúp trẻ tự rút ra bản chất khoa học (S) và mối liên hệ toán học/đo lường (M).',
            ],
          },
          {
            title: 'Bước 4 (E4: Elaborate – Áp dụng & Mở rộng thực tiễn)',
            details: [
              'Đặt thử thách mở rộng (thay đổi chất liệu/điều kiện) hoặc ứng dụng kiến thức vừa khám phá vào đời sống hằng ngày của trẻ.',
            ],
          },
          {
            title: 'Bước 5 (E5: Evaluate – Đánh giá & Tổng kết)',
            details: [
              'Trẻ tự đánh giá quá trình hợp tác nhóm; cô tổng kết kiến thức cốt lõi và khen ngợi các nhà khoa học nhí.',
            ],
          },
        ],
      };
    }
  }
}

export function lessonPlanToRichHtml(les: LessonPlan, indexLabel?: string): string {
  if (les.richHtml && les.richHtml.trim().length > 20) {
    return les.richHtml;
  }
  const meta = resolveSubjectMeta(les.subjectCode);
  const parts: string[] = [];
  parts.push(
    `<h3 style="text-align: center;">${indexLabel ? `${esc(indexLabel)}: ` : ''}${esc(les.subjectFullTitle)} — ${esc(les.topicTitle)}</h3>`
  );
  const metaLine = [
    les.domainTitle,
    les.subTopics?.length ? les.subTopics.join(' | ') : '',
    les.linkedMtCodes?.length ? `Mã MT: ${les.linkedMtCodes.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
  if (metaLine) {
    parts.push(`<p style="text-align: center;"><em>${esc(metaLine)}</em></p>`);
  }
  parts.push(`<p><strong>I. Mục đích – Yêu cầu:</strong></p>`);
  parts.push(`<ul>${(les.aims || []).filter((x) => x.trim()).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`);
  parts.push(`<p><strong>II. Chuẩn bị:</strong></p>`);
  parts.push(`<ul>${(les.preparation || []).filter((x) => x.trim()).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`);
  parts.push(`<p><strong>III. Tổ chức hoạt động:</strong></p>`);
  for (const st of les.steps || []) {
    parts.push(
      `<p><strong>* ${esc(st.title)}</strong></p><ul>${(st.details || []).filter((x) => x.trim()).map((dt) => `<li>${esc(dt)}</li>`).join('')}</ul>`
    );
  }
  if (meta.code === 'PTVĐ' && !parts.join('').includes('Sơ đồ đội hình')) {
    const built = buildPedagogicalSteps('PTVĐ', les.topicTitle);
    if (built.extraDiagramHtml) parts.push(built.extraDiagramHtml);
  }
  return parts.join('\n');
}

/**
 * Kiểm tra xem Mục tiêu (ObjectiveItem) có thực sự khớp ngữ nghĩa với tên đề tài hay không,
 * tránh trường hợp dữ liệu cũ gắn sai MT (VD: đề tài "Tránh xa các nguồn điện" bị gắn nhầm MT "Chào hỏi, cảm ơn").
 */
export function isObjectiveCompatibleWithTopic(topicTitle: string, obj?: ObjectiveItem): boolean {
  if (!obj) return false;
  const t = normVN(topicTitle);
  const o = normVN(`${obj.description} ${obj.eduContent || ''}`);

  const CONCEPT_GATES: Array<{ topicRe: RegExp; objRe: RegExp }> = [
    {
      topicRe: /(dien|o dien|nguon dien|phich nuoc|nuoc soi|ban la|dao keo|sac nhon|nguy hiem|chay|duoi nuoc|nguoi la|thuoc|leo treo|bao ve ban than|cho con|khong co nguoi lon)/,
      objRe: /(nguy hiem|an toan|tranh|dien|phich|dao|keo|ao|ho|thuoc|nguoi la|ung xu|tinh huong|dau|chay mau|phong benh)/,
    },
    {
      topicRe: /(rua tay|xa phong|danh rang|suc mieng|ve sinh|lau mat|cat giay|cat dep|cai cuc|tu phuc vu|xuc an)/,
      objRe: /(ve sinh|rua tay|danh rang|tu phuc vu|an uong|bat|thia|phong benh|suc khoe|giay dep|ba lo)/,
    },
    {
      topicRe: /(chao hoi|cam on|xin loi|le phep|khoanh tay)/,
      objRe: /(chao hoi|cam on|xin loi|le phep|giao tiep|ung xu|vang|da|thua)/,
    },
    {
      topicRe: /(to mau|ve tranh|nan |xe dan|cat dan|in hinh|tao hinh)/,
      objRe: /(ve|nan|xe|dan|to mau|cat|xep hinh|tao hinh|san pham|nghe thuat)/,
    },
  ];

  for (const gate of CONCEPT_GATES) {
    if (gate.topicRe.test(t) && !gate.objRe.test(o)) {
      return false;
    }
  }
  return true;
}

export function buildPedagogicalLessonPlan(opts: {
  topicTitle: string;
  subjectCode: string;
  ageGroupId?: AgeGroupId;
  slotType?: 'MAIN' | 'AFTERNOON';
  mtCode?: string;
  obj?: ObjectiveItem;
  subTopics?: string[];
}): LessonPlan {
  const meta = resolveSubjectMeta(opts.subjectCode);
  const { preparation, steps, extraDiagramHtml } = buildPedagogicalSteps(
    meta.code,
    opts.topicTitle,
    opts.ageGroupId
  );
  const validObj = isObjectiveCompatibleWithTopic(opts.topicTitle, opts.obj) ? opts.obj : undefined;
  const effectiveMtCode = validObj ? validObj.code : opts.obj ? '' : opts.mtCode || '';
  const cleanTitle = cleanTopicForSentence(opts.topicTitle);
  // CHỈ áp dụng mục tiêu/thái độ an toàn tai nạn cho môn KNS với các từ khóa nguy hiểm rõ ràng (không áp nhầm vào LQVH thơ, PTVĐ đèn giao thông, NBTN bát thìa!)
  const isSafetyTopic =
    meta.code === 'KNS' &&
    /(nguồn điện|ổ điện|điện giật|nguy hiểm|phích nước nóng|nước sôi|bàn là|dao kéo|sắc nhọn|đuối nước|người lạ|bảo vệ bản thân|phòng cháy|chó con|không có người lớn|leo trèo)/i.test(
      opts.topicTitle
    );

  const aims = [
    validObj
      ? `Kiến thức (Đạt ${validObj.code}): ${validObj.description}`
      : isSafetyTopic
      ? `Kiến thức: Trẻ nhận biết được mối nguy hiểm liên quan đến đề tài “${cleanTitle}” và biết quy tắc phòng tránh an toàn.`
      : `Kiến thức: Trẻ nắm được nội dung trọng tâm của đề tài “${cleanTitle}”.`,
    validObj?.eduContent
      ? `Kỹ năng: ${validObj.eduContent}`
      : isSafetyTopic
      ? `Kỹ năng: Rèn kỹ năng quan sát, phân biệt hành vi an toàn – nguy hiểm và biết cách tránh xa, gọi người lớn giúp đỡ kịp thời.`
      : `Kỹ năng: Rèn kỹ năng thực hành, quan sát và diễn đạt mạch lạc theo đúng đặc thù môn ${meta.shortLabel}.`,
    isSafetyTopic
      ? 'Thái độ: Trẻ có ý thức cẩn thận, tự bảo vệ bản thân, không tự ý nghịch các vật dụng/khu vực nguy hiểm và nghe lời người lớn.'
      : 'Thái độ: Trẻ hứng thú, tích cực tham gia hoạt động cùng cô và bạn; biết giữ gìn đồ dùng gọn gàng.',
  ];

  const isNhaTre = opts.ageGroupId === 'NHA_TRE_24_36T';
  const resolvedDomainTitle =
    isNhaTre && (meta.domainKey === 'PTTM' || meta.domainKey === 'PT_TCKNXH')
      ? 'LĨNH VỰC PHÁT TRIỂN TÌNH CẢM, KỸ NĂNG XÃ HỘI VÀ THẨM MỸ'
      : validObj && meta.code === 'KNS' && normVN(validObj.domain).includes('the chat')
      ? 'LĨNH VỰC PHÁT TRIỂN THỂ CHẤT (GIÁO DỤC SỨC KHỎE – AN TOÀN)'
      : meta.domainTitle;

  const base: LessonPlan = {
    id: `les_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    slotType: opts.slotType || 'MAIN',
    domainTitle: resolvedDomainTitle,
    subjectCode: isNhaTre && opts.subjectCode === 'NBTN' ? 'NBTN' : meta.code,
    subjectFullTitle:
      isNhaTre && (opts.subjectCode === 'NBTN' || meta.code === 'MTXQ')
        ? 'HOẠT ĐỘNG NHẬN BIẾT TẬP NÓI (NBTN)'
        : meta.fullTitle,
    topicTitle: opts.topicTitle,
    subTopics: opts.subTopics || [],
    linkedMtCodes: effectiveMtCode ? [effectiveMtCode] : [],
    aims,
    preparation,
    steps,
  };
  let html = lessonPlanToRichHtml(base);
  if (extraDiagramHtml && !html.includes('Sơ đồ đội hình')) {
    html += '\n' + extraDiagramHtml;
  }
  base.richHtml = html;
  return base;
}

// =========================================================================
// MẪU ĐOẠN SƯ PHẠM CHÈN NHANH 1 CHẠM KHÓA RIÊNG THEO TỪNG MÔN HỌC
// =========================================================================

export interface QuickSnippetBlock {
  id: string;
  label: string;
  desc: string;
  html: string;
}

export const SUBJECT_QUICK_SNIPPETS: Record<string, QuickSnippetBlock[]> = {
  PTVĐ: [
    {
      id: 'ptvd_2rows',
      label: 'Sơ đồ 2 hàng ngang đối diện',
      desc: 'Đội hình chuẩn tập Vận động cơ bản',
      html: `
        <p style="text-align: center;"><em>Sơ đồ đội hình 2 hàng ngang đối diện:</em></p>
        <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
        <p style="text-align: center;"><code>──────── [ Dụng cụ / Cô làm mẫu ] ────────</code></p>
        <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
      `,
    },
    {
      id: 'ptvd_circle',
      label: 'Sơ đồ vòng tròn Khởi động / TCVĐ',
      desc: 'Đội hình đi vòng tròn hoặc chơi TCVĐ',
      html: `
        <p style="text-align: center;"><em>Sơ đồ đội hình vòng tròn (Khởi động / TCVĐ):</em></p>
        <p style="text-align: center;"><code>&nbsp;&nbsp;&nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp;&nbsp;&nbsp;</code></p>
        <p style="text-align: center;"><code>X &nbsp;&nbsp;&nbsp;&nbsp; [ Cô ] &nbsp;&nbsp;&nbsp;&nbsp; X</code></p>
        <p style="text-align: center;"><code>&nbsp;&nbsp;&nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp;&nbsp;&nbsp;</code></p>
      `,
    },
    {
      id: 'ptvd_btptc',
      label: 'Khối 4 động tác BTPTC chuẩn',
      desc: 'Tay – Bụng – Chân – Bật nhấn mạnh bổ trợ',
      html: `
        <p><strong>* Bài tập phát triển chung (BTPTC):</strong></p>
        <ul>
          <li><strong>Tay:</strong> Hai tay đưa ra trước, sang ngang (2 lần × 8 nhịp).</li>
          <li><strong>Bụng:</strong> Đứng quay người sang hai bên (2 lần × 8 nhịp).</li>
          <li><strong>Chân:</strong> Ngồi khuỵu gối thẳng lưng (4 lần × 8 nhịp – bổ trợ VĐCB).</li>
          <li><strong>Bật:</strong> Bật tách khép chân tại chỗ (2 lần × 8 nhịp).</li>
        </ul>
      `,
    },
  ],
  GDAN: [
    {
      id: 'gdan_sing',
      label: 'Quy trình Dạy hát 4 lượt chuẩn',
      desc: 'Cả lớp → Tổ → Nhóm → Cá nhân + sửa sai',
      html: `
        <p><strong>* Tổ chức dạy trẻ hát:</strong></p>
        <ul>
          <li>Cả lớp hát cùng cô 2–3 lần theo nhịp đàn/nhạc đệm.</li>
          <li>Thi đua hát theo từng Tổ (Tổ 1, Tổ 2, Tổ 3); cô nhận xét sửa nhịp và cao độ.</li>
          <li>Nhóm bạn trai / bạn gái hát đối đáp; mời 1–2 cá nhân trẻ lên biểu diễn.</li>
        </ul>
      `,
    },
    {
      id: 'gdan_listen',
      label: 'Khối Nghe hát kết hợp giao lưu',
      desc: 'Nghe lần 1 thưởng thức → Lần 2 hưởng ứng',
      html: `
        <p><strong>* Nghe hát:</strong></p>
        <ul>
          <li>Lần 1: Cô giới thiệu tên bài hát, tác giả và hát diễn cảm trọn vẹn cho trẻ lắng nghe.</li>
          <li>Lần 2: Cô hát kết hợp múa minh họa / giao lưu cùng trẻ, khuyến khích trẻ đung đưa hưởng ứng theo điệu nhạc.</li>
        </ul>
      `,
    },
    {
      id: 'gdan_tcan',
      label: 'Trò chơi Âm nhạc “Tai ai thính”',
      desc: 'Luật chơi & tổ chức 3–4 lượt',
      html: `
        <p><strong>* Trò chơi âm nhạc: Tai ai thính</strong></p>
        <ul>
          <li><strong>Cách chơi:</strong> Mời 1 trẻ đội mũ chóp kín đứng giữa lớp; cô chỉ định 1 bạn hát 1 câu hoặc gõ dụng cụ âm nhạc, trẻ đội mũ lắng nghe và đoán đúng tên bạn/nhạc cụ.</li>
          <li>Tổ chức cho trẻ chơi 3–4 lượt vui vẻ, tuyên dương trẻ đoán đúng.</li>
        </ul>
      `,
    },
  ],
  LQVH: [
    {
      id: 'lqvh_qa',
      label: 'Hệ thống 5 câu hỏi Đàm thoại chuẩn',
      desc: 'Từ nhận biết nhân vật → hiểu ý nghĩa → liên hệ',
      html: `
        <p><strong>* Hệ thống câu hỏi đàm thoại – trích dẫn:</strong></p>
        <ul>
          <li>Cô vừa đọc bài thơ / kể câu chuyện gì? Do ai sáng tác?</li>
          <li>Trong tác phẩm có những nhân vật / hình ảnh nào nổi bật?</li>
          <li>Điều gì đã xảy ra và nhân vật đã xử lý như thế nào? (Cô trích dẫn câu thơ/đoạn truyện minh họa).</li>
          <li>Con thích nhất chi tiết nào? Vì sao?</li>
          <li>Qua tác phẩm này, chúng mình học được điều gì hay?</li>
        </ul>
      `,
    },
    {
      id: 'lqvh_role',
      label: 'Hoạt động Đóng kịch / Đọc nối tiếp',
      desc: 'Giúp trẻ ghi nhớ lời thoại & diễn cảm',
      html: `
        <p><strong>* Trẻ thực hành đọc diễn cảm / đóng vai:</strong></p>
        <ul>
          <li>Chia lớp thành 3 nhóm đọc nối tiếp nhau theo hiệu lệnh tay của cô.</li>
          <li>Mời nhóm trẻ đeo mũ nhân vật lên thể hiện lại đoạn đối thoại ngắn; cô khích lệ giọng đọc to, rõ, diễn cảm.</li>
        </ul>
      `,
    },
  ],
  LQVT: [
    {
      id: 'lqvt_game',
      label: 'Cặp Trò chơi Toán (Tĩnh + Động)',
      desc: 'Chọn thẻ số nhanh & Về đúng nhà',
      html: `
        <p><strong>* Trò chơi luyện tập củng cố:</strong></p>
        <ul>
          <li><strong>Trò chơi 1 (Tĩnh – Thi ai nhanh):</strong> Cô nêu yêu cầu hoặc giơ thẻ chấm tròn, trẻ nhanh tay giơ thẻ số / hình tương ứng và đọc to.</li>
          <li><strong>Trò chơi 2 (Động – Tìm đúng nhà):</strong> Trẻ cầm thẻ đi vòng tròn hát, khi có hiệu lệnh chạy thật nhanh về đúng ngôi nhà có số lượng/biểu tượng tương ứng.</li>
        </ul>
      `,
    },
    {
      id: 'lqvt_sheet',
      label: 'Hướng dẫn Thực hành phiếu bài tập',
      desc: 'Tô màu / nối nhóm số lượng tương ứng',
      html: `
        <p><strong>* Thực hành vở / phiếu bài tập:</strong></p>
        <ul>
          <li>Cô làm mẫu 1 bài trên bảng; nhắc trẻ tư thế ngồi ngay ngắn, cầm bút đúng cách.</li>
          <li>Trẻ thực hành nối nhóm đối tượng với chữ số tương ứng; cô quan sát hỗ trợ kịp thời.</li>
        </ul>
      `,
    },
  ],
  'Tạo hình': [
    {
      id: 'th_sample',
      label: 'Câu hỏi Đàm thoại vật mẫu',
      desc: 'Màu sắc – Hình dáng – Bố cục – Ý tưởng',
      html: `
        <p><strong>* Đàm thoại quan sát mẫu & gợi mở ý tưởng:</strong></p>
        <ul>
          <li>Con thấy bức tranh / sản phẩm mẫu có những chi tiết gì? Màu sắc ra sao?</li>
          <li>Để sản phẩm đẹp và cân đối, con sẽ đặt hình chính ở vị trí nào trên tờ giấy?</li>
          <li>Con dự định dùng kỹ năng gì (nét cong, tô đều không lem, xoay tròn, ấn dẹt...) để hoàn thiện sản phẩm của mình?</li>
        </ul>
      `,
    },
    {
      id: 'th_display',
      label: 'Khối Trưng bày & Nhận xét sản phẩm',
      desc: 'Cho trẻ tự giới thiệu & động viên sáng tạo',
      html: `
        <p><strong>* Trưng bày và nhận xét sản phẩm:</strong></p>
        <ul>
          <li>Cho trẻ mang sản phẩm gắn lên bảng trưng bày của lớp.</li>
          <li>Mời 2–3 trẻ nhận xét sản phẩm con thích nhất (về màu sắc, bố cục, độ gọn gàng) và mời tác giả chia sẻ ý tưởng.</li>
          <li>Cô nhận xét khích lệ chung, khen ngợi các sản phẩm sáng tạo và động viên trẻ hoàn thiện tốt hơn vào giờ chiều.</li>
        </ul>
      `,
    },
  ],
  MTXQ: [
    {
      id: 'mtxq_group',
      label: 'Tổ chức Trải nghiệm 3 nhóm khám phá',
      desc: 'Quan sát giác quan + thảo luận nhóm nhỏ',
      html: `
        <p><strong>* Khám phá theo nhóm nhỏ (3 nhóm):</strong></p>
        <ul>
          <li>Chia lớp thành 3 nhóm, mỗi nhóm nhận khay vật thật / bộ tranh khám phá.</li>
          <li>Trẻ trực tiếp quan sát, sờ, so sánh đặc điểm nổi bật và trao đổi cùng bạn trong 4–5 phút.</li>
          <li>Đại diện từng nhóm lên chia sẻ phát hiện của nhóm mình; cô tổng hợp và bổ sung kiến thức chuẩn xác.</li>
        </ul>
      `,
    },
  ],
  LQCC: [
    {
      id: 'lqcc_trace',
      label: 'Hướng dẫn Tư thế & Tập tô chữ cái',
      desc: 'Tư thế ngồi, cách cầm bút 3 đầu ngón tay',
      html: `
        <p><strong>* Thực hành tập tô:</strong></p>
        <ul>
          <li>Nhắc trẻ ngồi lưng thẳng, không tỳ ngực vào bàn, đầu hơi cúi, tay trái giữ mép vở, tay phải cầm bút bằng 3 đầu ngón tay.</li>
          <li>Tô trùng khít lên nét chấm mờ theo đúng chiều mũi tên; cô đi từng bàn uốn nắn trẻ còn lúng túng.</li>
        </ul>
      `,
    },
  ],
  KNS: [
    {
      id: 'kns_role',
      label: 'Tình huống Đóng vai xử lý thực tế',
      desc: 'Đặt tình huống → Trẻ tự chọn cách ứng xử',
      html: `
        <p><strong>* Xử lý tình huống & Thực hành đóng vai:</strong></p>
        <ul>
          <li>Cô đưa ra 2 tình huống gần gũi thường gặp ở lớp/nhà; hỏi trẻ: “Nếu là con, con sẽ làm gì?”.</li>
          <li>Mời từng cặp trẻ lên đóng vai thực hành cách ứng xử lịch sự, an toàn; cả lớp cổ vũ và rút ra bài học ghi nhớ.</li>
        </ul>
      `,
    },
  ],
};

// =========================================================================
// KHO MẪU CHỌN NHANH 1 CHẠM CHO KHỐI DÙNG CHUNG & ĐÁNH GIÁ CUỐI NGÀY
// =========================================================================

export const MORNING_EXERCISE_PRESETS: Record<string, ExerciseMove[]> = {
  'Hô hấp': [
    { group: 'Hô hấp', name: 'Thở 1: Gà gáy ò ó o (2 lần × 8 nhịp)', steps: 'Hai tay khum trước miệng, hít sâu rồi kéo dài tiếng gà gáy.' },
    { group: 'Hô hấp', name: 'Thở 2: Thổi bóng bay (2 lần × 8 nhịp)', steps: 'Đứng chân chữ V, hít vào bằng mũi, thở ra chậm phồng má thổi bóng.' },
    { group: 'Hô hấp', name: 'Thở 3: Ngửi hoa thơm (2 lần × 8 nhịp)', steps: 'Đưa tay hứng hoa, hít sâu bằng mũi rồi thở nhẹ nhàng ra bằng miệng.' },
  ],
  Tay: [
    { group: 'Tay', name: 'Tay 1: Hai tay đưa ra trước, lên cao, hạ xuống (2 lần × 8 nhịp)', steps: 'Lòng bàn tay hướng vào nhau, lưng thẳng.' },
    { group: 'Tay', name: 'Tay 2: Hai tay đưa sang ngang, gập khuỷu tay vào vai (2 lần × 8 nhịp)', steps: 'Đưa tay ngang vai rồi chạm nhẹ đầu ngón tay lên vai.' },
    { group: 'Tay', name: 'Tay 3: Quay cổ tay, cuộn tròn trước ngực (2 lần × 8 nhịp)', steps: 'Xoay đều hai cẳng tay theo nhịp nhạc.' },
  ],
  Bụng: [
    { group: 'Bụng', name: 'Bụng 1: Đứng cúi gập người chạm mũi chân (4 lần × 8 nhịp)', steps: 'Hai chân rộng bằng vai, đầu gối thẳng, cúi gập người.' },
    { group: 'Bụng', name: 'Bụng 2: Đứng nghiêng người sang hai bên (2 lần × 8 nhịp)', steps: 'Hai tay chống hông, nghiêng luân phiên sang trái – phải.' },
    { group: 'Bụng', name: 'Bụng 3: Đứng quay người sang hai bên (2 lần × 8 nhịp)', steps: 'Hai tay dang ngang, xoay thân trên sang trái – phải.' },
  ],
  Chân: [
    { group: 'Chân', name: 'Chân 1: Ngồi khuỵu gối (2 lần × 8 nhịp)', steps: 'Hai tay đưa ra trước, khuỵu gối lưng thẳng.' },
    { group: 'Chân', name: 'Chân 2: Bước 1 chân ra trước khuỵu gối (2 lần × 8 nhịp)', steps: 'Chân trước khuỵu, chân sau thẳng, đổi chân.' },
    { group: 'Chân', name: 'Chân 3: Đứng kiễng gót chân (2 lần × 8 nhịp)', steps: 'Hai tay chống hông, nhón cao gót chân giữ thăng bằng.' },
  ],
  Bật: [
    { group: 'Bật', name: 'Bật 1: Bật tiến về trước (2 lần × 8 nhịp)', steps: 'Hai tay chống hông, bật chụm chân tiếp đất nhẹ bằng mũi bàn chân.' },
    { group: 'Bật', name: 'Bật 2: Bật tách khép chân tại chỗ (2 lần × 8 nhịp)', steps: 'Nhịp 1 bật tách chân rộng bằng vai, nhịp 2 bật khép chân.' },
    { group: 'Bật', name: 'Bật 3: Bật luân phiên chân trước chân sau (2 lần × 8 nhịp)', steps: 'Nhún nhẹ bật đổi chân theo nhịp xắc xô.' },
  ],
};

export const OUTDOOR_GAME_PRESETS = {
  TCVD: [
    'TCVĐ: Lộn cầu vồng',
    'TCVĐ: Mèo đuổi chuột',
    'TCVĐ: Chuyền bóng qua đầu',
    'TCVĐ: Cáo và Thỏ',
    'TCVĐ: Bật qua suối nhỏ',
    'TCVĐ: Kéo co đồng đội',
  ],
  TCDG: [
    'TCDG: Chi chi chành chành',
    'TCDG: Rồng rắn lên mây',
    'TCDG: Nu na nu nống',
    'TCDG: Dung dăng dung dẻ',
    'TCDG: Kéo cưa lừa xẻ',
    'TCDG: Bịt mắt bắt dê',
  ],
};

export const DAILY_EVAL_PRESETS = {
  health: [
    'Sĩ số đầy đủ, 100% trẻ đi học khỏe mạnh, ăn hết suất, ngủ ngon giấc.',
    'Vắng ... trẻ (có phép); các trẻ đi học khỏe mạnh, ăn ngủ tốt, vệ sinh sạch sẽ.',
    'Lưu ý theo dõi sức khỏe bé ... hơi sổ mũi nhẹ, đã trao đổi phụ huynh cuối ngày.',
  ],
  emotion: [
    'Đa số trẻ vui vẻ, hào hứng tham gia hoạt động, biết chào hỏi lễ phép và chơi đoàn kết.',
    'Trẻ thực hiện tốt nề nếp lớp, biết tự cất đồ dùng và chờ đến lượt khi chơi.',
    'Cần tiếp tục động viên bé ... mạnh dạn giao tiếp và chia sẻ đồ chơi cùng bạn.',
  ],
  knowledge: [
    'Khoảng 90% trẻ nắm vững kiến thức, kỹ năng trọng tâm của bài học và trả lời trọn câu.',
    'Trẻ tích cực thực hành, hoàn thành tốt sản phẩm; tổ chức ôn luyện thêm vào giờ chiều cho nhóm trẻ chậm.',
    'Cần rèn thêm kỹ năng ... cho bé ... vào hoạt động chiều ngày hôm sau.',
  ],
};
