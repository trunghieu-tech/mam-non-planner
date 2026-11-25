import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DAILY_ROUTINES_BANK } from '../utils/dailyRoutinesBank';

type WorkspaceStep = 'annual' | 'board' | 'shared' | 'focus' | 'preview' | 'closing';

interface Props {
  onClose: () => void;
  onGoToStep: (step: WorkspaceStep) => void;
}

const GUIDE_STEPS: Array<{
  num: string;
  step: WorkspaceStep;
  title: string;
  time: string;
  summary: string;
  actions: string[];
}> = [
  {
    num: '1',
    step: 'annual',
    title: 'Năm học & Thời khóa biểu Lẻ/Chẵn (9 tháng)',
    time: '~3 phút đầu năm',
    summary: 'Theo dõi độ phủ 100% Mã MT cả năm học, gắn sao ★ MT đánh giá tháng, thiết lập TKB Tuần Lẻ/Chẵn và Hồ sơ Lớp.',
    actions: [
      'Cập nhật Hồ sơ Lớp (Trường, Giáo viên, BGH, Dán nhanh DS trẻ từ Excel) và Thời khóa biểu Tuần Lẻ / Tuần Chẵn.',
      'Xem ma trận 9 Chủ đề tháng, đánh dấu ★ các Mã MT trọng tâm đánh giá hoặc + Phát triển MT mở rộng cho lớp.',
    ],
  },
  {
    num: '2',
    step: 'board',
    title: 'KHGD Tháng & Lập lịch Tuần (Thứ 2 → Thứ 6)',
    time: '~5 phút',
    summary: 'Phân bổ MT từ Tháng xuống Tuần 1..4 rồi xếp các tiết học Sáng & Chiều lên bảng 5 ngày thoáng rõ.',
    actions: [
      'Chuyển qua “KHGD Tháng” để tick phân bổ MT vào từng tuần rồi bấm “Đồng bộ sang KHGD Tuần”.',
      'Bấm “Tự động xếp lịch” theo TKB Lẻ/Chẵn, bấm trực tiếp vào thẻ cảnh báo đỏ ★ MT, hoặc “Copy từ tuần khác”.',
      'Đánh dấu “Nghỉ?” trên ngày Lễ (20/11, Giỗ Tổ, 30/4...) để hệ thống tự miễn kiểm tra tiết học.',
    ],
  },
  {
    num: '3',
    step: 'shared',
    title: 'Hoạt động cả tuần (Mục tiêu, Thể dục sáng, 5 Góc chơi, Nề nếp)',
    time: '~3 phút',
    summary: 'Các hoạt động duy trì xuyên suốt cả 5 ngày trong tuần chỉ cần thiết lập 1 lần duy nhất, tự kế thừa suốt tuần.',
    actions: [
      'Rà soát Mã Mục tiêu (MT) đúng khối lớp — Nhà trẻ 24–36T có 4 lĩnh vực (NBTN), Mẫu giáo 3–6T có 5 lĩnh vực.',
      'Chọn nhanh 5 động tác Thể dục sáng, 5 Góc chơi, Ngoài trời và Đón – Ăn – Ngủ – Trả trẻ từ kho thực tế.',
    ],
  },
  {
    num: '4',
    step: 'focus',
    title: 'Giáo án Ngày (Trình soạn Word từng tiết + Kho Ngữ liệu & Media)',
    time: '~15 phút',
    summary: 'Soạn từng tiết gọn nhẹ (1–2 trang A4), xem Sổ trọn ngày và xuất Sổ KHGD Ngày theo khoảng Từ ngày – Đến ngày.',
    actions: [
      'Chèn nguyên văn Thơ, Truyện, Bài hát & 29 Chữ cái tiếng Việt 1 chạm hoặc đính kèm Video/Slide/Tranh Media vào bài dạy.',
      'Bấm “Lưu bài mẫu” để tái sử dụng cho năm sau; bấm “Sổ trọn ngày” hoặc “Xuất Sổ Ngày (.docx)” để in sổ lên lớp.',
    ],
  },
  {
    num: '5',
    step: 'preview',
    title: 'Bản in A4 chuẩn Nghị định 30/2020 & Kiểm duyệt 6 tiêu chí',
    time: '~1 phút',
    summary: 'Tự động ghép thành bộ hồ sơ KHGD A4 đủ 7 phần có Khóa an toàn chống ghi đè khi gõ chỉnh tay.',
    actions: [
      'Kiểm tra bảng 6 tiêu chí chất lượng Bộ GD&ĐT ở cột phải trước khi trình ký.',
      'Xuất Giáo án đầy đủ (.docx), Tờ Lịch Tuần 1 trang (.docx) gửi Phụ huynh hoặc Ma trận (.xlsx).',
    ],
  },
  {
    num: '6',
    step: 'closing',
    title: 'Đánh giá Trẻ 3 tầng (Ngày → Chủ đề → Năm) & Trình ký BGH',
    time: '~3 phút cuối tuần/tháng',
    summary: 'Liên thông nhận xét trẻ hàng ngày sang bảng tổng hợp cuối chủ đề/tháng (kèm ngày dd/mm) và ký duyệt trực tuyến.',
    actions: [
      'Ghi nhận trẻ nổi bật/cần rèn hằng ngày rồi bấm “Đồng bộ sang Cuối Chủ đề / Tháng”, xuất Phiếu tổng hợp & Phiếu từng trẻ (.docx).',
      'Trình ký trực tuyến, nhảy thẳng tới mục BGH góp ý sửa và đóng dấu phê duyệt đỏ lên Bản in A4.',
    ],
  },
];

const QUICK_TIPS = [
  {
    title: 'Chuyển nhanh giữa 4 Khối lớp (Nhà trẻ – Mầm – Chồi – Lá)',
    desc: 'Bấm vào tên giáo án ở góc trên bên trái để chuyển ngay giữa kế hoạch mẫu của 4 khối lớp, tạo tuần mới, hoặc nhân bản sang tuần kế tiếp.',
  },
  {
    title: 'Mở file giáo án Word (.docx) cũ có sẵn trên máy',
    desc: 'Trong menu góc trên bên trái chọn “Nhập file Word (.docx)”, hệ thống sẽ đọc nội dung & bảng biểu để cô chỉnh sửa tiếp ngay trên web.',
  },
  {
    title: 'Tự động lưu & Hoàn tác (Undo) an toàn',
    desc: 'Mọi chỉnh sửa tự động lưu sau 2,5 giây (hoặc bấm Ctrl+S). Nếu lỡ tay xóa nhầm tiết học, bấm nút “Hoàn tác” hiện ở góc dưới phải.',
  },
  {
    title: 'Chèn & sửa bảng trên trang Word',
    desc: 'Khi bấm chuột vào bất kỳ bảng nào trên trang Word, thanh “Công cụ bảng” sẽ tự hiện ra để cô thêm/xóa hàng, cột hoặc gộp/tách ô.',
  },
];

export const UserGuideModal: React.FC<Props> = ({ onClose, onGoToStep }) => {
  const [tab, setTab] = useState<'flow' | 'daily' | 'tips'>('flow');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Clean Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Hướng dẫn sử dụng nhanh</h2>
            <p className="text-xs text-slate-500">
              Quy trình 6 bước khép kín giúp giáo viên mầm non lập KHGD Năm – Tháng – Tuần – Ngày chuẩn Bộ GD&amp;ĐT
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Simple 3-Tab Switch */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-2.5">
          <button
            onClick={() => setTab('flow')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === 'flow'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
          >
            Quy trình 6 bước KHGD
          </button>
          <button
            onClick={() => setTab('daily')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === 'daily'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
          >
            Hoạt động hằng ngày (7h–17h)
          </button>
          <button
            onClick={() => setTab('tips')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === 'tips'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
          >
            Mẹo dùng nhanh &amp; Hỏi đáp
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'flow' ? (
            <div className="space-y-4">
              {GUIDE_STEPS.map((item) => (
                <div
                  key={item.num}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#1D4ED8]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white">
                        {item.num}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        <span className="text-[11px] font-medium text-slate-400">
                          Thời gian dự kiến: {item.time}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onGoToStep(item.step);
                        onClose();
                      }}
                      className="rounded-lg bg-[#DBEAFE] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white"
                    >
                      Mở Bước {item.num} →
                    </button>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{item.summary}</p>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                    {item.actions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-bold text-[#1D4ED8]">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : tab === 'daily' ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600">
                Tổng hợp các hoạt động phổ biến trong <strong>chế độ sinh hoạt 1 ngày của trẻ mầm non</strong> để các cô tham khảo nhanh khi soạn bài (cũng có thể bấm chèn trực tiếp tại <strong>Bước 2 → Lễ giáo &amp; Nêu gương</strong>).
              </p>
              {DAILY_ROUTINES_BANK.map((slot) => (
                <div key={slot.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{slot.title}</h3>
                    <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8]">
                      {slot.timeRange}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{slot.ageNote}</p>
                  <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                    {slot.activities.map((a, idx) => (
                      <li key={idx} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-900">{a.title}</div>
                        <div className="mt-0.5 leading-relaxed text-slate-600">{a.detail}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {QUICK_TIPS.map((tip, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <h3 className="text-sm font-bold text-slate-900">{tip.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{tip.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-xs text-slate-500">
            Cô có thể mở lại cẩm nang này bất cứ lúc nào bằng nút <strong>Hướng dẫn</strong> trên góc phải.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#1D4ED8] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Bắt đầu soạn bài
          </button>
        </div>
      </div>
    </div>
  );
};
