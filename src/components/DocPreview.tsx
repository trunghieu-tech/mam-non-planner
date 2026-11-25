import React from 'react';
import type { ObjectiveItem, WeeklyPlanDocument } from '../../shared/types';
import { fmtDateVN } from '../utils/helpers';

interface Props {
  plan: WeeklyPlanDocument;
  objectives: ObjectiveItem[];
}

export const DocPreview: React.FC<Props> = ({ plan, objectives }) => {
  const mtMap = new Map(objectives.filter((o) => o.ageGroupId === plan.ageGroupId).map((o) => [o.code, o]));
  const shortDay: Record<number, string> = { 2: 'HAI', 3: 'BA', 4: 'TƯ', 5: 'NĂM', 6: 'SÁU' };

  return (
    <div className="space-y-6">
      {/* Page 1: Cover */}
      <div className="a4-paper mx-auto max-w-[820px] rounded-sm p-10">
        <div className="border-4 border-double border-[#1D4ED8] px-8 py-12 text-center">
          <div className="text-sm uppercase tracking-wide">{plan.governingBody}</div>
          <div className="mt-1 text-base font-bold uppercase">{plan.schoolName}</div>
          <div className="my-3 text-sm text-[#1D4ED8]">──────── ★ ────────</div>

          <div className="mt-10 text-2xl font-bold text-[#1D4ED8]">KẾ HOẠCH GIÁO DỤC MẦM NON</div>
          <div className="mt-2 text-base font-bold">NĂM HỌC {plan.schoolYear}</div>

          <div className="mt-10 text-xl font-bold uppercase">CHỦ ĐỀ: {plan.themeName}</div>
          <div className="mt-2 text-base font-bold">
            Chủ đề nhánh Tuần {plan.weekNumber}: {plan.subThemeName}
          </div>
          <div className="mt-1 text-sm italic">
            {plan.includeThemeSection
              ? `Thời gian thực hiện chủ đề: ${plan.themeTotalWeeks} tuần (Từ ${fmtDateVN(plan.themeStartDate)} đến ${fmtDateVN(plan.themeEndDate)})`
              : `Thời gian thực hiện: Từ ${fmtDateVN(plan.weekStartDate)} đến ${fmtDateVN(plan.weekEndDate)}`}
          </div>

          <div className="mx-auto mt-14 max-w-sm space-y-1.5 text-left text-sm font-bold">
            <div>Lớp: {plan.className}</div>
            <div>Giáo viên phụ trách: {plan.teacherName}</div>
            <div>Năm học: {plan.schoolYear}</div>
          </div>
        </div>
      </div>

      {/* Page 2: Theme section (if enabled) */}
      {plan.includeThemeSection && (
        <div className="a4-paper mx-auto max-w-[820px] rounded-sm p-10 text-[13px] leading-relaxed">
          <div className="text-center text-base font-bold text-[#1D4ED8] uppercase">
            CHỦ ĐỀ: {plan.themeName}
          </div>
          <div className="text-center text-xs italic">
            Thời gian thực hiện: {plan.themeTotalWeeks} tuần (Từ {fmtDateVN(plan.themeStartDate)} đến {fmtDateVN(plan.themeEndDate)})
          </div>

          <div className="mt-4 font-bold">I. MỤC TIÊU CHỦ ĐỀ</div>
          <div className="mt-1 space-y-2">
            {plan.themeObjectives.map((b) => (
              <div key={b.domainKey}>
                <div className="font-bold">{b.domainTitle}</div>
                {b.customGoals.map((g, i) => (
                  <div key={i} className="pl-4">- {g}</div>
                ))}
                {b.mtCodes.map((code) => (
                  <div key={code} className="pl-4">
                    <strong className="text-[#1D4ED8]">{code}.</strong>{' '}
                    {mtMap.get(code)?.description || '(Theo khung chuẩn GDMN)'}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-5 text-center font-bold">II. MẠNG NỘI DUNG</div>
          <table className="mt-2 text-xs">
            <thead>
              <tr className="bg-[#DBEAFE] text-[#1E3A8A]">
                {plan.contentNetwork.map((br) => (
                  <th key={br.id} className="text-center font-bold">{br.branchTitle}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {plan.contentNetwork.map((br) => (
                  <td key={br.id}>
                    {br.items.map((it, i) => (
                      <div key={i}>- {it}</div>
                    ))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className="mt-5 text-center font-bold">III. MẠNG HOẠT ĐỘNG</div>
          <table className="mt-2 text-xs">
            <thead>
              <tr className="bg-[#1D4ED8] text-white">
                <th className="w-[28%]">LĨNH VỰC</th>
                <th>HOẠT ĐỘNG GIÁO DỤC CHỦ ĐỀ</th>
              </tr>
            </thead>
            <tbody>
              {plan.activityNetwork.map((an) => (
                <tr key={an.domainKey}>
                  <td className="bg-[#F0FAF8] font-bold text-[#1E3A8A]">{an.domainTitle}</td>
                  <td>
                    {an.items.map((it, i) => (
                      <div key={i}>- {it}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Page 3: Weekly Summary Table */}
      <div className="a4-paper mx-auto max-w-[820px] rounded-sm p-10 text-[13px] leading-relaxed">
        <div className="text-center text-base font-bold text-[#1D4ED8]">
          KẾ HOẠCH HOẠT ĐỘNG GIÁO DỤC TUẦN {plan.weekNumber}
        </div>
        <div className="text-center text-sm font-bold">Chủ đề nhánh: {plan.subThemeName}</div>
        <div className="text-center text-xs italic">
          Thời gian thực hiện: {fmtDateVN(plan.weekStartDate)} – {fmtDateVN(plan.weekEndDate)}
        </div>

        <table className="mt-4 text-xs">
          <tbody>
            <tr>
              <td colSpan={2} className="bg-[#F0FAF8] text-center font-bold">LỄ GIÁO</td>
              <td colSpan={3}>
                {plan.etiquetteNotes.map((n, i) => <div key={i}>- {n}</div>)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="bg-[#F0FAF8] text-center font-bold">THỂ DỤC SÁNG</td>
              <td colSpan={3}>
                {plan.morningExercise.moves.map((m, i) => (
                  <div key={i}>{i + 1}/ {m.group}: {m.name}</div>
                ))}
              </td>
            </tr>
            <tr className="bg-[#1D4ED8] text-center font-bold text-white">
              <td className="w-[9%]">THỨ</td>
              <td className="w-[14%]">HĐ CHUNG</td>
              <td className="w-[31%]">LUYỆN TẬP CÓ MỤC ĐÍCH</td>
              <td className="w-[22%]">HĐ NGOÀI TRỜI</td>
              <td className="w-[24%]">HOẠT ĐỘNG CHIỀU</td>
            </tr>
            {plan.days.map((d) => {
              const lessons = d.mainLessons.length ? d.mainLessons : [null];
              return lessons.map((les, idx) => (
                <tr key={`${d.dayOfWeek}_${idx}`}>
                  {idx === 0 && (
                    <td rowSpan={lessons.length} className="text-center font-bold">
                      {shortDay[d.dayOfWeek]}
                      <div className="text-[10px] font-normal text-slate-500">{fmtDateVN(d.dateStr).slice(0, 5)}</div>
                    </td>
                  )}
                  <td className="text-center font-bold">{les ? les.subjectCode : '—'}</td>
                  <td>
                    {les ? (
                      <>
                        <div className="font-bold">{les.topicTitle}</div>
                        {les.subTopics.map((st, si) => <div key={si}>{st}</div>)}
                        {les.linkedMtCodes.length > 0 && (
                          <div className="text-[11px] italic text-[#1D4ED8]">({les.linkedMtCodes.join(', ')})</div>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  {idx === 0 && (
                    <>
                      <td rowSpan={lessons.length}>- {d.outdoorObservation}</td>
                      <td rowSpan={lessons.length}>
                        {d.extracurricularTitle && <div className="font-bold">- {d.extracurricularTitle}</div>}
                        {d.afternoonLesson && <div>- {d.afternoonLesson.topicTitle}</div>}
                      </td>
                    </>
                  )}
                </tr>
              ));
            })}
            <tr>
              <td colSpan={2} className="bg-[#F0FAF8] text-center font-bold">VUI CHƠI (5 GÓC)</td>
              <td colSpan={3}>
                {plan.cornerTable.map((c, i) => (
                  <div key={i}>
                    <strong>* {c.cornerName}:</strong> {c.contents.join('; ')}
                  </div>
                ))}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="bg-[#F0FAF8] text-center font-bold">LAO ĐỘNG VỆ SINH</td>
              <td colSpan={3}>
                {plan.laborHygieneNotes.map((n, i) => <div key={i}>- {n}</div>)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signature preview */}
        <div className="mt-10 grid grid-cols-2 text-center text-sm">
          <div>
            <div className="font-bold">GIÁO VIÊN</div>
            <div className="text-xs italic">(Ký, ghi rõ họ tên)</div>
            <div className="mt-12 font-bold">{plan.teacherName}</div>
          </div>
          <div>
            <div className="font-bold">XÁC NHẬN CỦA BAN GIÁM HIỆU</div>
            <div className="text-xs italic">(Ký tên và đóng dấu)</div>
            <div className="mt-12 font-bold">{plan.principalName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
