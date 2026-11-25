export interface DailyRoutineSlot {
  id: string;
  timeRange: string;
  title: string;
  targetField: 'welcome' | 'tds' | 'outdoor' | 'corners' | 'hygiene' | 'etiquette' | 'afternoon' | 'praise';
  ageNote: string;
  activities: Array<{
    title: string;
    detail: string;
  }>;
}

/**
 * Kho Hoạt động Hằng ngày phổ biến trong Chế độ sinh hoạt 1 ngày của trẻ Mầm non (7h00 – 17h00)
 * theo Chương trình GDMN (01/VBHN-BGDĐT) và thực tế các trường mầm non.
 */
export const DAILY_ROUTINES_BANK: DailyRoutineSlot[] = [
  {
    id: 'welcome',
    timeRange: '7h00 – 8h00',
    title: '1. Đón trẻ – Trò chuyện sáng – Điểm danh',
    targetField: 'welcome',
    ageNote: 'Nhà trẻ: âu yếm vỗ về trẻ mới; Mẫu giáo: rèn tự cất đồ dùng & trò chuyện lịch thời tiết.',
    activities: [
      {
        title: 'Chào hỏi lễ phép & Bảng cảm xúc buổi sáng',
        detail: 'Trẻ khoanh tay chào cô, chào ba mẹ; tự gắn thẻ tên vào ô cảm xúc (vui, hào hứng, nhớ mẹ) hoặc chọn kiểu chào yêu thích (đập tay, ôm cô, bắt tay).',
      },
      {
        title: 'Tự cất đồ dùng cá nhân đúng ký hiệu',
        detail: 'Rèn trẻ tự cất ba lô vào tủ, xếp dép gọn gàng đúng ngăn có ký hiệu riêng của mình.',
      },
      {
        title: 'Trò chuyện đầu giờ & Bảng lịch – thời tiết',
        detail: 'Cùng trẻ trò chuyện về chủ đề tuần, xem tranh ảnh mới, chọn thẻ thứ/ngày và thời tiết hôm nay (nắng, mưa, nhiều mây).',
      },
      {
        title: 'Điểm danh theo tổ & Kiểm tra sức khỏe đầu ngày',
        detail: 'Tổ trưởng báo cáo bạn đi học/vắng (lớp Chồi – Lá); cô quan sát sắc mặt, thân nhiệt và trao đổi nhanh với phụ huynh.',
      },
      {
        title: 'Chơi nhẹ ở các góc trong khi chờ đủ bạn',
        detail: 'Cho trẻ xem sách tranh, lắp ráp nhẹ hoặc chơi đồ chơi mở trong lúc đợi các bạn đến lớp.',
      },
    ],
  },
  {
    id: 'tds',
    timeRange: '8h00 – 8h15',
    title: '2. Thể dục sáng',
    targetField: 'tds',
    ageNote: 'Nhà trẻ tập 2l × 4n đơn giản; Mẫu giáo tập 2l–4l × 8n kết hợp dụng cụ.',
    activities: [
      {
        title: 'Tập 5 nhóm động tác phát triển chung theo nhạc chủ đề',
        detail: 'Khởi động đi vòng tròn các kiểu chân → Trọng động (Hô hấp, Tay, Bụng, Chân, Bật) → Hồi tỉnh thả lỏng.',
      },
      {
        title: 'Thể dục sáng kết hợp dụng cụ (vòng, gậy, nơ, bông tua)',
        detail: 'Tạo hứng thú và tăng độ chính xác biên độ động tác tay – lưng – chân theo nhịp bài hát.',
      },
      {
        title: 'Vận động nhịp điệu Aerobic / Dân vũ thiếu nhi nhẹ',
        detail: 'Thay đổi không khí vào Thứ 4 hoặc Thứ 6 bằng bài nhảy dân vũ ngắn vui nhộn trên sân trường.',
      },
    ],
  },
  {
    id: 'outdoor',
    timeRange: '9h00 – 9h45',
    title: '3. Hoạt động ngoài trời',
    targetField: 'outdoor',
    ageNote: 'Gồm 3 phần chuẩn: Quan sát có mục đích + TCVĐ/TCDG + Chơi tự do với thiên nhiên.',
    activities: [
      {
        title: 'Quan sát thiên nhiên, vườn rau, cây xanh & thời tiết',
        detail: 'Trẻ dùng giác quan quan sát lá cây, hoa nở, côn trùng, nắng gió; đặt câu hỏi mở kích thích tư duy.',
      },
      {
        title: 'Chơi Trò chơi vận động (TCVĐ) tập thể',
        detail: 'Phổ biến nhất: Mèo đuổi chuột, Cáo và Thỏ, Lộn cầu vồng, Ô tô và chim sẻ, Chuyền bóng, Trời nắng trời mưa.',
      },
      {
        title: 'Chơi Trò chơi dân gian (TCDG) kết hợp đồng dao',
        detail: 'Phổ biến nhất: Chi chi chành chành, Rồng rắn lên mây, Dung dăng dung dẻ, Nu na nu nống, Kéo cưa lừa xẻ, Bịt mắt bắt dê.',
      },
      {
        title: 'Chơi tự do với cát – nước – lá rụng – vẽ phấn sân trường',
        detail: 'Trẻ sáng tạo xếp hình từ sỏi/lá cây, vẽ phấn trên sân, thổi bong bóng xà phòng hoặc chơi cầu trượt an toàn.',
      },
      {
        title: 'Chăm sóc vườn cây xanh của lớp',
        detail: 'Trẻ dùng bình tưới nhỏ tưới cây, lau lá xanh, nhặt lá vàng bỏ vào thùng rác.',
      },
    ],
  },
  {
    id: 'corners',
    timeRange: '9h45 – 10h30',
    title: '4. Hoạt động góc (Chơi theo ý thích ở 5 góc)',
    targetField: 'corners',
    ageNote: 'Nhà trẻ ưu tiên thao tác vai & đồ vật; Mẫu giáo liên kết vai chơi giữa 5 góc.',
    activities: [
      {
        title: 'Góc phân vai (Gia đình, Bác sĩ, Bán hàng, Nấu ăn)',
        detail: 'Trẻ thỏa thuận vai chơi, biết giao tiếp lịch sự, sử dụng vật thay thế sáng tạo.',
      },
      {
        title: 'Góc xây dựng – lắp ráp',
        detail: 'Xếp chồng, xếp cạnh, lắp ráp công trình theo chủ đề (trường học, công viên, ngôi nhà, đường phố).',
      },
      {
        title: 'Góc nghệ thuật (Tạo hình & Âm nhạc)',
        detail: 'Vẽ, tô màu, nặn, xé dán bằng nguyên vật liệu mở; biểu diễn hát múa với phách tre, trống lắc.',
      },
      {
        title: 'Góc học tập – Thư viện sách',
        detail: 'Xem sách tranh, kể chuyện theo tranh, ghép thẻ số/chữ cái, chơi lô tô, phân loại hình khối.',
      },
      {
        title: 'Góc thiên nhiên – Khoa học',
        detail: 'Gieo hạt, quan sát cây nảy mầm, thí nghiệm vật chìm – nổi, pha màu nước cơ bản.',
      },
    ],
  },
  {
    id: 'hygiene_lunch',
    timeRange: '10h30 – 11h45',
    title: '5. Vệ sinh – Ăn trưa',
    targetField: 'hygiene',
    ageNote: 'Rèn tối đa tính tự phục vụ và văn hóa bàn ăn hằng ngày.',
    activities: [
      {
        title: 'Thực hành 6 bước rửa tay bằng xà phòng trước khi ăn',
        detail: 'Trẻ xếp hàng chờ đến lượt, rửa tay đúng quy trình, tắt vòi nước tiết kiệm và lau tay bằng khăn đúng ký hiệu.',
      },
      {
        title: 'Trực nhật giờ ăn (Lớp Chồi – Lá)',
        detail: 'Trẻ luân phiên lau bàn ăn bằng khăn sạch, chia khăn ăn, bát thìa và đặt đĩa đựng thức ăn rơi vãi.',
      },
      {
        title: 'Giới thiệu món ăn & Văn hóa bàn ăn',
        detail: 'Cô giới thiệu tên món ăn và lợi ích dinh dưỡng; trẻ biết mời cô, mời bạn, tự xúc ăn gọn gàng, không nói chuyện to.',
      },
      {
        title: 'Vệ sinh sau khi ăn',
        detail: 'Trẻ tự cất bát thìa đúng nơi quy định, lau miệng, uống nước ấm / súc miệng nước muối sinh lý và đi vệ sinh.',
      },
    ],
  },
  {
    id: 'nap',
    timeRange: '11h45 – 14h00',
    title: '6. Ngủ trưa',
    targetField: 'hygiene',
    ageNote: 'Phòng ngủ yên tĩnh, thoáng mát; trẻ Chồi – Lá tự trải/cất gối chăn.',
    activities: [
      {
        title: 'Chuẩn bị chỗ ngủ & Tự lấy gối đúng ký hiệu',
        detail: 'Trẻ tự lấy gối, chăn cá nhân trải gọn gàng theo hàng (trẻ Nhà trẻ được cô hỗ trợ).',
      },
      {
        title: 'Nghe nhạc không lời / Hát ru nhẹ nhàng vào giấc ngủ',
        detail: 'Tạo không gian ấm áp, êm dịu giúp trẻ ngủ sâu giấc đủ 120–150 phút để phục hồi năng lượng.',
      },
      {
        title: 'Thu dọn chăn gối sau khi ngủ dậy',
        detail: 'Trẻ tự gấp chăn nhỏ, xếp gối vào kệ ngăn nắp và đi vệ sinh cá nhân.',
      },
    ],
  },
  {
    id: 'afternoon',
    timeRange: '14h00 – 15h45',
    title: '7. Vận động nhẹ – Ăn xế – Hoạt động chiều',
    targetField: 'afternoon',
    ageNote: 'Khung giờ vàng để ôn bài yếu, rèn kỹ năng sống và làm quen bài mới nhẹ nhàng.',
    activities: [
      {
        title: 'Vận động chống mệt mỏi sau ngủ dậy & Chải tóc gọn gàng',
        detail: 'Vươn vai, xoay khớp nhẹ 3–5 phút theo nhạc vui; bé gái được cô buộc lại tóc gọn gàng trước khi ăn xế.',
      },
      {
        title: 'Ôn luyện kiến thức buổi sáng & Hoàn thiện sản phẩm',
        detail: 'Hỗ trợ nhóm trẻ chưa hoàn thành bài vẽ/tô/nặn hoặc chưa thuộc bài thơ, bài hát buổi sáng.',
      },
      {
        title: 'Làm quen trước bài học mới ngày hôm sau',
        detail: 'Cho trẻ nghe trước giai điệu bài hát mới, xem tranh truyện hoặc làm quen từ vựng/chữ cái mới.',
      },
      {
        title: 'Rèn kỹ năng sống & Tự phục vụ hằng ngày',
        detail: 'Tập gấp quần áo, cài khuy áo, đi tất/giày, vắt khăn, nhận biết tình huống nguy hiểm và cách ứng xử lịch sự.',
      },
      {
        title: 'Thí nghiệm STEAM mini / Đọc sách tương tác / Văn nghệ Thứ 6',
        detail: 'Làm thí nghiệm vui (sự đổi màu, vật chìm nổi), kể chuyện rối tay hoặc biểu diễn văn nghệ cuối tuần.',
      },
    ],
  },
  {
    id: 'praise_pickup',
    timeRange: '15h45 – 17h00',
    title: '8. Nêu gương – Vệ sinh – Trả trẻ',
    targetField: 'praise',
    ageNote: 'Thứ 2–5 cắm cờ cuối ngày; Thứ 6 phát Phiếu bé ngoan & tổng kết tuần.',
    activities: [
      {
        title: 'Nêu gương cuối ngày theo 3 Tiêu chuẩn Bé ngoan',
        detail: 'Trẻ tự nhận xét mình và bạn về lễ phép, học ngoan, chơi đoàn kết; lên cắm cờ vào ô tên của mình.',
      },
      {
        title: 'Phát Phiếu bé ngoan chiều Thứ Sáu',
        detail: 'Hát bài “Cả tuần đều ngoan”, tuyên dương trẻ đạt đủ cờ và động viên trẻ còn thiếu cố gắng tuần sau.',
      },
      {
        title: 'Vệ sinh chỉnh trang & Chơi nhẹ chờ phụ huynh',
        detail: 'Rửa mặt, lau tay sạch sẽ, kiểm tra ba lô/đồ dùng cá nhân; trẻ chơi nhẹ nhàng trong lớp.',
      },
      {
        title: 'Trao đổi tình hình ngày với phụ huynh & Trả trẻ tận tay',
        detail: 'Nhắc trẻ khoanh tay chào cô, trao tận tay phụ huynh (kèm sản phẩm tạo hình của bé nếu có) và trao đổi ngắn về sức khỏe/kỹ năng cần phối hợp.',
      },
    ],
  },
];

/**
 * Kho gợi ý chuẩn BGD dự phòng cho 5 Góc chơi chia theo độ tuổi (Nhà trẻ vs Mẫu giáo)
 * để đảm bảo KHÔNG BAO GIỜ bị trống 0 gợi ý ở bất kỳ góc nào.
 */
export const CORNER_FALLBACK_IDEAS: Record<'NHA_TRE' | 'MAU_GIAO', Record<string, string[]>> = {
  NHA_TRE: {
    'Góc phân vai': [
      'Thao tác vai bế em, ru em ngủ, cho búp bê ăn bột và uống sữa',
      'Chơi nấu ăn đơn giản với bộ xoong nồi nhựa, bát thìa an toàn',
      'Chơi bác sĩ khám bệnh cho gấu bông và búp bê',
    ],
    'Góc xây dựng': [
      'Xếp chồng 4–6 khối gỗ làm tháp cao, ngôi nhà nhỏ',
      'Xếp cạnh hàng rào, con đường cho ô tô đồ chơi chạy',
      'Lắp ráp các khối nhựa lớn màu sắc cơ bản (xanh, đỏ, vàng)',
    ],
    'Góc nghệ thuật': [
      'Di màu tự do bằng bút sáp to, chấm màu nước in dấu ngón tay',
      'Bóp đất nặn mềm, lăn dọc làm viên kẹo / con giun',
      'Vỗ tay, lắc trống lắc và nhún nhảy theo giai điệu bài hát quen thuộc',
    ],
    'Góc học tập – Thư viện': [
      'Xem sách tranh bìa cứng cỡ lớn, chỉ và gọi tên đồ vật / con vật quen thuộc',
      'Chơi xâu hạt gỗ lỗ to, luồn dây và đóng mở nắp hộp rèn vận động tinh',
      'Chọn và phân loại đồ chơi theo 2 màu cơ bản (đỏ – xanh) hoặc to – nhỏ',
    ],
    'Góc thiên nhiên': [
      'Tưới cây xanh bằng bình tưới mini cùng cô và lau lá cây',
      'Chơi thả bóng / đồ chơi nhựa trong chậu nước an toàn, cảm nhận vật nổi',
      'Sờ và cảm nhận sỏi nhẵn, lá cây xanh và hoa tươi trong lớp',
    ],
  },
  MAU_GIAO: {
    'Góc phân vai': [
      'Gia đình: nấu ăn, chăm sóc em bé, tiếp khách và trò chuyện lịch sự',
      'Bán hàng siêu thị / cửa hàng thực phẩm, biết chào mời và cảm ơn khách',
      'Phòng khám bác sĩ / Chú cảnh sát giao thông hướng dẫn người đi đường',
    ],
    'Góc xây dựng': [
      'Xây dựng trường mầm non, ngôi nhà của bé, công viên cây xanh',
      'Xếp ngã tư đường phố, bến xe, hàng rào và lắp ráp mô hình phương tiện giao thông',
      'Phân công nhóm xây dựng công trình theo chủ đề và tự giới thiệu sản phẩm',
    ],
    'Góc nghệ thuật': [
      'Vẽ, tô màu, nặn, xé dán tranh theo chủ đề bằng nguyên vật liệu mở',
      'Biểu diễn hát múa với phách tre, trống lắc, xắc xô và mũ nhân vật',
      'Làm thiệp, trang trí khung ảnh và trưng bày sản phẩm nghệ thuật của lớp',
    ],
    'Góc học tập – Thư viện': [
      'Xem sách tranh, kể chuyện sáng tạo theo tranh minh họa và giữ gìn sách gọn gàng',
      'Chơi lô tô phân loại đối tượng, ghép thẻ số – số lượng và hình học cơ bản',
      'Ghép tranh cắt rời, tìm điểm giống – khác nhau và trò chơi chữ cái (lớp lớn)',
    ],
    'Góc thiên nhiên': [
      'Chăm sóc vườn cây xanh của lớp: tưới nước, lau lá, nhặt lá vàng',
      'Gieo hạt đậu, quan sát sự nảy mầm và ghi nhận sự lớn lên của cây',
      'Thí nghiệm vui khám phá vật chìm – nổi, sự hòa tan và pha màu nước cơ bản',
    ],
  },
};
