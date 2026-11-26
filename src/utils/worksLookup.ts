import type { AgeGroupId, LiteraryWorkItem } from '../../shared/types';
import rawCorpus from '../data/worksCorpus.json';
import { normVN } from './helpers';

export const WORKS_CORPUS: LiteraryWorkItem[] = [...(rawCorpus as LiteraryWorkItem[])];

export function setWorksCorpusFromServer(items: LiteraryWorkItem[] | undefined | null): void {
  if (Array.isArray(items) && items.length > 0) {
    WORKS_CORPUS.splice(0, WORKS_CORPUS.length, ...items);
  }
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tìm tác phẩm Thơ / Truyện / Bài hát / Nhóm chữ cái LQCC khớp với tên đề tài tiết học
 * để tự động điền toàn văn tác phẩm, cấu tạo nét chữ và hệ thống câu hỏi đàm thoại riêng!
 */
export function findMatchingWork(topicTitle: string, subjectCode: string): LiteraryWorkItem | undefined {
  if (!topicTitle) return undefined;
  const hay = normVN(topicTitle);
  const subj = normVN(subjectCode);

  const allowedKinds = new Set<LiteraryWorkItem['kind']>();
  if (subj.includes('lqcc') || subj.includes('chu cai')) {
    allowedKinds.add('LQCC');
  } else if (subj.includes('gdan') || subj.includes('am nhac')) {
    allowedKinds.add('SONG');
  } else if (subj.includes('lqvh') || subj.includes('van hoc')) {
    allowedKinds.add('POEM');
    allowedKinds.add('STORY');
  } else {
    allowedKinds.add('POEM');
    allowedKinds.add('STORY');
    allowedKinds.add('SONG');
    allowedKinds.add('LQCC');
  }

  // For LQCC, match exact accented letter group (e.g. "o, ô, ơ" vs "b, d, đ")
  if (allowedKinds.has('LQCC') && allowedKinds.size === 1) {
    const lowRaw = topicTitle.toLowerCase();
    for (const w of WORKS_CORPUS) {
      if (w.kind !== 'LQCC') continue;
      const lettersPart = w.title.replace(/^làm quen nhóm chữ cái\s*/i, '').trim().toLowerCase();
      if (lettersPart && lowRaw.includes(lettersPart)) {
        return w;
      }
    }
  }

  let best: LiteraryWorkItem | undefined;
  let bestLen = 0;

  for (const w of WORKS_CORPUS) {
    if (!allowedKinds.has(w.kind)) continue;
    const wTitleNorm = normVN(w.title);
    if (wTitleNorm.length >= 4 && hay.includes(wTitleNorm) && wTitleNorm.length > bestLen) {
      best = w;
      bestLen = wTitleNorm.length;
    }
  }
  return best;
}

export function filterWorksForAssistant(
  subjectCode: string,
  ageGroupId: AgeGroupId | 'ALL',
  search = ''
): LiteraryWorkItem[] {
  const subj = normVN(subjectCode);
  const q = normVN(search);

  return WORKS_CORPUS.filter((w) => {
    if (subj.includes('lqcc')) {
      if (w.kind !== 'LQCC') return false;
    } else if (subj.includes('gdan')) {
      if (w.kind !== 'SONG') return false;
    } else if (subj.includes('lqvh')) {
      if (w.kind !== 'POEM' && w.kind !== 'STORY') return false;
    }
    if (ageGroupId !== 'ALL' && !q && !w.ageGroups.includes(ageGroupId) && w.kind !== 'LQCC') return false;
    if (q) {
      const hay = normVN(`${w.title} ${w.author} ${w.themes.join(' ')} ${w.contentText}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Sinh khối HTML chuẩn Times New Roman 13pt chứa toàn văn tác phẩm / nét chữ + bộ câu hỏi đàm thoại
 * để chèn 1 chạm vào trình soạn thảo Word.
 */
export function buildWorkSnippetHtml(work: LiteraryWorkItem): string {
  const kindLabel =
    work.kind === 'POEM'
      ? 'Bài thơ'
      : work.kind === 'STORY'
      ? 'Tóm tắt truyện'
      : work.kind === 'SONG'
      ? 'Lời bài hát'
      : 'Phân tích cấu tạo nét chữ';

  const linesHtml = work.contentText
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line ? `<p><em>${esc(line)}</em></p>` : ''))
    .join('');

  const qaHtml = work.dialogueQuestions
    .map((q) => `<li>${esc(q)}</li>`)
    .join('');

  return [
    `<p><strong>* ${esc(kindLabel)}: “${esc(work.title)}” (${esc(work.author)})</strong></p>`,
    linesHtml,
    `<p><strong>* Hệ thống câu hỏi đàm thoại – gợi mở:</strong></p>`,
    `<ul>${qaHtml}</ul>`,
    work.educationalNote ? `<p><strong>* Giáo dục – Mở rộng:</strong> ${esc(work.educationalNote)}</p>` : '',
  ]
    .filter(Boolean)
    .join('');
}
