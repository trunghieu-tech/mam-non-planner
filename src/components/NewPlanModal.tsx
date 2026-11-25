import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AgeGroup, AgeGroupId, AnnualPlanDocument, WeeklyPlanDocument } from '../../shared/types';
import { createBlankPlan } from '../utils/helpers';

interface Props {
  ageGroups: AgeGroup[];
  defaultAgeGroup: AgeGroupId;
  annualPlans?: Record<AgeGroupId, AnnualPlanDocument> | null;
  onClose: () => void;
  onCreate: (plan: WeeklyPlanDocument) => void;
}

export const NewPlanModal: React.FC<Props> = ({
  ageGroups,
  defaultAgeGroup,
  annualPlans,
  onClose,
  onCreate,
}) => {
  const initProf = annualPlans?.[defaultAgeGroup]?.profile;
  const [ageGroupId, setAgeGroupId] = useState<AgeGroupId>(defaultAgeGroup);
  const [className, setClassName] = useState(
    initProf?.className ||
      (defaultAgeGroup === 'NHA_TRE_24_36T'
        ? 'Nhà trẻ 1'
        : defaultAgeGroup === 'MAM_3_4T'
        ? 'Mầm 1'
        : defaultAgeGroup === 'CHOI_4_5T'
        ? 'Chồi 1'
        : 'Lá 2')
  );
  const [schoolName, setSchoolName] = useState(initProf?.schoolName || 'TRƯỜNG MẦM NON HOÀNG GIA');
  const [governingBody, setGoverningBody] = useState(
    initProf?.governingBody || 'UBND PHƯỜNG THUẬN AN – TP. HỒ CHÍ MINH'
  );
  const [teacherName, setTeacherName] = useState(initProf?.teacherName || 'Nguyễn Thị Bé Diệu');
  const [principalName, setPrincipalName] = useState(initProf?.principalName || 'Nguyễn Thị Thủy');
  const [themeName, setThemeName] = useState('BẢN THÂN BÉ');
  const [subThemeName, setSubThemeName] = useState('Tôi là ai – Cơ thể kỳ diệu của bé');
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekStartDate, setWeekStartDate] = useState('2026-10-05');

  useEffect(() => {
    const prof = annualPlans?.[ageGroupId]?.profile;
    if (prof) {
      setClassName(prof.className);
      setSchoolName(prof.schoolName);
      setGoverningBody(prof.governingBody);
      setTeacherName(prof.teacherName);
      setPrincipalName(prof.principalName);
    }
  }, [ageGroupId, annualPlans]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const plan = createBlankPlan({
      ageGroupId,
      className,
      teacherName,
      schoolName,
      governingBody,
      principalName,
      themeName,
      subThemeName,
      weekNumber,
      weekStartDate,
    });
    onCreate(plan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Tạo Kế hoạch Giáo dục Tuần mới</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Khối độ tuổi</label>
              <select
                value={ageGroupId}
                onChange={(e) => setAgeGroupId(e.target.value as AgeGroupId)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {ageGroups.map((ag) => (
                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Tên lớp</label>
              <input
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Chủ đề lớn</label>
              <input
                required
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Chủ đề nhánh tuần</label>
              <input
                required
                value={subThemeName}
                onChange={(e) => setSubThemeName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Tuần thứ</label>
              <input
                type="number"
                min={1}
                max={35}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Ngày Thứ hai đầu tuần</label>
              <input
                type="date"
                required
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Trường mầm non</label>
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Đơn vị chủ quản</label>
              <input
                value={governingBody}
                onChange={(e) => setGoverningBody(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Giáo viên phụ trách</label>
              <input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Đại diện BGH ký duyệt</label>
              <input
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#0B6E5C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#085A4B]"
            >
              Khởi tạo & Mở trình soạn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
