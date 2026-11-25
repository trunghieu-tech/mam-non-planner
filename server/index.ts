import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import {
  deleteLessonTemplate,
  deleteMediaResource,
  deletePlan,
  getAnnualPlans,
  getCrawledKbSummary,
  getCrawledSuggestionsByMt,
  getLessonTemplates,
  getLiteraryWorks,
  getMediaResources,
  getObjectivesDataset,
  getPlanById,
  getPlans,
  getThemeAssessments,
  saveLessonTemplate,
  saveMediaResource,
  searchCrawledDocs,
  searchCrawledLessons,
  upsertAnnualPlan,
  upsertPlan,
  upsertThemeAssessment,
} from './storage.js';
import { generateBgdDocx } from './docxExport.js';
import { generateDailyPlansDocx, type DailyExportOptions } from './dailyPlanDocx.js';
import { generateDocxFromEditorHtml } from './htmlToDocx.js';
import { generateParentScheduleDocx } from './parentScheduleDocx.js';
import {
  generateIndividualChildCardsDocx,
  generateThemeAssessmentDocx,
} from './themeAssessmentDocx.js';
import { parseUploadedDocx } from './docxImport.js';
import { generateWeeklyXlsx } from './xlsxExport.js';
import { generateAnnualPlanDocx, generateMonthlyPlanDocx } from './annualAndMonthDocx.js';
import type {
  AgeGroupId,
  AnnualPlanDocument,
  SavedLessonTemplate,
  SharedMediaResource,
  StudentRosterItem,
  ThemeAssessmentDocument,
  WeeklyPlanDocument,
} from '../shared/types.js';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get('/api/objectives', (req, res) => {
    const dataset = getObjectivesDataset();
    const ageGroupId = req.query.ageGroupId as string | undefined;
    if (ageGroupId) {
      return res.json({
        ...dataset,
        objectives: dataset.objectives.filter((o) => o.ageGroupId === ageGroupId),
      });
    }
    return res.json(dataset);
  });

  app.get('/api/kb/summary', (_req, res) => {
    res.json(getCrawledKbSummary());
  });

  app.get('/api/kb/suggestions', (req, res) => {
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const mtCode = req.query.mtCode as string | undefined;
    res.json(getCrawledSuggestionsByMt(ageGroupId, mtCode));
  });

  app.get('/api/kb/docs', (req, res) => {
    const q = (req.query.q as string) || '';
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const mtCode = req.query.mtCode as string | undefined;
    const limit = Math.min(100, Number(req.query.limit || 30));
    res.json(searchCrawledDocs(q, ageGroupId, mtCode, limit));
  });

  app.get('/api/kb/lessons', (req, res) => {
    const q = (req.query.q as string) || '';
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const subject = req.query.subject as string | undefined;
    const mtCode = req.query.mtCode as string | undefined;
    const slotType = req.query.slotType as string | undefined;
    const cornerSubType = req.query.cornerSubType as string | undefined;
    const limit = Math.min(120, Number(req.query.limit || 60));
    res.json(searchCrawledLessons(q, ageGroupId, subject, mtCode, limit, slotType, cornerSubType));
  });

  app.get('/api/kb/works', (req, res) => {
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const kind = req.query.kind as string | undefined;
    const q = req.query.q as string | undefined;
    res.json({ works: getLiteraryWorks({ ageGroupId, kind, q }) });
  });

  app.get('/api/annual-plans', (_req, res) => {
    res.json({ annualPlans: getAnnualPlans() });
  });

  app.put('/api/annual-plans/:ageGroupId', (req, res) => {
    const ageGroupId = req.params.ageGroupId as AgeGroupId;
    const body = req.body as AnnualPlanDocument;
    if (!body?.themes) {
      return res.status(400).json({ error: 'Thiếu dữ liệu Kế hoạch Năm học' });
    }
    const saved = upsertAnnualPlan(ageGroupId, body);
    return res.json({ annualPlan: saved });
  });

  app.get('/api/assessments', (_req, res) => {
    res.json({ assessments: getThemeAssessments() });
  });

  app.put('/api/assessments/:id', (req, res) => {
    const body = req.body as ThemeAssessmentDocument;
    if (!body?.themeName) {
      return res.status(400).json({ error: 'Thiếu thông tin Phiếu đánh giá chủ đề' });
    }
    const saved = upsertThemeAssessment({ ...body, id: req.params.id });
    return res.json({ assessment: saved });
  });

  app.post('/api/export/theme-assessment-docx', async (req, res) => {
    try {
      const { assessment, students } = req.body as {
        assessment: ThemeAssessmentDocument;
        students: StudentRosterItem[];
      };
      if (!assessment) {
        return res.status(400).json({ error: 'Thiếu dữ liệu đánh giá chủ đề' });
      }
      const dataset = getObjectivesDataset();
      const buffer = await generateThemeAssessmentDocx(
        assessment,
        students || [],
        dataset.objectives
      );
      const safeName = encodeURIComponent(
        `DanhGiaChuDe_${assessment.className.replace(/\s+/g, '')}_${assessment.themeName.replace(/\s+/g, '_')}.docx`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Theme assessment DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo Phiếu đánh giá chủ đề (.docx)' });
    }
  });

  // Xuất Phiếu Đánh giá cá nhân RIÊNG từng trẻ (mỗi bé 1 phiếu để in gửi phụ huynh — YC-041)
  app.post('/api/export/individual-assessments-docx', async (req, res) => {
    try {
      const { assessment, students } = req.body as {
        assessment: ThemeAssessmentDocument;
        students: StudentRosterItem[];
      };
      if (!assessment) {
        return res.status(400).json({ error: 'Thiếu dữ liệu đánh giá chủ đề' });
      }
      const dataset = getObjectivesDataset();
      const buffer = await generateIndividualChildCardsDocx(
        assessment,
        students || [],
        dataset.objectives
      );
      const safeName = encodeURIComponent(
        `PhieuCaNhanTungTre_${assessment.className.replace(/\s+/g, '')}_${assessment.themeName.replace(/\s+/g, '_')}.docx`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Individual assessments DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo Phiếu đánh giá riêng từng trẻ (.docx)' });
    }
  });

  // Thư viện Bài giảng mẫu cá nhân của Giáo viên (YC-038)
  app.get('/api/templates', (req, res) => {
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const subjectCode = req.query.subjectCode as string | undefined;
    res.json({ templates: getLessonTemplates(ageGroupId, subjectCode) });
  });

  app.post('/api/templates', (req, res) => {
    const body = req.body as SavedLessonTemplate;
    if (!body?.topicTitle || !body?.richHtml) {
      return res.status(400).json({ error: 'Thiếu nội dung bài giảng mẫu' });
    }
    const saved = saveLessonTemplate(body);
    return res.json({ template: saved });
  });

  app.delete('/api/templates/:id', (req, res) => {
    const ok = deleteLessonTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Không tìm thấy bài giảng mẫu' });
    return res.json({ ok: true });
  });

  // Kho Học liệu Media (Video, Slide, Tranh ảnh, E-Learning — YC-051, YC-053)
  app.get('/api/media', (req, res) => {
    const ageGroupId = req.query.ageGroupId as string | undefined;
    const subjectCode = req.query.subjectCode as string | undefined;
    const kind = req.query.kind as string | undefined;
    const q = req.query.q as string | undefined;
    res.json({ items: getMediaResources({ ageGroupId, subjectCode, kind, q }) });
  });

  app.post('/api/media', (req, res) => {
    const body = req.body as SharedMediaResource;
    if (!body?.title || !body?.url) {
      return res.status(400).json({ error: 'Vui lòng nhập tiêu đề và đường dẫn học liệu' });
    }
    const saved = saveMediaResource(body);
    return res.json({ item: saved });
  });

  app.delete('/api/media/:id', (req, res) => {
    const ok = deleteMediaResource(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Không tìm thấy học liệu' });
    return res.json({ ok: true });
  });

  // Xuất Sổ KẾ HOẠCH GIÁO DỤC NGÀY (.docx) theo khoảng Từ ngày – Đến ngày (YC-050)
  app.post('/api/export/daily-plans-docx', async (req, res) => {
    try {
      const { plans, options } = req.body as {
        plans: WeeklyPlanDocument[];
        options: DailyExportOptions;
      };
      if (!Array.isArray(plans) || plans.length === 0 || !options?.fromDate) {
        return res.status(400).json({ error: 'Thiếu dữ liệu kế hoạch ngày để xuất' });
      }
      const buffer = await generateDailyPlansDocx(plans, options);
      const cls = (plans[0].className || 'Lop').replace(/\s+/g, '');
      const safeName = encodeURIComponent(
        `SoGiaoAnNgay_${cls}_${options.fromDate}_den_${options.toDate}.docx`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Daily plans DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo Sổ Giáo án Ngày (.docx)' });
    }
  });

  app.get('/api/plans', (_req, res) => {
    res.json({ plans: getPlans() });
  });

  app.get('/api/plans/:id', (req, res) => {
    const plan = getPlanById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
    return res.json({ plan });
  });

  app.post('/api/plans', (req, res) => {
    const body = req.body as WeeklyPlanDocument;
    if (!body?.id || !body?.themeName) {
      return res.status(400).json({ error: 'Thiếu thông tin kế hoạch' });
    }
    const saved = upsertPlan(body);
    return res.json({ plan: saved });
  });

  app.put('/api/plans/:id', (req, res) => {
    const body = req.body as WeeklyPlanDocument;
    const saved = upsertPlan({ ...body, id: req.params.id });
    return res.json({ plan: saved });
  });

  app.delete('/api/plans/:id', (req, res) => {
    const ok = deletePlan(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
    return res.json({ ok: true });
  });

  // Nhập file .docx có sẵn của giáo viên lên trình soạn thảo Word Studio
  app.post('/api/import/docx', async (req, res) => {
    try {
      const { filename, base64 } = req.body as { filename?: string; base64?: string };
      if (!base64 || !filename) {
        return res.status(400).json({ error: 'Thiếu dữ liệu file .docx' });
      }
      const buffer = Buffer.from(base64, 'base64');
      const parsed = await parseUploadedDocx(buffer, filename);
      return res.json({ ok: true, imported: parsed });
    } catch (err) {
      console.error('DOCX import error:', err);
      return res.status(500).json({ error: 'Không đọc được file .docx. Vui lòng chọn file Word (.docx) hợp lệ.' });
    }
  });

  // Export Word chuẩn BGD (.docx) — ưu tiên xuất trung thực nội dung đã soạn trên trình Word WYSIWYG!
  app.post('/api/export/docx', async (req, res) => {
    try {
      const plan = req.body as WeeklyPlanDocument;
      const dataset = getObjectivesDataset();
      const buffer =
        plan.editorHtml && plan.editorHtml.trim().length > 30
          ? await generateDocxFromEditorHtml(plan.editorHtml, plan)
          : await generateBgdDocx(plan, dataset.objectives);
      const safeName = encodeURIComponent(
        `KeHoach_Tuan${plan.weekNumber}_${plan.className.replace(/\s+/g, '')}_${plan.subThemeName.replace(/\s+/g, '_')}.docx`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo file Word chuẩn BGD' });
    }
  });

  app.get('/api/plans/:id/export-docx', async (req, res) => {
    try {
      const plan = getPlanById(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
      const dataset = getObjectivesDataset();
      const buffer =
        plan.editorHtml && plan.editorHtml.trim().length > 30
          ? await generateDocxFromEditorHtml(plan.editorHtml, plan)
          : await generateBgdDocx(plan, dataset.objectives);
      const safeName = encodeURIComponent(`KeHoach_Tuan${plan.weekNumber}_${plan.className}.docx`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo file Word chuẩn BGD' });
    }
  });

  // Export Tờ Lịch Tuần 1 trang A4 ngang gửi Phụ huynh / dán bảng tin lớp
  app.post('/api/export/parent-schedule-docx', async (req, res) => {
    try {
      const plan = req.body as WeeklyPlanDocument;
      const buffer = await generateParentScheduleDocx(plan);
      const safeName = encodeURIComponent(
        `LichTuan${plan.weekNumber}_PhuHuynh_${plan.className.replace(/\s+/g, '')}.docx`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Parent schedule DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo tờ lịch tuần gửi phụ huynh' });
    }
  });

  // Export Sổ Kế hoạch Giáo dục Năm học (.docx) & Kế hoạch Giáo dục Tháng (.docx)
  app.post('/api/export/annual-docx', async (req, res) => {
    try {
      const { annualPlan } = req.body;
      const dataset = getObjectivesDataset();
      const buffer = await generateAnnualPlanDocx(annualPlan, dataset.objectives);
      const safeName = encodeURIComponent(`KHGD_NamHoc_${(annualPlan?.profile?.className || 'Lop').replace(/\s+/g, '')}.docx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Annual DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo Sổ KHGD Năm học' });
    }
  });

  app.post('/api/export/month-docx', async (req, res) => {
    try {
      const { theme, monthPlans, profile } = req.body;
      const dataset = getObjectivesDataset();
      const buffer = await generateMonthlyPlanDocx(theme, monthPlans || [], dataset.objectives, profile);
      const safeName = encodeURIComponent(`KHGD_${(theme?.monthLabel || 'Thang').replace(/\s+/g, '')}_${(profile?.className || 'Lop').replace(/\s+/g, '')}.docx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Month DOCX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo KHGD Tháng' });
    }
  });

  // Export Excel (.xlsx)
  app.post('/api/export/xlsx', async (req, res) => {
    try {
      const plan = req.body as WeeklyPlanDocument;
      const dataset = getObjectivesDataset();
      const buffer = await generateWeeklyXlsx(plan, dataset.objectives);
      const safeName = encodeURIComponent(`KeHoach_Tuan${plan.weekNumber}_${plan.className}.xlsx`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('XLSX export error:', err);
      return res.status(500).json({ error: 'Lỗi khi tạo file Excel' });
    }
  });

  // --- VITE MIDDLEWARE OR STATIC DIST ---
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Mam Non Planner Demo running at http://localhost:${PORT}`);
  });
}

startServer();
