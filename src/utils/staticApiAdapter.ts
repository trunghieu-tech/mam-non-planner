import { buildDefaultAnnualPlan, buildDefaultTimetable } from '../../shared/annualCurriculum';
import { base64ToUint8 } from '../../shared/binary';
import type {
  AgeGroupId,
  AnnualPlanDocument,
  LiteraryWorkItem,
  ObjectivesDataset,
  SavedLessonTemplate,
  SharedMediaResource,
  StudentRosterItem,
  ThemeAssessmentDocument,
  WeeklyPlanDocument,
} from '../../shared/types';
import { normVN } from './helpers';

const LS_KEYS = {
  PLANS: 'mn_static_plans_v1',
  ANNUAL: 'mn_static_annual_plans_v1',
  ASSESSMENTS: 'mn_static_assessments_v1',
  TEMPLATES: 'mn_static_templates_v1',
  MEDIA: 'mn_static_media_v1',
};

const ALL_AGE_GROUPS: AgeGroupId[] = ['NHA_TRE_24_36T', 'MAM_3_4T', 'CHOI_4_5T', 'LA_5_6T'];

interface StaticCrawledDoc {
  id: number;
  ageGroupId: string;
  schoolName: string;
  schoolHost: string;
  postTitle: string;
  filename: string;
  ext: string;
  detectedMonth: string;
  postUrl: string;
  matchedMts: Array<{ code: string; score: number; tier: string }>;
  extractedLessons: Array<{
    subject: string;
    topic: string;
    type: string;
    slotType?: string;
    cornerSubType?: string;
    mtCode?: string;
    score?: number;
  }>;
  snippet: string;
}

function staticAssetUrl(file: string): string {
  const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = metaEnv?.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(`${normalizedBase}static-data/${file}`, window.location.href).toString();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function binaryResponse(bytes: Uint8Array, contentType: string): Response {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(new Blob([copy], { type: contentType }), {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

export async function initStaticApiIfNeeded(): Promise<void> {
  const nativeFetch = window.fetch.bind(window);

  // Kiểm tra nhanh xem backend Express có đang chạy không
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const res = await nativeFetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      return; // Đang chạy với Express backend thật -> giữ nguyên fetch gốc!
    }
  } catch {
    // Không có backend -> kích hoạt chế độ Static Web App (GitHub Pages)
  }

  console.info('[Mầm Non Planner] Đang chạy chế độ Static Web Demo (GitHub Pages + LocalStorage + Browser Word/Excel Export).');

  let cachedSeedObjectives: ObjectivesDataset | null = null;
  let cachedKbSummary: Record<string, unknown> | null = null;
  let cachedKbByMt: Record<string, Record<string, unknown>> | null = null;
  let cachedCrawledDocs: StaticCrawledDoc[] | null = null;
  let cachedWorks: LiteraryWorkItem[] | null = null;

  const fetchStaticJson = async <T>(file: string, fallback: T): Promise<T> => {
    try {
      const r = await nativeFetch(staticAssetUrl(file));
      if (!r.ok) return fallback;
      return (await r.json()) as T;
    } catch {
      return fallback;
    }
  };

  const getSeedObjectives = async (): Promise<ObjectivesDataset> => {
    if (!cachedSeedObjectives) {
      cachedSeedObjectives = await fetchStaticJson<ObjectivesDataset>('seed_objectives.json', {
        totalObjectives: 0,
        totalActivities: 0,
        ageGroups: [],
        objectives: [],
      });
    }
    return cachedSeedObjectives;
  };

  const normalizeAnnualMap = (
    map: Record<AgeGroupId, AnnualPlanDocument>,
    seedObjectives: ObjectivesDataset['objectives']
  ): Record<AgeGroupId, AnnualPlanDocument> => {
    for (const ag of ALL_AGE_GROUPS) {
      const defaults = buildDefaultAnnualPlan(ag, seedObjectives);
      if (!map[ag]) {
        map[ag] = defaults;
        continue;
      }
      if (!map[ag].timetable) {
        map[ag].timetable = buildDefaultTimetable(ag);
      }
      if (!map[ag].endOfYearMtCodes) {
        map[ag].endOfYearMtCodes = defaults.endOfYearMtCodes;
      }
      if (map[ag].nonObjectiveActivitiesNote === undefined) {
        map[ag].nonObjectiveActivitiesNote = defaults.nonObjectiveActivitiesNote;
      }
      if (map[ag].profile && Array.isArray(map[ag].profile.students)) {
        map[ag].profile.students = map[ag].profile.students.map((st, idx) => ({
          ...st,
          studentCode: st.studentCode || `HS${String(idx + 1).padStart(2, '0')}`,
        }));
      }
    }
    return map;
  };

  const getAnnualPlansMap = async (): Promise<Record<AgeGroupId, AnnualPlanDocument>> => {
    const seedDs = await getSeedObjectives();
    const rawLs = localStorage.getItem(LS_KEYS.ANNUAL);
    if (rawLs) {
      try {
        const parsed = JSON.parse(rawLs) as Record<AgeGroupId, AnnualPlanDocument>;
        return normalizeAnnualMap(parsed, seedDs.objectives);
      } catch {
        // ignore invalid localStorage
      }
    }
    const map = await fetchStaticJson<Record<AgeGroupId, AnnualPlanDocument>>(
      'annual_plans.json',
      {} as Record<AgeGroupId, AnnualPlanDocument>
    );
    normalizeAnnualMap(map, seedDs.objectives);
    localStorage.setItem(LS_KEYS.ANNUAL, JSON.stringify(map));
    return map;
  };

  const getMergedObjectives = async (): Promise<ObjectivesDataset> => {
    const seed = await getSeedObjectives();
    const annualMap = await getAnnualPlansMap();
    const customList = Object.values(annualMap || {}).flatMap((ap) => ap?.customObjectives || []);
    if (customList.length === 0) return seed;
    const seen = new Set(seed.objectives.map((o) => `${o.ageGroupId}:${o.code}`));
    const merged = [...seed.objectives];
    for (const c of customList) {
      const k = `${c.ageGroupId}:${c.code}`;
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(c);
      }
    }
    return { ...seed, totalObjectives: merged.length, objectives: merged };
  };

  const getPlansList = async (): Promise<WeeklyPlanDocument[]> => {
    const rawLs = localStorage.getItem(LS_KEYS.PLANS);
    if (rawLs) {
      try {
        return JSON.parse(rawLs) as WeeklyPlanDocument[];
      } catch {
        // ignore
      }
    }
    let list = await fetchStaticJson<WeeklyPlanDocument[]>('plans.json', []);
    if (!list.length) {
      list = await fetchStaticJson<WeeklyPlanDocument[]>('seed_plans.json', []);
    }
    localStorage.setItem(LS_KEYS.PLANS, JSON.stringify(list));
    return list;
  };

  const savePlansList = (list: WeeklyPlanDocument[]) => {
    localStorage.setItem(LS_KEYS.PLANS, JSON.stringify(list));
  };

  const getAssessmentsList = async (): Promise<ThemeAssessmentDocument[]> => {
    const rawLs = localStorage.getItem(LS_KEYS.ASSESSMENTS);
    if (rawLs) {
      try {
        return JSON.parse(rawLs) as ThemeAssessmentDocument[];
      } catch {
        // ignore
      }
    }
    const list = await fetchStaticJson<ThemeAssessmentDocument[]>('assessments.json', []);
    localStorage.setItem(LS_KEYS.ASSESSMENTS, JSON.stringify(list));
    return list;
  };

  const getTemplatesList = async (): Promise<SavedLessonTemplate[]> => {
    const rawLs = localStorage.getItem(LS_KEYS.TEMPLATES);
    if (rawLs) {
      try {
        return JSON.parse(rawLs) as SavedLessonTemplate[];
      } catch {
        // ignore
      }
    }
    const list = await fetchStaticJson<SavedLessonTemplate[]>('lesson_templates.json', []);
    localStorage.setItem(LS_KEYS.TEMPLATES, JSON.stringify(list));
    return list;
  };

  let cachedSeedMedia: SharedMediaResource[] | null = null;

  const getMediaList = async (): Promise<SharedMediaResource[]> => {
    if (!cachedSeedMedia) {
      cachedSeedMedia = await fetchStaticJson<SharedMediaResource[]>('media_resources.json', []);
    }
    let userItems: SharedMediaResource[] = [];
    const rawLs = localStorage.getItem(LS_KEYS.MEDIA);
    if (rawLs) {
      try {
        const parsed = JSON.parse(rawLs) as SharedMediaResource[];
        userItems = parsed.filter((x) => x.id.startsWith('med_17') || x.id.startsWith('med_user_'));
      } catch {
        // ignore
      }
    }
    const seen = new Set(userItems.map((x) => x.id));
    return [...userItems, ...cachedSeedMedia.filter((x) => !seen.has(x.id))];
  };

  const getCrawledDocs = async (): Promise<StaticCrawledDoc[]> => {
    if (!cachedCrawledDocs) {
      cachedCrawledDocs = await fetchStaticJson<StaticCrawledDoc[]>('crawled_docs.json', []);
    }
    return cachedCrawledDocs;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(rawUrl, window.location.origin);
    const pathname = parsedUrl.pathname;

    // Chỉ chặn các route /api/... (kể cả khi đặt trong subpath)
    const apiIdx = pathname.indexOf('/api/');
    if (apiIdx < 0) {
      return nativeFetch(input, init);
    }

    const apiPath = pathname.slice(apiIdx); // Bắt đầu từ '/api/...'
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const sp = parsedUrl.searchParams;

    const parseJsonBody = async <T>(): Promise<T> => {
      if (!init?.body) return {} as T;
      if (typeof init.body === 'string') return JSON.parse(init.body) as T;
      return {} as T;
    };

    try {
      if (apiPath === '/api/health') {
        return jsonResponse({ ok: true, mode: 'static-github-pages', time: new Date().toISOString() });
      }

      if (apiPath === '/api/objectives' && method === 'GET') {
        const ds = await getMergedObjectives();
        const ageGroupId = sp.get('ageGroupId');
        if (ageGroupId) {
          return jsonResponse({
            ...ds,
            objectives: ds.objectives.filter((o) => o.ageGroupId === ageGroupId),
          });
        }
        return jsonResponse(ds);
      }

      if (apiPath === '/api/kb/summary' && method === 'GET') {
        if (!cachedKbSummary) {
          cachedKbSummary = await fetchStaticJson<Record<string, unknown>>('kb_summary.json', {
            totalDocs: 0,
            totalLessons: 0,
            totalSchools: 0,
            byAgeGroup: {},
          });
        }
        return jsonResponse({ available: true, ...cachedKbSummary });
      }

      if (apiPath === '/api/kb/suggestions' && method === 'GET') {
        if (!cachedKbByMt) {
          cachedKbByMt = await fetchStaticJson<Record<string, Record<string, unknown>>>('kb_by_mt.json', {});
        }
        const ageGroupId = sp.get('ageGroupId') || '';
        const mtCode = sp.get('mtCode') || '';
        if (ageGroupId && mtCode) {
          return jsonResponse({ available: true, entry: cachedKbByMt[ageGroupId]?.[mtCode] ?? null });
        }
        if (ageGroupId) {
          return jsonResponse({ available: true, byMt: cachedKbByMt[ageGroupId] ?? {} });
        }
        return jsonResponse({ available: true, all: cachedKbByMt });
      }

      if (apiPath === '/api/kb/docs' && method === 'GET') {
        const allDocs = await getCrawledDocs();
        const q = normVN(sp.get('q') || '');
        const ageGroupId = sp.get('ageGroupId') || '';
        const mtCode = sp.get('mtCode') || '';
        const limit = Math.min(100, Number(sp.get('limit') || 30));
        const filtered = allDocs.filter((d) => {
          if (ageGroupId && d.ageGroupId !== ageGroupId) return false;
          if (mtCode && !d.matchedMts?.some((m) => m.code === mtCode)) return false;
          if (q) {
            const hay = normVN(
              `${d.postTitle} ${d.schoolName} ${d.filename} ${d.snippet} ${(d.extractedLessons || []).map((l) => `${l.subject} ${l.topic}`).join(' ')}`
            );
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return jsonResponse({ available: true, total: filtered.length, items: filtered.slice(0, limit) });
      }

      if (apiPath === '/api/kb/lessons' && method === 'GET') {
        const allDocs = await getCrawledDocs();
        const q = normVN(sp.get('q') || '');
        const ageGroupId = sp.get('ageGroupId') || '';
        const rawSubj = sp.get('subject') || '';
        const subjNorm = rawSubj && rawSubj !== 'ALL' && rawSubj !== 'Tất cả' ? normVN(rawSubj) : '';
        const mtUpper = (sp.get('mtCode') || '').trim().toUpperCase();
        const slotUpper = (sp.get('slotType') || '').trim().toUpperCase();
        const rawCornerParam = sp.get('cornerSubType') || '';
        const cornerNorm = rawCornerParam && rawCornerParam !== 'ALL' ? normVN(rawCornerParam) : '';
        const limit = Math.min(120, Number(sp.get('limit') || 60));

        const seenTopics = new Set<string>();
        const subjectCounts: Record<string, number> = {};
        const slotCounts: Record<string, number> = {};
        const cornerCounts: Record<string, number> = {};
        const matched: Array<Record<string, unknown>> = [];

        for (const doc of allDocs) {
          if (ageGroupId && doc.ageGroupId !== ageGroupId) continue;
          for (let i = 0; i < (doc.extractedLessons || []).length; i++) {
            const les = doc.extractedLessons[i];
            const cleanTopic = (les.topic || '')
              .replace(/\s+-\s*Góc.*$/i, '')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleanTopic.length < 10) continue;
            const lesMt = les.mtCode || '';
            if (mtUpper && lesMt !== mtUpper) continue;

            const lesSlot = (
              les.slotType ||
              (les.subject === 'HĐ Góc' ? 'CORNER' : les.subject === 'HĐ Ngoài trời' ? 'OUTDOOR' : 'MAIN')
            ).toUpperCase();

            const rc = normVN(les.cornerSubType || '');
            const lesCorner =
              lesSlot !== 'CORNER'
                ? ''
                : rc.includes('xay dung')
                ? 'Góc xây dựng'
                : rc.includes('nghe thuat') || rc.includes('tao hinh') || rc.includes('am nhac')
                ? 'Góc nghệ thuật'
                : rc.includes('hoc tap') || rc.includes('thu vien') || rc.includes('sach') || rc.includes('ky nang')
                ? 'Góc học tập – Thư viện'
                : rc.includes('thien nhien') || rc.includes('khoa hoc')
                ? 'Góc thiên nhiên'
                : 'Góc phân vai';

            const dedupeKey = `${doc.ageGroupId}|${lesSlot}|${normVN(les.subject)}|${normVN(cleanTopic).slice(0, 60)}`;
            if (seenTopics.has(dedupeKey)) continue;
            seenTopics.add(dedupeKey);

            if (q) {
              const hay = normVN(`${les.subject} ${lesCorner} ${cleanTopic} ${lesMt} ${doc.schoolName} ${doc.detectedMonth} ${doc.postTitle}`);
              if (!hay.includes(q)) continue;
            }

            slotCounts[lesSlot] = (slotCounts[lesSlot] || 0) + 1;
            if (lesSlot === 'CORNER' && lesCorner) {
              cornerCounts[lesCorner] = (cornerCounts[lesCorner] || 0) + 1;
            }
            if (slotUpper && slotUpper !== 'ALL' && lesSlot !== slotUpper) continue;

            subjectCounts[les.subject] = (subjectCounts[les.subject] || 0) + 1;
            if (subjNorm) {
              const ls = normVN(les.subject);
              const matchNbtn = subjNorm === 'nbtn' && (ls === 'nbtn' || ls === 'mtxq');
              const matchNbpb = subjNorm === 'nbpb' && (ls === 'nbpb' || ls === 'lqvt');
              if (ls !== subjNorm && !matchNbtn && !matchNbpb) continue;
            }
            if (cornerNorm && normVN(lesCorner) !== cornerNorm) continue;

            matched.push({
              id: `${doc.id}_${i}`,
              docId: doc.id,
              ageGroupId: doc.ageGroupId,
              subject: les.subject,
              topic: cleanTopic,
              type: les.type,
              slotType: lesSlot,
              cornerSubType: lesCorner,
              mtCode: lesMt,
              score: les.score || 0,
              schoolName: doc.schoolName,
              detectedMonth: doc.detectedMonth,
              postTitle: doc.postTitle,
              postUrl: doc.postUrl,
              snippet: doc.snippet,
              isMainLesson: lesSlot === 'MAIN',
            });
          }
        }
        return jsonResponse({
          available: true,
          total: matched.length,
          subjectCounts,
          slotCounts,
          cornerCounts,
          items: matched.slice(0, limit),
        });
      }

      if (apiPath === '/api/kb/works' && method === 'GET') {
        if (!cachedWorks) {
          cachedWorks = await fetchStaticJson<LiteraryWorkItem[]>('works_corpus.json', []);
        }
        const ageGroupId = sp.get('ageGroupId') || '';
        const kind = sp.get('kind') || '';
        const q = normVN(sp.get('q') || '');
        const works = cachedWorks.filter((w) => {
          if (ageGroupId && !w.ageGroups.includes(ageGroupId as AgeGroupId)) return false;
          if (kind && kind !== 'ALL' && w.kind !== kind) return false;
          if (q && !normVN(`${w.title} ${w.author} ${w.themes.join(' ')} ${w.contentText}`).includes(q)) {
            return false;
          }
          return true;
        });
        return jsonResponse({ works });
      }

      if (apiPath === '/api/annual-plans' && method === 'GET') {
        return jsonResponse({ annualPlans: await getAnnualPlansMap() });
      }

      if (apiPath.startsWith('/api/annual-plans/') && method === 'PUT') {
        const ageGroupId = apiPath.split('/').pop() as AgeGroupId;
        const body = await parseJsonBody<AnnualPlanDocument>();
        const all = await getAnnualPlansMap();
        const saved: AnnualPlanDocument = { ...body, ageGroupId, updatedAt: new Date().toISOString() };
        all[ageGroupId] = saved;
        localStorage.setItem(LS_KEYS.ANNUAL, JSON.stringify(all));
        return jsonResponse({ annualPlan: saved });
      }

      if (apiPath === '/api/assessments' && method === 'GET') {
        return jsonResponse({ assessments: await getAssessmentsList() });
      }

      if (apiPath.startsWith('/api/assessments/') && method === 'PUT') {
        const id = decodeURIComponent(apiPath.split('/').pop() || '');
        const body = await parseJsonBody<ThemeAssessmentDocument>();
        const list = await getAssessmentsList();
        const saved: ThemeAssessmentDocument = { ...body, id, updatedAt: new Date().toISOString() };
        const idx = list.findIndex((x) => x.id === id);
        if (idx >= 0) list[idx] = saved;
        else list.unshift(saved);
        localStorage.setItem(LS_KEYS.ASSESSMENTS, JSON.stringify(list));
        return jsonResponse({ assessment: saved });
      }

      if (apiPath === '/api/templates') {
        const list = await getTemplatesList();
        if (method === 'GET') {
          const ageGroupId = sp.get('ageGroupId') || '';
          const subjectCode = sp.get('subjectCode') || '';
          return jsonResponse({
            templates: list.filter((t) => {
              if (ageGroupId && t.ageGroupId !== ageGroupId) return false;
              if (subjectCode && subjectCode !== 'ALL' && t.subjectCode !== subjectCode) return false;
              return true;
            }),
          });
        }
        if (method === 'POST') {
          const body = await parseJsonBody<SavedLessonTemplate>();
          const saved: SavedLessonTemplate = {
            ...body,
            id: body.id || `tpl_${Date.now()}`,
            createdAt: body.createdAt || new Date().toISOString(),
          };
          const idx = list.findIndex((x) => x.id === saved.id);
          if (idx >= 0) list[idx] = saved;
          else list.unshift(saved);
          localStorage.setItem(LS_KEYS.TEMPLATES, JSON.stringify(list));
          return jsonResponse({ template: saved });
        }
      }

      if (apiPath.startsWith('/api/templates/') && method === 'DELETE') {
        const id = decodeURIComponent(apiPath.split('/').pop() || '');
        const list = await getTemplatesList();
        localStorage.setItem(LS_KEYS.TEMPLATES, JSON.stringify(list.filter((x) => x.id !== id)));
        return jsonResponse({ ok: true });
      }

      if (apiPath === '/api/media') {
        const list = await getMediaList();
        if (method === 'GET') {
          const ageGroupId = sp.get('ageGroupId') || '';
          const subjectCode = sp.get('subjectCode') || '';
          const kind = sp.get('kind') || '';
          const q = normVN(sp.get('q') || '');
          return jsonResponse({
            items: list.filter((m) => {
              if (ageGroupId && ageGroupId !== 'ALL' && m.ageGroupId !== 'ALL' && m.ageGroupId !== ageGroupId) return false;
              if (subjectCode && subjectCode !== 'ALL' && m.subjectCode !== 'ALL' && m.subjectCode !== subjectCode) return false;
              if (kind && kind !== 'ALL' && m.kind !== kind) return false;
              if (q && !normVN(`${m.title} ${m.themeName} ${m.subjectCode} ${m.author}`).includes(q)) return false;
              return true;
            }),
          });
        }
        if (method === 'POST') {
          const body = await parseJsonBody<SharedMediaResource>();
          const saved: SharedMediaResource = {
            ...body,
            id: body.id || `med_${Date.now()}`,
            createdAt: body.createdAt || new Date().toISOString(),
          };
          const userOnly = list.filter((x) => x.id.startsWith('med_17') || x.id.startsWith('med_user_'));
          const idx = userOnly.findIndex((x) => x.id === saved.id);
          if (idx >= 0) userOnly[idx] = saved;
          else userOnly.unshift(saved);
          localStorage.setItem(LS_KEYS.MEDIA, JSON.stringify(userOnly));
          return jsonResponse({ item: saved });
        }
      }

      if (apiPath.startsWith('/api/media/') && method === 'DELETE') {
        const id = decodeURIComponent(apiPath.split('/').pop() || '');
        const list = await getMediaList();
        const userOnly = list.filter(
          (x) => (x.id.startsWith('med_17') || x.id.startsWith('med_user_')) && x.id !== id
        );
        localStorage.setItem(LS_KEYS.MEDIA, JSON.stringify(userOnly));
        return jsonResponse({ ok: true });
      }

      if (apiPath === '/api/plans') {
        const list = await getPlansList();
        if (method === 'GET') return jsonResponse({ plans: list });
        if (method === 'POST') {
          const body = await parseJsonBody<WeeklyPlanDocument>();
          const saved: WeeklyPlanDocument = { ...body, updatedAt: new Date().toISOString() };
          const idx = list.findIndex((p) => p.id === saved.id);
          if (idx >= 0) list[idx] = saved;
          else list.unshift(saved);
          savePlansList(list);
          return jsonResponse({ plan: saved });
        }
      }

      if (apiPath.startsWith('/api/plans/')) {
        const id = decodeURIComponent(apiPath.replace('/api/plans/', '').split('/')[0]);
        const list = await getPlansList();
        if (method === 'GET') {
          const found = list.find((p) => p.id === id);
          return found ? jsonResponse({ plan: found }) : jsonResponse({ error: 'Not found' }, 404);
        }
        if (method === 'PUT') {
          const body = await parseJsonBody<WeeklyPlanDocument>();
          const saved: WeeklyPlanDocument = { ...body, id, updatedAt: new Date().toISOString() };
          const idx = list.findIndex((p) => p.id === id);
          if (idx >= 0) list[idx] = saved;
          else list.unshift(saved);
          savePlansList(list);
          return jsonResponse({ plan: saved });
        }
        if (method === 'DELETE') {
          savePlansList(list.filter((p) => p.id !== id));
          return jsonResponse({ ok: true });
        }
      }

      // --- CLIENT-SIDE DOCX & XLSX IMPORT / EXPORT FOR GITHUB PAGES ---
      if (apiPath === '/api/import/docx' && method === 'POST') {
        const { filename, base64 } = await parseJsonBody<{ filename: string; base64: string }>();
        const { parseUploadedDocx } = await import('../../server/docxImport');
        const imported = await parseUploadedDocx(base64ToUint8(base64), filename);
        return jsonResponse({ ok: true, imported });
      }

      if (apiPath === '/api/export/docx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const ds = await getMergedObjectives();
        if (plan.editorHtml && plan.editorHtml.trim().length > 30) {
          const { generateDocxFromEditorHtml } = await import('../../server/htmlToDocx');
          const bytes = await generateDocxFromEditorHtml(plan.editorHtml, plan);
          return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
        const { generateBgdDocx } = await import('../../server/docxExport');
        const bytes = await generateBgdDocx(plan, ds.objectives);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/parent-schedule-docx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const { generateParentScheduleDocx } = await import('../../server/parentScheduleDocx');
        const bytes = await generateParentScheduleDocx(plan);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/daily-plans-docx' && method === 'POST') {
        const { plans, options } = await parseJsonBody<{
          plans: WeeklyPlanDocument[];
          options: import('../../server/dailyPlanDocx').DailyExportOptions;
        }>();
        const { generateDailyPlansDocx } = await import('../../server/dailyPlanDocx');
        const bytes = await generateDailyPlansDocx(plans, options);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/theme-assessment-docx' && method === 'POST') {
        const { assessment, students } = await parseJsonBody<{
          assessment: ThemeAssessmentDocument;
          students: StudentRosterItem[];
        }>();
        const ds = await getMergedObjectives();
        const { generateThemeAssessmentDocx } = await import('../../server/themeAssessmentDocx');
        const bytes = await generateThemeAssessmentDocx(assessment, students || [], ds.objectives);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/individual-assessments-docx' && method === 'POST') {
        const { assessment, students } = await parseJsonBody<{
          assessment: ThemeAssessmentDocument;
          students: StudentRosterItem[];
        }>();
        const ds = await getMergedObjectives();
        const { generateIndividualChildCardsDocx } = await import('../../server/themeAssessmentDocx');
        const bytes = await generateIndividualChildCardsDocx(assessment, students || [], ds.objectives);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/annual-docx' && method === 'POST') {
        const { annualPlan } = await parseJsonBody<{ annualPlan: AnnualPlanDocument }>();
        const ds = await getMergedObjectives();
        const { generateAnnualPlanDocx } = await import('../../server/annualAndMonthDocx');
        const bytes = await generateAnnualPlanDocx(annualPlan, ds.objectives);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/month-docx' && method === 'POST') {
        const { theme, monthPlans, profile } = await parseJsonBody<{
          theme: AnnualPlanDocument['themes'][number];
          monthPlans: WeeklyPlanDocument[];
          profile: AnnualPlanDocument['profile'];
        }>();
        const ds = await getMergedObjectives();
        const { generateMonthlyPlanDocx } = await import('../../server/annualAndMonthDocx');
        const bytes = await generateMonthlyPlanDocx(theme, monthPlans || [], ds.objectives, profile);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      if (apiPath === '/api/export/xlsx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const ds = await getMergedObjectives();
        const { generateBrowserWeeklyXlsx } = await import('../../shared/browserXlsx');
        const bytes = await generateBrowserWeeklyXlsx(plan, ds.objectives);
        return binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }

      return jsonResponse({ error: `Unsupported static API route: ${method} ${apiPath}` }, 404);
    } catch (err) {
      console.error('[Static API Error]', err);
      return jsonResponse({ error: String(err) }, 500);
    }
  };
}
