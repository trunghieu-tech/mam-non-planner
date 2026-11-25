import type { ObjectiveItem, SuggestedActivity, WeeklyPlanDocument } from '../../shared/types';
import { normalizePlainSuggestion } from './editorInsert';
import { fmtDateVN } from './helpers';
import { buildPedagogicalLessonPlan, lessonPlanToRichHtml } from './subjectTemplates';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escClean(s: string): string {
  return esc(normalizePlainSuggestion(s));
}

function fmtDateLongVN(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `ngày ${d} tháng ${m} năm ${y}`;
}

function ageGroupDisplay(id: string): string {
  switch (id) {
    case 'NHA_TRE_24_36T':
      return 'Nhà trẻ (24–36 tháng)';
    case 'MAM_3_4T':
      return 'Mẫu giáo bé – Mầm (3–4 tuổi)';
    case 'CHOI_4_5T':
      return 'Mẫu giáo nhỡ – Chồi (4–5 tuổi)';
    case 'LA_5_6T':
      return 'Mẫu giáo lớn – Lá (5–6 tuổi)';
    default:
      return id;
  }
}

/**
 * Chuyển toàn bộ kế hoạch tuần có cấu trúc thành văn bản giàu định dạng giống Microsoft Word
 * chuẩn Bộ GD&ĐT (01/VBHN-BGDĐT & NĐ 30/2020/NĐ-CP) để giáo viên gõ, sửa, định dạng trực tiếp.
 */
export function buildInitialWordHtml(plan: WeeklyPlanDocument, objectives: ObjectiveItem[]): string {
  const mtMap = new Map(objectives.filter((o) => o.ageGroupId === plan.ageGroupId).map((o) => [o.code, o]));
  const parts: string[] = [];

  // 1. TRANG BÌA
  parts.push(`
    <p style="text-align: center;">${esc(plan.governingBody.toUpperCase())}</p>
    <p style="text-align: center;"><strong>${esc(plan.schoolName.toUpperCase())}</strong></p>
    <p style="text-align: center;"><span style="color: #1D4ED8;">────────── ★ ──────────</span></p>
    <h1 style="text-align: center;"><span style="color: #1D4ED8;">KẾ HOẠCH GIÁO DỤC MẦM NON</span></h1>
    <p style="text-align: center;"><strong>NĂM HỌC ${esc(plan.schoolYear)}</strong></p>
    <p style="text-align: center;"><strong>CHỦ ĐỀ: ${esc(plan.themeName.toUpperCase())}</strong></p>
    <p style="text-align: center;"><strong>Chủ đề nhánh Tuần ${plan.weekNumber}: ${esc(plan.subThemeName)}</strong></p>
    <p style="text-align: center;"><em>Thời gian thực hiện: Từ ${esc(fmtDateVN(plan.weekStartDate))} đến ${esc(fmtDateVN(plan.weekEndDate))}</em></p>
    <p style="text-align: center;"><strong>Khối tuổi:</strong> ${esc(ageGroupDisplay(plan.ageGroupId))} &nbsp;|&nbsp; <strong>Lớp:</strong> ${esc(plan.className)} &nbsp;|&nbsp; <strong>Giáo viên:</strong> ${esc(plan.teacherName)}</p>
    <hr />
  `);

  // 2. PHẦN CHỦ ĐỀ (nếu là Tuần 1)
  if (plan.includeThemeSection) {
    parts.push(`
      <h1 style="text-align: center;"><span style="color: #1D4ED8;">CHỦ ĐỀ: ${esc(plan.themeName.toUpperCase())}</span></h1>
      <p style="text-align: center;"><em>Thời gian thực hiện: ${plan.themeTotalWeeks} tuần (Từ ${esc(fmtDateLongVN(plan.themeStartDate))} đến ${esc(fmtDateLongVN(plan.themeEndDate))})</em></p>
      <h2>I. MỤC TIÊU CHỦ ĐỀ</h2>
    `);

    const isNhaTre = plan.ageGroupId === 'NHA_TRE_24_36T';
    for (const block of plan.themeObjectives) {
      if (isNhaTre && block.domainKey === 'PTTM' && block.mtCodes.length === 0) continue;
      const domTitle =
        isNhaTre && block.domainKey === 'PT_TCKNXH'
          ? '4. Phát triển tình cảm, kỹ năng xã hội và thẩm mỹ'
          : block.domainTitle;
      parts.push(`<p><strong>${esc(domTitle)}</strong></p><ul>`);
      for (const g of block.customGoals) {
        if (g.trim()) parts.push(`<li>${esc(g.trim())}</li>`);
      }
      for (const code of block.mtCodes) {
        const obj = mtMap.get(code);
        parts.push(
          `<li><strong><span style="color: #1D4ED8;">${esc(code)}.</span></strong> ${esc(obj ? obj.description : '(Theo khung chuẩn Chương trình GDMN)')}</li>`
        );
      }
      parts.push(`</ul>`);
    }

    // Mạng nội dung
    if (plan.contentNetwork.length > 0) {
      parts.push(`<h2 style="text-align: center;">II. MẠNG NỘI DUNG</h2><table><tbody><tr>`);
      for (const br of plan.contentNetwork) {
        parts.push(`<th><p style="text-align: center;"><strong>${esc(br.branchTitle)}</strong></p></th>`);
      }
      parts.push(`</tr><tr>`);
      for (const br of plan.contentNetwork) {
        const lis = br.items
          .filter((x) => x.trim())
          .map((it) => `<p>- ${esc(it.trim())}</p>`)
          .join('');
        parts.push(`<td>${lis || '<p></p>'}</td>`);
      }
      parts.push(`</tr></tbody></table>`);
    }

    // Mạng hoạt động
    if (plan.activityNetwork.length > 0) {
      parts.push(`<h2 style="text-align: center;">III. MẠNG HOẠT ĐỘNG</h2><table><tbody><tr><th><p style="text-align: center;"><strong>LĨNH VỰC PHÁT TRIỂN</strong></p></th><th><p style="text-align: center;"><strong>HOẠT ĐỘNG GIÁO DỤC CHỦ ĐỀ: ${esc(plan.themeName.toUpperCase())}</strong></p></th></tr>`);
      for (const an of plan.activityNetwork) {
        const lis = an.items
          .filter((x) => x.trim())
          .map((it) => `<p>- ${esc(it.trim())}</p>`)
          .join('');
        parts.push(`<tr><td><p><strong>${esc(an.domainTitle)}</strong></p></td><td>${lis}</td></tr>`);
      }
      parts.push(`</tbody></table><hr />`);
    }
  }

  // 3. KẾ HOẠCH HOẠT ĐỘNG GIÁO DỤC TUẦN
  parts.push(`
    <h1 style="text-align: center;"><span style="color: #1D4ED8;">KẾ HOẠCH HOẠT ĐỘNG GIÁO DỤC TUẦN ${plan.weekNumber}</span></h1>
    <p style="text-align: center;"><strong>Chủ đề nhánh: ${esc(plan.subThemeName)}</strong></p>
    <p style="text-align: center;"><em>Thời gian thực hiện: Từ ${esc(fmtDateVN(plan.weekStartDate))} đến ${esc(fmtDateVN(plan.weekEndDate))}</em></p>
    <h2>A. MỤC TIÊU TUẦN</h2>
  `);
  // Ưu tiên hiển thị trực tiếp các mã MT thật đã gắn trong kế hoạch tuần (theo từng lĩnh vực)
  const isNhaTreWeek = plan.ageGroupId === 'NHA_TRE_24_36T';
  const themeObjByDomain = new Map(plan.themeObjectives.map((b) => [b.domainKey, b]));
  for (const w of plan.weeklyObjectives) {
    if (isNhaTreWeek && w.domainKey === 'PTTM') continue;
    const attachedCodes = themeObjByDomain.get(w.domainKey)?.mtCodes || [];
    const wTitle =
      isNhaTreWeek && w.domainKey === 'PT_TCKNXH'
        ? '4. Phát triển tình cảm, kỹ năng xã hội và thẩm mỹ'
        : w.domainTitle;
    parts.push(`<p><strong>${esc(wTitle)}</strong></p><ul>`);
    if (attachedCodes.length > 0) {
      for (const code of attachedCodes) {
        const obj = mtMap.get(code);
        if (obj) {
          parts.push(`<li><strong>${esc(code)}:</strong> ${esc(obj.description)}</li>`);
        }
      }
    } else {
      for (const g of w.goals) {
        if (g.trim()) parts.push(`<li>${escClean(g)}</li>`);
      }
    }
    parts.push(`</ul>`);
  }

  const formatTdsLine = (group: string, name: string) => {
    const gTrim = (group || '').trim();
    const nTrim = (name || '').trim();
    const nLow = nTrim.toLowerCase();
    const gLow = gTrim.toLowerCase();
    // Tránh lặp nhãn kiểu "2/ Tay: Tay: Hai tay..." hoặc "1/ Hô hấp: Thở: ..."
    const cleanName = nTrim
      .replace(new RegExp(`^${gLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d*\\s*[:\\-–]?\\s*`, 'i'), '')
      .trim();
    if (gLow === 'hô hấp' && nLow.startsWith('thở')) {
      return `${gTrim}: ${nTrim.replace(/^thở\s*\d*\s*[:\-–]?\s*/i, '').trim()}`;
    }
    return `${gTrim}: ${cleanName || nTrim}`;
  };

  const stripCornerLabel = (s: string) =>
    normalizePlainSuggestion(s).replace(
      /^góc\s*(?:phân\s*vai|xây\s*dựng|nghệ\s*thuật|tạo\s*hình|âm\s*nhạc|học\s*tập|thư\s*viện|thiên\s*nhiên|khoa\s*học)\s*[:\-–]?\s*/i,
      ''
    );

  // Bảng tổng hợp tuần
  const shortDay: Record<number, string> = { 2: 'HAI', 3: 'BA', 4: 'TƯ', 5: 'NĂM', 6: 'SÁU' };
  const etiquetteHtml = plan.etiquetteNotes.filter((n) => n.trim()).map((n) => `<p>- ${escClean(n)}</p>`).join('');
  const tdsHtml = plan.morningExercise.moves.map((m, i) => `<p>${i + 1}/ ${esc(formatTdsLine(m.group, m.name))}</p>`).join('');
  const cornerSummaryHtml = plan.cornerTable
    .map((c) => `<p><strong>* ${esc(c.cornerName)}:</strong> ${esc(c.contents.map(stripCornerLabel).filter(Boolean).join('; '))}</p>`)
    .join('');
  const laborHtml = plan.laborHygieneNotes.filter((n) => n.trim()).map((n) => `<p>- ${escClean(n)}</p>`).join('');

  parts.push(`
    <h2 style="text-align: center;">B. BẢNG TỔNG HỢP KẾ HOẠCH HOẠT ĐỘNG TUẦN ${plan.weekNumber}</h2>
    <table><tbody>
      <tr><th colspan="2"><p style="text-align: center;"><strong>LỄ GIÁO</strong></p></th><td colspan="3">${etiquetteHtml}</td></tr>
      <tr><th colspan="2"><p style="text-align: center;"><strong>THỂ DỤC SÁNG</strong></p></th><td colspan="3">${tdsHtml}</td></tr>
      <tr>
        <th><p style="text-align: center;"><strong>THỨ</strong></p></th>
        <th><p style="text-align: center;"><strong>HĐ CHUNG</strong></p></th>
        <th><p style="text-align: center;"><strong>LUYỆN TẬP CÓ MỤC ĐÍCH</strong></p></th>
        <th><p style="text-align: center;"><strong>HĐ NGOÀI TRỜI</strong></p></th>
        <th><p style="text-align: center;"><strong>HOẠT ĐỘNG CHIỀU</strong></p></th>
      </tr>
  `);

  for (const d of plan.days) {
    if (d.isHoliday) {
      parts.push(
        `<tr><td><p style="text-align: center;"><strong>${shortDay[d.dayOfWeek]}</strong></p><p style="text-align: center;"><em>${esc(fmtDateVN(d.dateStr).slice(0, 5))}</em></p></td><td colspan="4"><p style="text-align: center;"><em>(${esc(d.holidayName || 'Nghỉ Lễ theo quy định')})</em></p></td></tr>`
      );
      continue;
    }
    const lessons = d.mainLessons.length ? d.mainLessons : [null];
    const span = lessons.length;
    const aftHtml = [
      d.extracurricularTitle ? `<p><strong>- ${esc(d.extracurricularTitle)}</strong></p>` : '',
      d.afternoonLesson ? `<p>- ${esc(d.afternoonLesson.topicTitle)}</p>` : '',
    ]
      .filter(Boolean)
      .join('');

    lessons.forEach((les, idx) => {
      const topicHtml = les
        ? [
            `<p><strong>${esc(les.topicTitle)}</strong></p>`,
            ...les.subTopics.filter((x) => x.trim()).map((st) => `<p>${esc(st)}</p>`),
            les.linkedMtCodes.length ? `<p><em><span style="color: #1D4ED8;">(${esc(les.linkedMtCodes.join(', '))})</span></em></p>` : '',
          ].join('')
        : '<p>—</p>';
      parts.push(`<tr>`);
      if (idx === 0) {
        parts.push(`<td${span > 1 ? ` rowspan="${span}"` : ''}><p style="text-align: center;"><strong>${shortDay[d.dayOfWeek]}</strong></p><p style="text-align: center;"><em>${esc(fmtDateVN(d.dateStr).slice(0, 5))}</em></p></td>`);
      }
      parts.push(`<td><p style="text-align: center;"><strong>${les ? esc(les.subjectCode) : '—'}</strong></p></td>`);
      parts.push(`<td>${topicHtml}</td>`);
      if (idx === 0) {
        parts.push(`<td${span > 1 ? ` rowspan="${span}"` : ''}><p>- ${esc(d.outdoorObservation)}</p></td>`);
        parts.push(`<td${span > 1 ? ` rowspan="${span}"` : ''}>${aftHtml || '<p>—</p>'}</td>`);
      }
      parts.push(`</tr>`);
    });
  }

  parts.push(`
      <tr><th colspan="2"><p style="text-align: center;"><strong>VUI CHƠI (5 GÓC)</strong></p></th><td colspan="3">${cornerSummaryHtml}</td></tr>
      <tr><th colspan="2"><p style="text-align: center;"><strong>LAO ĐỘNG VỆ SINH</strong></p></th><td colspan="3">${laborHtml}</td></tr>
    </tbody></table>
  `);

  // 4. HOẠT ĐỘNG CẢ TUẦN (Thể dục sáng, Điểm danh, Nêu gương, HĐNT, HĐ Góc)
  parts.push(`
    <h2>C. CÁC HOẠT ĐỘNG CẢ TUẦN</h2>
    <h3>I. Thể dục sáng</h3>
    <p><strong>1. Mục đích – yêu cầu:</strong></p>
    <ul>${plan.morningExercise.aims.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <p><strong>2. Chuẩn bị:</strong> ${esc(plan.morningExercise.preparation.join('; '))}</p>
    <p><strong>3. Tiến hành:</strong></p>
    <p>- <strong>Khởi động:</strong> ${esc(plan.morningExercise.warmup)}</p>
    <p>- <strong>Trọng động:</strong></p>
    <ul>${plan.morningExercise.moves.map((m) => `<li><strong>${esc(formatTdsLine(m.group, m.name))}:</strong> ${esc(m.steps)}</li>`).join('')}</ul>
    <p>- <strong>Hồi tỉnh:</strong> ${esc(plan.morningExercise.cooldown)}</p>

    <h3>II. Trò chuyện sáng, Điểm danh &amp; Hoạt động Nêu gương</h3>
    ${
      (plan.morningTalkNotes || []).some((x) => x.trim())
        ? `<p><strong>Trò chuyện sáng theo chủ đề nhánh:</strong></p><ul>${(plan.morningTalkNotes || [])
            .filter((x) => x.trim())
            .map((x) => `<li>${escClean(x)}</li>`)
            .join('')}</ul>`
        : ''
    }
    <p><strong>3 Tiêu chuẩn bé ngoan tuần ${plan.weekNumber}:</strong></p>
    <ol>${plan.praiseStandards.filter((s) => s.trim()).map((s) => `<li>${escClean(s)}</li>`).join('')}</ol>
    <p>- Nêu gương cuối ngày (cắm cờ): Hát bài <em>“${esc(plan.praiseSongStart)}”</em>, tổ tự nhận xét và cô khen thưởng cắm cờ.</p>
    <p>- Nêu gương cuối tuần (phát phiếu bé ngoan): Đếm cờ đạt trong tuần (4–5 cờ), phát phiếu và hát <em>“${esc(plan.praiseSongWeekEnd)}”</em>.</p>
    ${
      (plan.laborHygieneNotes || []).some((x) => x.trim())
        ? `<h3>IIb. Tổ chức Ăn – Ngủ – Vệ sinh – Lao động tự phục vụ</h3><ul>${(plan.laborHygieneNotes || [])
            .filter((x) => x.trim())
            .map((x) => `<li>${escClean(x)}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${
      plan.weeklyTeacherNote && plan.weeklyTeacherNote.trim()
        ? `<p><strong>Ghi chú chuyên môn tuần:</strong> ${esc(plan.weeklyTeacherNote.trim())}</p>`
        : ''
    }

    <h3>III. Kế hoạch Hoạt động ngoài trời 1 tuần</h3>
    <table><tbody>
      <tr>
        <th><p style="text-align: center;"><strong>NỘI DUNG</strong></p></th>
        <th><p style="text-align: center;"><strong>YÊU CẦU</strong></p></th>
        <th><p style="text-align: center;"><strong>CHUẨN BỊ</strong></p></th>
        <th><p style="text-align: center;"><strong>TỔ CHỨC THỰC HIỆN</strong></p></th>
      </tr>
      ${plan.outdoorTable
        .map(
          (row) => `<tr>
          <td><p><strong>${esc(row.title)}</strong></p></td>
          <td>${row.requirements.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
          <td>${row.preparation.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
          <td>${row.procedure.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
        </tr>`
        )
        .join('')}
    </tbody></table>

    <h3>IV. Kế hoạch Hoạt động góc 1 tuần (5 góc)</h3>
    <table><tbody>
      <tr>
        <th><p style="text-align: center;"><strong>GÓC CHƠI</strong></p></th>
        <th><p style="text-align: center;"><strong>NỘI DUNG</strong></p></th>
        <th><p style="text-align: center;"><strong>YÊU CẦU</strong></p></th>
        <th><p style="text-align: center;"><strong>CHUẨN BỊ</strong></p></th>
        <th><p style="text-align: center;"><strong>TỔ CHỨC HOẠT ĐỘNG</strong></p></th>
      </tr>
      ${plan.cornerTable
        .map(
          (c) => `<tr>
          <td><p><strong>${esc(c.cornerName)}</strong></p></td>
          <td>${c.contents.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
          <td>${c.requirements.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
          <td>${c.preparation.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
          <td>${c.organization.filter((x) => x.trim()).map((x) => `<p>- ${escClean(x)}</p>`).join('')}</td>
        </tr>`
        )
        .join('')}
    </tbody></table>
  `);

  // 5. 5 NGÀY TÍCH HỢP (THỨ 2 -> THỨ 6)
  const tcvdTitle = plan.outdoorTable.find((o) => o.category === 'TCVD')?.title || 'TCVĐ theo kế hoạch tuần';
  const tcdgTitle = plan.outdoorTable.find((o) => o.category === 'TCDG')?.title || 'TCDG theo kế hoạch tuần';

  for (const day of plan.days) {
    if (day.isHoliday) {
      parts.push(`
        <hr />
        <h2 style="text-align: center;"><span style="color: #1D4ED8;">${esc(day.dayLabel.toUpperCase())}, ${esc(fmtDateLongVN(day.dateStr).toUpperCase())}</span></h2>
        <p style="text-align: center;"><strong><em>(${esc(day.holidayName || 'NGHỈ LỄ THEO QUY ĐỊNH NHÀ NƯỚC')})</em></strong></p>
      `);
      continue;
    }
    parts.push(`
      <hr />
      <h2 style="text-align: center;"><span style="color: #1D4ED8;">${esc(day.dayLabel.toUpperCase())}, ${esc(fmtDateLongVN(day.dateStr).toUpperCase())}</span></h2>
      <p><strong>A. ĐÓN TRẺ – THỂ DỤC SÁNG – ĐIỂM DANH</strong></p>
      <ul>
        ${plan.welcomeRoutineNotes.filter((w) => w.trim()).map((w) => `<li>${escClean(w)}</li>`).join('')}
        <li><strong>Thể dục sáng &amp; Điểm danh:</strong> Thực hiện theo kế hoạch tuần; nắm sĩ số và tình hình sức khỏe trẻ trong ngày.</li>
        ${day.showPraiseStandards ? `<li><strong>Phổ biến 3 Tiêu chuẩn bé ngoan đầu tuần</strong> để trẻ phấn đấu cắm cờ.</li>` : ''}
      </ul>
      <p><strong>B. HOẠT ĐỘNG NGOÀI TRỜI</strong></p>
      <ul>
        <li><strong>Quan sát có chủ đích:</strong> ${esc(day.outdoorObservation)}</li>
        <li>${esc(tcvdTitle)} &nbsp;|&nbsp; ${esc(tcdgTitle)} &nbsp;|&nbsp; Chơi tự do với đồ chơi sân trường.</li>
      </ul>
      <p><strong><span style="color: #1D4ED8;">C. HOẠT ĐỘNG CÓ CHỦ ĐÍCH</span></strong></p>
    `);

    day.mainLessons.forEach((les, idx) => {
      const prefix = day.mainLessons.length > 1 ? `Tiết ${idx + 1}` : undefined;
      parts.push(lessonPlanToRichHtml(les, prefix));
    });

    parts.push(`
      <p><strong>D. HOẠT ĐỘNG GÓC:</strong> ${esc(plan.cornerTable.map((c) => `${c.cornerName} (${c.contents.map(stripCornerLabel).filter(Boolean).join(', ')})`).join('; '))}.</p>
      <p><strong><span style="color: #1D4ED8;">E. HOẠT ĐỘNG CHIỀU</span></strong></p>
    `);
    if (day.extracurricularTitle.trim()) {
      parts.push(`<p>- <strong>${esc(day.extracurricularTitle)}</strong></p>`);
    }
    if (day.afternoonLesson) {
      const al = day.afternoonLesson;
      if (al.richHtml && al.richHtml.trim().length > 20) {
        parts.push(al.richHtml);
      } else {
        parts.push(`
          <p><strong>${esc(al.subjectFullTitle)}: ${esc(al.topicTitle)}</strong>${al.linkedMtCodes.length ? ` <em>(${esc(al.linkedMtCodes.join(', '))})</em>` : ''}</p>
          <p><em>I. Mục đích – Yêu cầu:</em> ${esc(al.aims.join(' '))}</p>
          <p><em>II. Chuẩn bị:</em> ${esc(al.preparation.join('; '))}</p>
          <p><em>III. Tổ chức hoạt động:</em></p>
          <ul>${al.steps.map((st) => `<li><strong>${esc(st.title)}:</strong> ${esc(st.details.join(' '))}</li>`).join('')}</ul>
        `);
      }
    } else if (!day.extracurricularTitle.trim()) {
      parts.push(`<p>- Ôn luyện kiến thức buổi sáng, hoàn thiện sản phẩm chưa xong, chơi tự chọn ở các góc và rèn kỹ năng tự phục vụ.</p>`);
    }

    const dots = '........................................................................................................................';
    parts.push(`
      <p><strong>F. NÊU GƯƠNG – VỆ SINH – TRẢ TRẺ</strong></p>
      <p>- Tổ chức nêu gương cắm cờ cuối ngày theo 3 tiêu chuẩn bé ngoan; vệ sinh cá nhân sạch sẽ và trả trẻ tận tay phụ huynh.</p>
      <p style="text-align: center;"><strong>ĐÁNH GIÁ CUỐI NGÀY</strong></p>
      <p><strong>1. Tình trạng sức khỏe của trẻ:</strong> ${esc(day.evalHealth.trim() || dots)}</p>
      <p><strong>2. Trạng thái cảm xúc, thái độ, hành vi của trẻ:</strong> ${esc(day.evalEmotionBehavior.trim() || dots)}</p>
      <p><strong>3. Kiến thức, kỹ năng của trẻ:</strong> ${esc(day.evalKnowledgeSkill.trim() || dots)}</p>
      <p><strong>4. Lưu ý điều chỉnh kế hoạch tiếp theo:</strong> ${esc((day.evalAdjustment || '').trim() || dots)}</p>
    `);
  }

  // 6. KHỐI KÝ DUYỆT CUỐI HỒ SƠ
  parts.push(`
    <p></p>
    <table><tbody>
      <tr>
        <td>
          <p style="text-align: center;"><strong>GIÁO VIÊN</strong></p>
          <p style="text-align: center;"><em>(Ký, ghi rõ họ tên)</em></p>
          <p></p><p></p>
          <p style="text-align: center;"><strong>${esc(plan.teacherName)}</strong></p>
        </td>
        <td>
          <p style="text-align: center;"><strong>XÁC NHẬN CỦA BAN GIÁM HIỆU</strong></p>
          <p style="text-align: center;"><em>(Ký tên và đóng dấu)</em></p>
          ${
            plan.status === 'APPROVED'
              ? `<p style="text-align: center;"><strong><span style="color: #1D4ED8;">✓ ĐÃ PHÊ DUYỆT TRỰC TUYẾN</span></strong></p><p style="text-align: center;"><em>${esc(plan.approvedAt ? fmtDateVN(plan.approvedAt.slice(0, 10)) : '')}</em></p>`
              : `<p></p><p></p>`
          }
          <p style="text-align: center;"><strong>${esc(plan.approvedBy || plan.principalName)}</strong></p>
        </td>
      </tr>
    </tbody></table>
  `);

  return parts.join('\n');
}

// =========================================================================
// CÁC MẪU CHÈN NHANH TẠI VỊ TRÍ CON TRỎ WORD (1-CLICK INSERT SNIPPETS)
// =========================================================================

export const WORD_SNIPPETS: Record<string, { label: string; html: string }> = {
  lesson_frame: {
    label: 'Khung Tiết học chuẩn BGD (I / II / III)',
    html: `
      <h3 style="text-align: center;">HOẠT ĐỘNG HỌC — Đề tài: [Nhập tên đề tài]</h3>
      <p style="text-align: center;"><em>Lĩnh vực: ... • Mã MT: MT...</em></p>
      <p><strong>I. Mục đích – Yêu cầu:</strong></p>
      <ul>
        <li><strong>Kiến thức:</strong> Trẻ biết...</li>
        <li><strong>Kỹ năng:</strong> Rèn cho trẻ kỹ năng...</li>
        <li><strong>Thái độ:</strong> Trẻ hứng thú, tích cực tham gia hoạt động...</li>
      </ul>
      <p><strong>II. Chuẩn bị:</strong></p>
      <ul>
        <li>Đồ dùng của cô: ...</li>
        <li>Đồ dùng của trẻ: ...</li>
      </ul>
      <p><strong>III. Tổ chức hoạt động:</strong></p>
      <p><strong>* Hoạt động 1: Ổn định tổ chức – Gây hứng thú</strong></p>
      <ul><li>Cô cho trẻ hát/chơi trò chơi dẫn dắt vào bài...</li></ul>
      <p><strong>* Hoạt động 2: Nội dung trọng tâm</strong></p>
      <ul><li>Cô hướng dẫn, làm mẫu và tổ chức cho trẻ thực hành trải nghiệm...</li></ul>
      <p><strong>* Hoạt động 3: Củng cố – Kết thúc</strong></p>
      <ul><li>Tổ chức trò chơi ôn luyện, nhận xét tuyên dương trẻ.</li></ul>
    `,
  },
  daily_eval: {
    label: 'Khung Đánh giá cuối ngày (3 tiêu chí BGD)',
    html: `
      <p style="text-align: center;"><strong>ĐÁNH GIÁ CUỐI NGÀY</strong></p>
      <p><strong>1. Tình trạng sức khỏe của trẻ:</strong> ....................................................................................................</p>
      <p><strong>2. Trạng thái cảm xúc, thái độ, hành vi của trẻ:</strong> ............................................................................</p>
      <p><strong>3. Kiến thức, kỹ năng của trẻ:</strong> ........................................................................................................</p>
    `,
  },
  tds_5moves: {
    label: 'Bài Thể dục sáng chuẩn 5 động tác',
    html: `
      <h3>THỂ DỤC SÁNG</h3>
      <p>- <strong>Khởi động:</strong> Đi vòng tròn kết hợp các kiểu chân (mũi chân, gót chân, chạy nhanh chậm) rồi về hàng ngang.</p>
      <p>- <strong>Trọng động:</strong></p>
      <ul>
        <li><strong>Hô hấp:</strong> Thổi bóng bay / Gà gáy (2 lần × 8 nhịp)</li>
        <li><strong>Tay:</strong> Hai tay đưa ra trước, lên cao, hạ xuống (2 lần × 8 nhịp)</li>
        <li><strong>Bụng:</strong> Đứng cúi gập người chạm ngón chân (2 lần × 8 nhịp)</li>
        <li><strong>Chân:</strong> Ngồi khuỵu gối (2 lần × 8 nhịp)</li>
        <li><strong>Bật:</strong> Bật chụm chân tiến về trước (2 lần × 8 nhịp)</li>
      </ul>
      <p>- <strong>Hồi tỉnh:</strong> Đi nhẹ nhàng 1–2 vòng hít thở sâu thả lỏng cơ thể.</p>
    `,
  },
  formation_ptvd: {
    label: 'Sơ đồ đội hình 2 hàng ngang đối diện (PTVĐ)',
    html: `
      <p style="text-align: center;"><em>Sơ đồ đội hình tập Vận động cơ bản:</em></p>
      <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
      <p style="text-align: center;"><code>────── [ Dụng cụ / Cô làm mẫu ] ──────</code></p>
      <p style="text-align: center;"><code>X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X &nbsp;&nbsp; X</code></p>
    `,
  },
  corners_table: {
    label: 'Bảng 5 Góc chơi chuẩn (5 cột)',
    html: `
      <table><tbody>
        <tr><th><p><strong>GÓC CHƠI</strong></p></th><th><p><strong>NỘI DUNG</strong></p></th><th><p><strong>YÊU CẦU</strong></p></th><th><p><strong>CHUẨN BỊ</strong></p></th><th><p><strong>TỔ CHỨC</strong></p></th></tr>
        <tr><td><p><strong>Góc phân vai</strong></p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td></tr>
        <tr><td><p><strong>Góc xây dựng</strong></p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td></tr>
        <tr><td><p><strong>Góc nghệ thuật</strong></p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td></tr>
        <tr><td><p><strong>Góc học tập – TV</strong></p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td></tr>
        <tr><td><p><strong>Góc thiên nhiên</strong></p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td><td><p>- </p></td></tr>
      </tbody></table>
    `,
  },
  signature_block: {
    label: 'Khối Ký duyệt Giáo viên & BGH',
    html: `
      <table><tbody>
        <tr>
          <td><p style="text-align: center;"><strong>GIÁO VIÊN</strong></p><p style="text-align: center;"><em>(Ký, ghi rõ họ tên)</em></p><p></p><p></p><p style="text-align: center;"><strong>...........................</strong></p></td>
          <td><p style="text-align: center;"><strong>XÁC NHẬN CỦA BAN GIÁM HIỆU</strong></p><p style="text-align: center;"><em>(Ký tên và đóng dấu)</em></p><p></p><p></p><p style="text-align: center;"><strong>...........................</strong></p></td>
        </tr>
      </tbody></table>
    `,
  },
};

export function buildLessonSnippetHtml(
  topicTitle: string,
  subjectHint: string,
  mtCode: string,
  obj?: ObjectiveItem
): string {
  const built = buildPedagogicalLessonPlan({
    topicTitle,
    subjectCode: subjectHint,
    mtCode,
    obj,
  });
  return built.richHtml || lessonPlanToRichHtml(built);
}

export function buildMtLineHtml(obj: ObjectiveItem): string {
  return `<p><strong>${esc(obj.code)}:</strong> ${escClean(obj.description)}</p>`;
}

export function buildActivityLineHtml(obj: ObjectiveItem, act: SuggestedActivity): string {
  return `<p><strong>[${esc(act.type)}]</strong> ${escClean(act.text)} <em>(${esc(obj.code)})</em></p>`;
}

export function buildShortLessonLineHtml(topicTitle: string, subjectCode: string, mtCode?: string): string {
  return `<p><strong>[${esc(subjectCode)}]</strong> ${escClean(topicTitle)}${mtCode ? ` <em>(${esc(mtCode)})</em>` : ''}</p>`;
}
