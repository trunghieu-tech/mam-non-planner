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
import { createBlankPlan, normVN } from './helpers';
import { buildPedagogicalLessonPlan } from './subjectTemplates';
import { initStaticApiIfNeeded } from './staticApiAdapter';

export interface HdsbeSchoolClassItem {
  lop_code: string;
  ten_lop: string;
  ma_khoi: string;
  ma_khoi_bo: string;
  nhom_tuoi: AgeGroupId;
}

export interface HdsbeSchoolContextState {
  connected: boolean;
  apiBase: string;
  loginSchool: string;
  maTruongBo: string;
  tenTruong: string;
  hieuTruong: string;
  diaChi: string;
  namHoc: string;
  classes: HdsbeSchoolClassItem[];
  selectedLopByGrade: Record<AgeGroupId, string>;
}

const ALL_GRADES: AgeGroupId[] = ['NHA_TRE_24_36T', 'MAM_3_4T', 'CHOI_4_5T', 'LA_5_6T'];
const SS_LOP_MAP_KEY = 'mn_hdsbe_lop_by_grade_v1';
const DEFAULT_LOGIN_SCHOOL = '9200_h2_mnmyxuan';

// Base API mặc định trỏ tới server live https://api-mnmyxuan.titkul.edu.vn (có thể ghi đè qua VITE_HDSBE_API_ORIGIN)
export const DEFAULT_HDSBE_API_ORIGIN = 'https://api-mnmyxuan.titkul.edu.vn';
const ENV_ORIGIN = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_HDSBE_API_ORIGIN || '').replace(/\/+$/, '');
export const ACTIVE_API_ORIGIN = ENV_ORIGIN || DEFAULT_HDSBE_API_ORIGIN;
let KHGD_API_PREFIX = `${ACTIVE_API_ORIGIN}/HDSBE/HocTap/V1`;

let hdsbeState: HdsbeSchoolContextState = {
  connected: false,
  apiBase: KHGD_API_PREFIX,
  loginSchool: DEFAULT_LOGIN_SCHOOL,
  maTruongBo: '',
  tenTruong: '',
  hieuTruong: '',
  diaChi: '',
  namHoc: '2026-2027',
  classes: [],
  selectedLopByGrade: {
    NHA_TRE_24_36T: '5818',
    MAM_3_4T: '5819',
    CHOI_4_5T: '5823',
    LA_5_6T: '5828',
  },
};

const listeners = new Set<(state: HdsbeSchoolContextState) => void>();

export function getHdsbeSchoolState(): HdsbeSchoolContextState {
  return hdsbeState;
}

export function subscribeHdsbeSchoolState(fn: (state: HdsbeSchoolContextState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitHdsbeState() {
  for (const fn of listeners) fn({ ...hdsbeState });
}

interface HResponceEnvelope<T = unknown> {
  success?: boolean;
  status_code?: number;
  error_code: number;
  message?: string;
  stringdata?: T | string;
  data?: T;
  error_info?: { error_message?: string } | null;
}

function unwrapHResponce<T>(raw: HResponceEnvelope<T>): T {
  if (raw.error_code && raw.error_code !== 0) {
    throw new Error(raw.error_info?.error_message || raw.message || `HDSBE error ${raw.error_code}`);
  }
  const payload = raw.stringdata !== undefined ? raw.stringdata : raw.data;
  if (typeof payload === 'string') {
    return JSON.parse(payload) as T;
  }
  return payload as T;
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

export interface HdsbeClassApprovalStat {
  lop_code: string;
  ten_lop: string;
  nhom_tuoi: AgeGroupId;
  tong_tuan_da_soan: number;
  so_nhap: number;
  so_cho_duyet: number;
  so_yeu_cau_sua: number;
  so_da_duyet: number;
}

export interface HdsbeTrashedWeekItem {
  id: string;
  lop_code: string;
  ten_lop: string;
  tuan_thu: number;
  thang: number;
  ten_chu_de: string;
  ten_nhanh_tuan: string;
  tu_ngay: string;
  den_ngay: string;
}

const rawNativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

async function callDirectKhgd<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await rawNativeFetch(`${KHGD_API_PREFIX}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ma_truong_bo: hdsbeState.maTruongBo || undefined,
      nam_hoc: hdsbeState.namHoc || undefined,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`);
  const env = (await res.json()) as HResponceEnvelope<T>;
  return unwrapHResponce<T>(env);
}

export async function fetchSchoolWideClassStats(): Promise<HdsbeClassApprovalStat[]> {
  if (!hdsbeState.connected) return [];
  const r = await callDirectKhgd<{ thong_ke_theo_lop?: HdsbeClassApprovalStat[] }>(
    'GetDanhSachKeHoachTuan',
    { kem_chi_tiet: false }
  );
  return r.thong_ke_theo_lop || [];
}

export async function copyPlanAcrossSchoolClasses(opts: {
  mode: 'ANNUAL' | 'WEEK';
  srcLopCode: string;
  targetLopCodes: string[];
  weekNumber?: number;
}): Promise<number> {
  if (!hdsbeState.connected || opts.targetLopCodes.length === 0) return 0;
  if (opts.mode === 'ANNUAL') {
    const r = await callDirectKhgd<{ tong_lop: number }>('CopyKhungKeHoachNam', {
      tu_lop_code: opts.srcLopCode,
      den_ds_lop_code: opts.targetLopCodes,
    });
    return r.tong_lop || 0;
  }
  const r = await callDirectKhgd<{ so_ban_sao: number }>('CopyKeHoachTuanSangLopKhac', {
    tu_lop_code: opts.srcLopCode,
    tuan_thu: opts.weekNumber,
    den_ds_lop_code: opts.targetLopCodes,
  });
  return r.so_ban_sao || 0;
}

export async function fetchTrashedWeeks(lopCode?: string): Promise<HdsbeTrashedWeekItem[]> {
  if (!hdsbeState.connected) return [];
  const body: Record<string, unknown> = {
    trang_thai_duyet: -1,
    kem_chi_tiet: false,
  };
  if (lopCode && lopCode !== 'ALL') {
    body.lop_code = lopCode;
  }
  const r = await callDirectKhgd<{ plans: HdsbeTrashedWeekItem[] }>('GetDanhSachKeHoachTuan', body);
  return r.plans || [];
}

export async function restoreWeekFromTrash(lopCode: string, weekNumber: number): Promise<WeeklyPlanDocument | null> {
  if (!hdsbeState.connected) return null;
  const r = await callDirectKhgd<{ plan: WeeklyPlanDocument }>('RestoreKeHoachTuan', {
    lop_code: lopCode,
    tuan_thu: weekNumber,
  });
  return r.plan || null;
}

export async function setActiveSchoolClassForGrade(lopCode: string): Promise<HdsbeSchoolClassItem | null> {
  const found = hdsbeState.classes.find((c) => c.lop_code === lopCode);
  if (!found) return null;
  hdsbeState = {
    ...hdsbeState,
    selectedLopByGrade: {
      ...hdsbeState.selectedLopByGrade,
      [found.nhom_tuoi]: found.lop_code,
    },
  };
  sessionStorage.setItem(SS_LOP_MAP_KEY, JSON.stringify(hdsbeState.selectedLopByGrade));
  emitHdsbeState();
  return found;
}

export async function initApiLayer(): Promise<void> {
  const nativeFetch = window.fetch.bind(window);

  const inflightReadRequests = new Map<string, Promise<unknown>>();

  const postKhgdJson = async <T>(action: string, body: Record<string, unknown>, timeoutMs = 30000): Promise<T> => {
    const payloadStr = JSON.stringify({
      ma_truong_bo: hdsbeState.maTruongBo || undefined,
      nam_hoc: hdsbeState.namHoc || undefined,
      ...body,
    });
    const isReadOnly = action.startsWith('Get') || action.startsWith('Search');
    const dedupeKey = isReadOnly ? `${action}:${payloadStr}` : '';
    if (dedupeKey) {
      const existing = inflightReadRequests.get(dedupeKey);
      if (existing) return existing as Promise<T>;
    }

    const executeWithRetry = async (): Promise<T> => {
      const maxAttempts = isReadOnly ? 2 : 1;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await nativeFetch(`${KHGD_API_PREFIX}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadStr,
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`);
          const env = (await res.json()) as HResponceEnvelope<T>;
          return unwrapHResponce<T>(env);
        } catch (err) {
          lastErr = err;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 250));
          }
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastErr;
    };

    const promise = executeWithRetry();
    if (dedupeKey) {
      inflightReadRequests.set(dedupeKey, promise);
      promise.finally(() => inflightReadRequests.delete(dedupeKey)).catch(() => {});
    }
    return promise;
  };

  const postKhgdBinary = async (action: string, body: Record<string, unknown>): Promise<Response> => {
    const res = await nativeFetch(`${KHGD_API_PREFIX}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ma_truong_bo: hdsbeState.maTruongBo || undefined,
        nam_hoc: hdsbeState.namHoc || undefined,
        ...body,
      }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const errJson = await res.json();
      return jsonResponse({ error: errJson?.message || 'Không thể kết xuất file từ PN_HDSBE_HocTap' }, 400);
    }
    return res;
  };

  // 1. Kiểm tra kết nối trực tiếp tới Server Host https://api-mnmyxuan.titkul.edu.vn (fallback về Local /HDSBE/HocTap/V1 nếu cần)
  try {
    let boot: {
      truong: { ma_truong_bo: string; ten_truong: string; hieu_truong: string; dia_chi: string };
      nam_hoc: string;
      ds_lop_mam_non: HdsbeSchoolClassItem[];
    } | null = null;

    const isLocalHost =
      typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    const candidatePrefixes = ENV_ORIGIN
      ? [`${ENV_ORIGIN}/HDSBE/HocTap/V1`]
      : isLocalHost
      ? [`${DEFAULT_HDSBE_API_ORIGIN}/HDSBE/HocTap/V1`, '/HDSBE/HocTap/V1']
      : [`${DEFAULT_HDSBE_API_ORIGIN}/HDSBE/HocTap/V1`];

    for (const prefix of candidatePrefixes) {
      try {
        KHGD_API_PREFIX = prefix;
        boot = await postKhgdJson('GetBootstrapContext', {}, 10000);
        if (boot?.truong?.ma_truong_bo) break;
      } catch (probeErr) {
        console.warn(`[Mầm Non Planner] Không kết nối được ${prefix}/GetBootstrapContext:`, probeErr);
        boot = null;
      }
    }

    if (!boot?.truong?.ma_truong_bo) {
      throw new Error('Empty bootstrap payload');
    }

    const classes = boot.ds_lop_mam_non || [];
    const defaultMap: Record<AgeGroupId, string> = {
      NHA_TRE_24_36T: classes.find((c) => c.nhom_tuoi === 'NHA_TRE_24_36T')?.lop_code || '5818',
      MAM_3_4T: classes.find((c) => c.nhom_tuoi === 'MAM_3_4T')?.lop_code || '5819',
      CHOI_4_5T: classes.find((c) => c.nhom_tuoi === 'CHOI_4_5T')?.lop_code || '5823',
      LA_5_6T: classes.find((c) => c.nhom_tuoi === 'LA_5_6T')?.lop_code || '5828',
    };

    try {
      const savedMapRaw = sessionStorage.getItem(SS_LOP_MAP_KEY);
      if (savedMapRaw) {
        const parsed = JSON.parse(savedMapRaw) as Partial<Record<AgeGroupId, string>>;
        for (const g of ALL_GRADES) {
          const candidate = parsed[g];
          if (candidate && classes.some((c) => c.lop_code === candidate && c.nhom_tuoi === g)) {
            defaultMap[g] = candidate;
          }
        }
      }
    } catch {
      // ignore sessionStorage parse error
    }

    hdsbeState = {
      connected: true,
      apiBase: KHGD_API_PREFIX,
      loginSchool: DEFAULT_LOGIN_SCHOOL,
      maTruongBo: boot.truong.ma_truong_bo,
      tenTruong: boot.truong.ten_truong,
      hieuTruong: boot.truong.hieu_truong,
      diaChi: boot.truong.dia_chi,
      namHoc: boot.nam_hoc || '2026-2027',
      classes,
      selectedLopByGrade: defaultMap,
    };
    emitHdsbeState();
    console.info(
      `[Mầm Non Planner] Đã kết nối Backend Local PN_HDSBE_HocTap (${KHGD_API_PREFIX}) — Trường: ${boot.truong.ten_truong} (${boot.truong.ma_truong_bo}) · ${classes.length} lớp.`
    );
  } catch {
    // Không có PN_HDSBE_HocTap local (VD: chạy trên GitHub Pages) -> chuyển về Static Adapter
    await initStaticApiIfNeeded();
    return;
  }

  // Bộ nhớ đệm cho kho bài giảng tham khảo tĩnh (kb_by_mt, crawled_docs) hỗ trợ cột Gợi ý thông minh
  let cachedKbSummary: Record<string, unknown> | null = null;
  let cachedKbByMt: Record<string, Record<string, unknown>> | null = null;
  let cachedCrawledDocs: Array<Record<string, any>> | null = null;
  let cachedStaticMedia: SharedMediaResource[] | null = null;
  let cachedObjectives: ObjectivesDataset | null = null;
  const knownPlanStatusById = new Map<string, string>();
  const knownPlanMetaById = new Map<string, { lopCode: string; weekNumber: number }>();

  const rememberPlanMeta = (p?: Partial<WeeklyPlanDocument> | null, fallbackLop?: string) => {
    if (!p?.id) return;
    if (p.status) knownPlanStatusById.set(p.id, p.status);
    const rawAny = p as Record<string, unknown>;
    const lc =
      (typeof rawAny.lop_code === 'string' && rawAny.lop_code.trim()) ||
      fallbackLop ||
      lopForGrade(p.ageGroupId);
    const wn = Number(p.weekNumber || rawAny.tuan_thu) || 1;
    if (lc) knownPlanMetaById.set(p.id, { lopCode: lc, weekNumber: wn });
  };

  const fetchStaticJson = async <T>(file: string, fallback: T): Promise<T> => {
    try {
      const r = await nativeFetch(staticAssetUrl(file));
      if (!r.ok) return fallback;
      return (await r.json()) as T;
    } catch {
      return fallback;
    }
  };

  const lopForGrade = (ag?: string | null): string => {
    const key = (ag || 'LA_5_6T') as AgeGroupId;
    return hdsbeState.selectedLopByGrade[key] || hdsbeState.selectedLopByGrade.LA_5_6T;
  };

  const resolveLopAndWeekFromPlan = (
    plan: Partial<WeeklyPlanDocument>,
    idHint?: string
  ): { lopCode: string; weekNumber: number; resolvedFromIdOrMeta: boolean } => {
    if (idHint) {
      const known = knownPlanMetaById.get(idHint);
      if (known) {
        return {
          lopCode: known.lopCode,
          weekNumber: plan.weekNumber || known.weekNumber || 1,
          resolvedFromIdOrMeta: true,
        };
      }
      // id chuẩn từ backend: plan_<maTruong>_<namHoc>_<lopCode>_w<week>
      const m = idHint.match(/^plan_(.+?)_(\d{4}(?:-\d{4})?)_([^_]+)_w(\d+)$/i)
        || idHint.match(/^plan_[^_]+_[^_]+_([^_]+)_w(\d+)$/i);
      if (m) {
        const lc = m.length === 5 ? m[3] : m[1];
        const wn = Number(m.length === 5 ? m[4] : m[2]) || plan.weekNumber || 1;
        return { lopCode: lc, weekNumber: wn, resolvedFromIdOrMeta: true };
      }
    }
    const rawAny = plan as Record<string, unknown>;
    if (typeof rawAny.lop_code === 'string' && rawAny.lop_code.trim()) {
      return {
        lopCode: rawAny.lop_code.trim(),
        weekNumber: plan.weekNumber || 1,
        resolvedFromIdOrMeta: Boolean(plan.weekNumber),
      };
    }
    if (plan.className) {
      const byName = hdsbeState.classes.find(
        (c) => normVN(c.ten_lop) === normVN(plan.className || '')
      );
      if (byName) {
        return {
          lopCode: byName.lop_code,
          weekNumber: plan.weekNumber || 1,
          resolvedFromIdOrMeta: Boolean(plan.weekNumber),
        };
      }
    }
    return {
      lopCode: lopForGrade(plan.ageGroupId),
      weekNumber: plan.weekNumber || 1,
      resolvedFromIdOrMeta: false,
    };
  };

  const buildStarterWeekFromAnnual = async (
    annual: AnnualPlanDocument,
    lopCode: string
  ): Promise<WeeklyPlanDocument> => {
    if (!cachedObjectives) {
      cachedObjectives = await postKhgdJson<ObjectivesDataset>('GetDanhMucMucTieu', { nhom_tuoi: 'TAT_CA' });
    }
    const th1 = annual.themes?.[0];
    const startDate = th1?.startDate || '2026-09-07';
    const subTheme = th1?.subThemes?.[0] || 'Ngày hội bé đến trường';
    const blank = createBlankPlan({
      ageGroupId: annual.ageGroupId,
      className: annual.profile.className,
      teacherName: annual.profile.teacherName || 'Giáo viên chủ nhiệm',
      schoolName: annual.profile.schoolName || hdsbeState.tenTruong,
      governingBody: annual.profile.governingBody
        ? `UBND ${annual.profile.governingBody.toUpperCase()}`
        : 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      principalName: annual.profile.principalName || hdsbeState.hieuTruong,
      themeName: th1?.themeName || 'TRƯỜNG MẦM NON CỦA BÉ',
      subThemeName: subTheme,
      weekNumber: 1,
      weekStartDate: startDate,
    });

    // Tự đổ tiết học tuần 1 theo Thời khóa biểu Tuần lẻ của lớp
    const oddSlots = annual.timetable?.oddWeek || [];
    const plannedMts = th1?.plannedMtCodes || [];
    const gradeObjs = cachedObjectives.objectives.filter((o) => o.ageGroupId === annual.ageGroupId);
    const days = blank.days.map((d, idx) => {
      const slots = oddSlots[idx] || [];
      const mainLessons = slots.map((subjCode, sIdx) => {
        const mt = plannedMts[(idx + sIdx) % Math.max(1, plannedMts.length)] || '';
        const obj = gradeObjs.find((o) => o.code === mt);
        return buildPedagogicalLessonPlan({
          topicTitle: `${subjCode}: Hoạt động chủ đề "${subTheme}"`,
          subjectCode: subjCode,
          ageGroupId: annual.ageGroupId,
          slotType: 'MAIN',
          mtCode: mt,
          obj,
        });
      });
      return { ...d, mainLessons };
    });

    const starter: WeeklyPlanDocument = {
      ...blank,
      annualThemeId: th1?.id,
      schoolYear: annual.profile.schoolYear || hdsbeState.namHoc,
      days,
    };

    const savedRes = await postKhgdJson<{ plan: WeeklyPlanDocument }>('SaveKeHoachTuan', {
      lop_code: lopCode,
      tuan_thu: 1,
      thang: th1?.monthNumber || 9,
      ma_chu_de: th1?.id,
      ten_chu_de: starter.themeName,
      ten_nhanh_tuan: starter.subThemeName,
      tu_ngay: starter.weekStartDate,
      den_ngay: starter.weekEndDate,
      plan: starter,
    });
    return savedRes.plan;
  };

  // =========================================================================
  // ĐỊNH TUYẾN TOÀN BỘ FETCH('/api/...') SANG POST /HDSBE/HocTap/V1/KHGD/*
  // =========================================================================

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(rawUrl, window.location.origin);
    const pathname = parsedUrl.pathname;

    const apiIdx = pathname.indexOf('/api/');
    if (apiIdx < 0) {
      return nativeFetch(input, init);
    }

    const apiPath = pathname.slice(apiIdx);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const sp = parsedUrl.searchParams;

    const parseJsonBody = async <T>(): Promise<T> => {
      if (!init?.body) return {} as T;
      if (typeof init.body === 'string') return JSON.parse(init.body) as T;
      return {} as T;
    };

    try {
      if (apiPath === '/api/health') {
        return jsonResponse({
          ok: true,
          mode: 'pn-hdsbe-hoctap-local',
          school: hdsbeState.tenTruong,
          login_school: hdsbeState.loginSchool,
          ma_truong_bo: hdsbeState.maTruongBo,
        });
      }

      // 1. DANH MỤC 345 MỤC TIÊU BỘ GD&ĐT (9200_hd_index.l_khgd_danhmuc_bgd)
      if (apiPath === '/api/objectives' && method === 'GET') {
        const ageGroupId = sp.get('ageGroupId') || 'TAT_CA';
        const res = await postKhgdJson<ObjectivesDataset>('GetDanhMucMucTieu', {
          nhom_tuoi: ageGroupId,
          lop_code: ageGroupId !== 'TAT_CA' ? lopForGrade(ageGroupId) : undefined,
        });
        if (ageGroupId === 'TAT_CA') cachedObjectives = res;
        return jsonResponse(res);
      }

      // 2. SỔ KẾ HOẠCH NĂM HỌC (9200_h2_mnmyxuan.khgd_kehoach_nam)
      if (apiPath === '/api/annual-plans' && method === 'GET') {
        const entries = await Promise.all(
          ALL_GRADES.map(async (ag) => {
            const lc = lopForGrade(ag);
            const r = await postKhgdJson<{ annualPlan: AnnualPlanDocument }>('GetKeHoachNam', {
              lop_code: lc,
              nhom_tuoi: ag,
            });
            return [ag, r.annualPlan] as const;
          })
        );
        const annualPlans = Object.fromEntries(entries) as Record<AgeGroupId, AnnualPlanDocument>;
        return jsonResponse({ annualPlans });
      }

      if (apiPath.startsWith('/api/annual-plans/') && method === 'PUT') {
        const ageGroupId = apiPath.split('/').pop() as AgeGroupId;
        const body = await parseJsonBody<AnnualPlanDocument>();
        const lc = (body as unknown as { lop_code?: string }).lop_code || lopForGrade(ageGroupId);
        const r = await postKhgdJson<{ annualPlan: AnnualPlanDocument }>('SaveKeHoachNam', {
          lop_code: lc,
          nhom_tuoi: ageGroupId,
          annual_plan: body,
        });
        return jsonResponse({ annualPlan: r.annualPlan });
      }

      // 3. KẾ HOẠCH TUẦN, GIÁO ÁN NGÀY & PHÊ DUYỆT BGH (9200_h2_mnmyxuan.khgd_kehoach_tuan)
      if (apiPath === '/api/plans' && method === 'GET') {
        const gradePriority: AgeGroupId[] = ['LA_5_6T', 'CHOI_4_5T', 'MAM_3_4T', 'NHA_TRE_24_36T'];
        const activeLops = Array.from(
          new Set(gradePriority.map((g) => hdsbeState.selectedLopByGrade[g]).filter(Boolean))
        );
        const planLists = await Promise.all(
          activeLops.map((lc) =>
            postKhgdJson<{ plans: WeeklyPlanDocument[] }>('GetDanhSachKeHoachTuan', {
              lop_code: lc,
              kem_chi_tiet: true,
            }).then((r) => r.plans || [])
          )
        );
        let plans = planLists.flat();

        // Nếu lớp đang chọn ở khối Lá (hoặc tất cả 4 lớp đang chọn) chưa có tuần nào trong DB, tự khởi tạo Tuần 1 từ Sổ KH Năm thực tế
        if (plans.length === 0) {
          const defaultLc = lopForGrade('LA_5_6T');
          const annualRes = await postKhgdJson<{ annualPlan: AnnualPlanDocument }>('GetKeHoachNam', {
            lop_code: defaultLc,
            nhom_tuoi: 'LA_5_6T',
          });
          const starter = await buildStarterWeekFromAnnual(annualRes.annualPlan, defaultLc);
          plans = [starter];
        }

        for (const p of plans) {
          rememberPlanMeta(p);
        }
        return jsonResponse({ plans });
      }

      if (apiPath === '/api/plans' && method === 'POST') {
        const body = await parseJsonBody<WeeklyPlanDocument>();
        const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(body);
        const r = await postKhgdJson<{ plan: WeeklyPlanDocument }>('SaveKeHoachTuan', {
          lop_code: lopCode,
          tuan_thu: weekNumber,
          nhom_tuoi: body.ageGroupId,
          ma_chu_de: body.annualThemeId,
          ten_chu_de: body.themeName,
          ten_nhanh_tuan: body.subThemeName,
          tu_ngay: body.weekStartDate,
          den_ngay: body.weekEndDate,
          noi_dung_in_html: body.editorHtml,
          plan: body,
        });
        rememberPlanMeta(r.plan, lopCode);
        if (body.id && body.id !== r.plan?.id) {
          knownPlanMetaById.set(body.id, { lopCode, weekNumber });
        }
        return jsonResponse({ plan: r.plan });
      }

      if (apiPath.startsWith('/api/plans/')) {
        const id = decodeURIComponent(apiPath.replace('/api/plans/', '').split('/')[0]);

        if (method === 'GET') {
          const { lopCode, weekNumber } = resolveLopAndWeekFromPlan({}, id);
          const r = await postKhgdJson<{ plan: WeeklyPlanDocument }>('GetChiTietKeHoachTuan', {
            lop_code: lopCode,
            tuan_thu: weekNumber,
          });
          rememberPlanMeta(r.plan, lopCode);
          return jsonResponse({ plan: r.plan });
        }

        if (method === 'PUT') {
          const body = await parseJsonBody<WeeklyPlanDocument>();
          const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(body, id);
          const r = await postKhgdJson<{ plan: WeeklyPlanDocument }>('SaveKeHoachTuan', {
            lop_code: lopCode,
            tuan_thu: weekNumber,
            nhom_tuoi: body.ageGroupId,
            ma_chu_de: body.annualThemeId,
            ten_chu_de: body.themeName,
            ten_nhanh_tuan: body.subThemeName,
            tu_ngay: body.weekStartDate,
            den_ngay: body.weekEndDate,
            noi_dung_in_html: body.editorHtml,
            plan: body,
          });

          let finalPlan = r.plan;
          // Chỉ gọi API DuyetKeHoachTuan khi trạng thái phê duyệt thực sự thay đổi (tránh gọi thừa khi auto-save)
          const prevStatus = knownPlanStatusById.get(id) || knownPlanStatusById.get(r.plan.id);
          if (body.status && body.status !== 'DRAFT' && body.status !== prevStatus) {
            const lastComment = body.reviewComments?.[body.reviewComments.length - 1];
            const duyetRes = await postKhgdJson<{ plan: WeeklyPlanDocument }>('DuyetKeHoachTuan', {
              lop_code: lopCode,
              tuan_thu: weekNumber,
              hanh_dong: body.status,
              ten_nguoi_duyet: body.approvedBy || lastComment?.authorName || hdsbeState.hieuTruong,
              vai_tro: lastComment?.authorRole || 'BGH_DUYET',
              muc_gop_y: lastComment?.targetSection || 'Toàn tuần',
              noi_dung_gop_y: lastComment?.content || '',
            }).catch(() => null);
            if (duyetRes?.plan) finalPlan = duyetRes.plan;
          }
          rememberPlanMeta(finalPlan, lopCode);
          if (body.status) {
            knownPlanStatusById.set(id, body.status);
          }

          return jsonResponse({ plan: finalPlan });
        }

        if (method === 'DELETE') {
          const { lopCode, weekNumber, resolvedFromIdOrMeta } = resolveLopAndWeekFromPlan({}, id);
          if (!resolvedFromIdOrMeta) {
            return jsonResponse(
              { error: `Không xác định được lớp/tuần cho mã kế hoạch "${id}" để tránh xóa nhầm tuần.` },
              400
            );
          }
          await postKhgdJson('DeleteKeHoachTuan', {
            lop_code: lopCode,
            tuan_thu: weekNumber,
          });
          knownPlanMetaById.delete(id);
          knownPlanStatusById.delete(id);
          return jsonResponse({ ok: true });
        }
      }

      // 4. ĐÁNH GIÁ TRẺ THEO CHỦ ĐỀ & CUỐI ĐỘ TUỔI (9200_h2_mnmyxuan.khgd_danhgia_chude)
      if (apiPath === '/api/assessments' && method === 'GET') {
        const activeLops = Array.from(new Set(Object.values(hdsbeState.selectedLopByGrade)));
        const lists = await Promise.all(
          activeLops.map((lc) =>
            postKhgdJson<{ assessments: ThemeAssessmentDocument[] }>('GetDanhGiaChuDe', {
              lop_code: lc,
            }).then((r) => r.assessments || [])
          )
        );
        return jsonResponse({ assessments: lists.flat() });
      }

      if (apiPath.startsWith('/api/assessments/') && method === 'PUT') {
        const id = decodeURIComponent(apiPath.split('/').pop() || '');
        const body = await parseJsonBody<ThemeAssessmentDocument>();
        const lc = lopForGrade(body.ageGroupId);
        const r = await postKhgdJson<{ assessment: ThemeAssessmentDocument }>('SaveDanhGiaChuDe', {
          lop_code: lc,
          nhom_tuoi: body.ageGroupId,
          ma_chu_de: id,
          ten_chu_de: body.themeName,
          assessment: { ...body, id },
        });
        return jsonResponse({ assessment: r.assessment });
      }

      // 5. KHO BÀI GIẢNG MẪU, TÁC PHẨM & HỌC LIỆU SỐ (9200_hd_index.l_khgd_hoclieu)
      if (apiPath === '/api/templates') {
        if (method === 'GET') {
          const ageGroupId = sp.get('ageGroupId') || '';
          const subjectCode = sp.get('subjectCode') || '';
          const r = await postKhgdJson<{ items: Array<Record<string, any>> }>('SearchKhoHocLieu', {
            nhom_hoc_lieu: 'BAI_GIANG_MAU',
            nhom_tuoi: ageGroupId || 'TAT_CA',
            limit: 100,
          });
          const templates: SavedLessonTemplate[] = (r.items || [])
            .map((it) => {
              const ct = it.noi_dung_chi_tiet || {};
              return {
                id: `dbtpl_${it.id}`,
                ageGroupId: (it.nhom_tuoi === 'TAT_CA' ? 'LA_5_6T' : it.nhom_tuoi) as AgeGroupId,
                subjectCode: ct.mon_hoc || it.ma_linh_vuc || 'MTXQ',
                topicTitle: it.tieu_de || '',
                linkedMtCodes: Array.isArray(it.ds_ma_muc_tieu) ? it.ds_ma_muc_tieu : [],
                richHtml: ct.noi_dung_html || ct.rich_html || '',
                themeName: it.ten_chu_de || ct.ten_chu_de || '',
                routineSlot: ct.khung_gio || 'MAIN',
                createdBy: it.tac_gia || 'Kho Giáo án Quốc gia',
                createdAt: new Date().toISOString(),
                isSystem: !it.ma_truong_bo,
              };
            })
            .filter((t) => !subjectCode || subjectCode === 'ALL' || t.subjectCode === subjectCode);
          return jsonResponse({ templates });
        }

        if (method === 'POST') {
          const body = await parseJsonBody<SavedLessonTemplate>();
          const saved = await postKhgdJson<{ id: number }>('SaveHocLieu', {
            nhom_hoc_lieu: 'BAI_GIANG_MAU',
            loai_hoc_lieu: 'GIAO_AN_MAU',
            nhom_tuoi: body.ageGroupId,
            ten_chu_de: body.themeName || '',
            ds_ma_muc_tieu: body.linkedMtCodes || [],
            tieu_de: body.topicTitle,
            tac_gia: body.createdBy || 'Giáo viên lớp',
            noi_dung_chi_tiet: {
              mon_hoc: body.subjectCode,
              khung_gio: body.routineSlot || 'MAIN',
              noi_dung_html: body.richHtml,
            },
          });
          return jsonResponse({
            template: {
              ...body,
              id: `dbtpl_${saved.id}`,
              createdAt: new Date().toISOString(),
              isSystem: false,
            },
          });
        }
      }

      if (apiPath.startsWith('/api/templates/') && method === 'DELETE') {
        const rawId = decodeURIComponent(apiPath.split('/').pop() || '').replace(/^dbtpl_/, '');
        const numId = Number(rawId);
        if (numId > 0) {
          await postKhgdJson('DeleteHocLieu', { id: numId });
        }
        return jsonResponse({ ok: true });
      }

      if (apiPath === '/api/media') {
        if (method === 'GET') {
          const ageGroupId = sp.get('ageGroupId') || '';
          const subjectCode = sp.get('subjectCode') || '';
          const kind = sp.get('kind') || '';
          const q = sp.get('q') || '';

          const [dbRes, staticMedia] = await Promise.all([
            postKhgdJson<{ items: Array<Record<string, any>> }>('SearchKhoHocLieu', {
              nhom_hoc_lieu: 'HOC_LIEU_SO',
              nhom_tuoi: ageGroupId || 'TAT_CA',
              tu_khoa: q || undefined,
              limit: 200,
            }),
            cachedStaticMedia
              ? Promise.resolve(cachedStaticMedia)
              : fetchStaticJson<SharedMediaResource[]>('media_resources.json', []).then((m) => {
                  cachedStaticMedia = m;
                  return m;
                }),
          ]);

          const dbMapped: SharedMediaResource[] = (dbRes.items || []).map((it) => {
            const loai = String(it.loai_hoc_lieu || '').toUpperCase();
            const mappedKind: SharedMediaResource['kind'] =
              loai === 'SLIDE'
                ? 'SLIDE'
                : loai === 'VIDEO'
                ? 'VIDEO'
                : loai === 'TRANH_ANH' || loai === 'IMAGE'
                ? 'IMAGE'
                : loai === 'ELEARNING'
                ? 'ELEARNING'
                : 'DOC';
            const ct = it.noi_dung_chi_tiet || {};
            return {
              id: `dbmed_${it.id}`,
              kind: mappedKind,
              title: it.tieu_de || '',
              url: it.duong_dan_file || ct.duong_dan_tuong_doi || '',
              thumbnailUrl: it.anh_dai_dien || undefined,
              galleryUrls: Array.isArray(ct.gallery_urls) ? ct.gallery_urls : undefined,
              subjectCode: ct.mon_hoc || it.ma_linh_vuc || 'MTXQ',
              ageGroupId: (it.nhom_tuoi === 'TAT_CA' ? 'ALL' : it.nhom_tuoi) as AgeGroupId | 'ALL',
              themeName: it.ten_chu_de || 'Kho Hosting Trường',
              author: it.tac_gia || (it.ma_truong_bo ? hdsbeState.tenTruong : 'Kho Học liệu Hệ thống'),
              shareScope: it.ma_truong_bo ? 'SCHOOL' : 'PUBLIC',
              description: it.tom_tat || '',
              createdAt: new Date().toISOString(),
            };
          });

          // Ưu tiên học liệu riêng của trường trên DB + kết hợp kho preview trực tuyến (khử trùng lặp theo tiêu đề)
          const schoolUploaded = dbMapped.filter((x) => x.shareScope === 'SCHOOL');
          const seenMediaKeys = new Set<string>();
          const combined: SharedMediaResource[] = [];
          for (const item of [...schoolUploaded, ...staticMedia, ...dbMapped.filter((x) => x.shareScope !== 'SCHOOL')]) {
            const dedupeKey = `${item.shareScope === 'SCHOOL' ? item.id : 'pub'}|${item.kind}|${normVN(item.title)}`;
            if (seenMediaKeys.has(dedupeKey)) continue;
            seenMediaKeys.add(dedupeKey);
            combined.push(item);
          }
          const qNorm = normVN(q);
          const filtered = combined.filter((m) => {
            if (ageGroupId && ageGroupId !== 'ALL' && m.ageGroupId !== 'ALL' && m.ageGroupId !== ageGroupId) return false;
            if (subjectCode && subjectCode !== 'ALL' && m.subjectCode !== 'ALL' && m.subjectCode !== subjectCode) return false;
            if (kind && kind !== 'ALL' && m.kind !== kind) return false;
            if (qNorm && !normVN(`${m.title} ${m.themeName} ${m.subjectCode} ${m.author}`).includes(qNorm)) return false;
            return true;
          });

          return jsonResponse({ items: filtered });
        }

        if (method === 'POST') {
          const body = await parseJsonBody<SharedMediaResource>();
          const loai =
            body.kind === 'IMAGE' ? 'TRANH_ANH' : body.kind === 'DOC' ? 'TAI_LIEU' : body.kind;
          const saved = await postKhgdJson<{ id: number }>('SaveHocLieu', {
            nhom_hoc_lieu: 'HOC_LIEU_SO',
            loai_hoc_lieu: loai,
            nhom_tuoi: body.ageGroupId === 'ALL' ? 'TAT_CA' : body.ageGroupId,
            ten_chu_de: body.themeName,
            tieu_de: body.title,
            tac_gia: body.author || 'Giáo viên lớp',
            duong_dan_file: body.url,
            noi_dung_chi_tiet: { mon_hoc: body.subjectCode },
          });
          return jsonResponse({ item: { ...body, id: `dbmed_${saved.id}` } });
        }
      }

      if (apiPath.startsWith('/api/media/') && method === 'DELETE') {
        const rawId = decodeURIComponent(apiPath.split('/').pop() || '').replace(/^dbmed_/, '');
        const numId = Number(rawId);
        if (numId > 0) {
          await postKhgdJson('DeleteHocLieu', { id: numId }).catch(() => {});
        }
        return jsonResponse({ ok: true });
      }

      if (apiPath === '/api/kb/works' && method === 'GET') {
        const ageGroupId = sp.get('ageGroupId') || '';
        const kind = sp.get('kind') || '';
        const q = sp.get('q') || '';
        const r = await postKhgdJson<{ items: Array<Record<string, any>> }>('SearchKhoHocLieu', {
          nhom_hoc_lieu: 'TAC_PHAM',
          nhom_tuoi: ageGroupId || 'TAT_CA',
          tu_khoa: q || undefined,
          limit: 150,
        });
        const works: LiteraryWorkItem[] = (r.items || [])
          .map((it) => {
            const ct = it.noi_dung_chi_tiet || {};
            const rawLoai = String(it.loai_hoc_lieu || '').toUpperCase();
            const mappedKind: LiteraryWorkItem['kind'] =
              rawLoai === 'THO'
                ? 'POEM'
                : rawLoai === 'TRUYEN'
                ? 'STORY'
                : rawLoai === 'BAI_HAT'
                ? 'SONG'
                : rawLoai === 'LQCC'
                ? 'LQCC'
                : 'RIDDLE';
            return {
              id: `dbwork_${it.id}`,
              kind: mappedKind,
              title: it.tieu_de || '',
              author: it.tac_gia || '',
              ageGroups: Array.isArray(ct.ds_nhom_tuoi) ? ct.ds_nhom_tuoi : ALL_GRADES,
              themes: Array.isArray(ct.ds_chu_de) ? ct.ds_chu_de : [it.ten_chu_de || ''],
              contentText: ct.noi_dung_van_ban || it.tom_tat || '',
              dialogueQuestions: Array.isArray(ct.cau_hoi_dam_thoai) ? ct.cau_hoi_dam_thoai : [],
              educationalNote: ct.giao_duc_thai_do || ct.ghi_chu_giao_duc || it.tom_tat || '',
            };
          })
          .filter((w) => !kind || kind === 'ALL' || w.kind === kind);
        return jsonResponse({ works });
      }

      // Kho tài liệu tham khảo cào từ 240 trường công lập (phục vụ panel Gợi ý nhanh bên phải)
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

      if ((apiPath === '/api/kb/docs' || apiPath === '/api/kb/lessons') && method === 'GET') {
        if (!cachedCrawledDocs) {
          cachedCrawledDocs = await fetchStaticJson<Array<Record<string, any>>>('crawled_docs.json', []);
        }
        const q = normVN(sp.get('q') || '');
        const ageGroupId = sp.get('ageGroupId') || '';
        const mtCode = (sp.get('mtCode') || '').trim().toUpperCase();
        const limit = Math.min(120, Number(sp.get('limit') || 60));

        if (apiPath === '/api/kb/docs') {
          const filtered = cachedCrawledDocs.filter((d) => {
            if (ageGroupId && d.ageGroupId !== ageGroupId) return false;
            if (mtCode && !d.matchedMts?.some((m: any) => m.code === mtCode)) return false;
            if (q && !normVN(`${d.postTitle} ${d.schoolName} ${d.snippet}`).includes(q)) return false;
            return true;
          });
          return jsonResponse({ available: true, total: filtered.length, items: filtered.slice(0, limit) });
        }

        const rawSubj = sp.get('subject') || '';
        const subjNorm = rawSubj && rawSubj !== 'ALL' && rawSubj !== 'Tất cả' ? normVN(rawSubj) : '';
        const slotUpper = (sp.get('slotType') || '').trim().toUpperCase();
        const rawCornerParam = sp.get('cornerSubType') || '';
        const cornerNorm = rawCornerParam && rawCornerParam !== 'ALL' ? normVN(rawCornerParam) : '';

        const seenTopics = new Set<string>();
        const subjectCounts: Record<string, number> = {};
        const slotCounts: Record<string, number> = {};
        const cornerCounts: Record<string, number> = {};
        const matched: Array<Record<string, unknown>> = [];

        for (const doc of cachedCrawledDocs) {
          if (ageGroupId && doc.ageGroupId !== ageGroupId) continue;
          for (let i = 0; i < (doc.extractedLessons || []).length; i++) {
            const les = doc.extractedLessons[i];
            const cleanTopic = String(les.topic || '').replace(/\s+-\s*Góc.*$/i, '').replace(/\s+/g, ' ').trim();
            if (cleanTopic.length < 10) continue;
            const lesMt = les.mtCode || '';
            if (mtCode && lesMt !== mtCode) continue;
            const lesSlot = String(
              les.slotType || (les.subject === 'HĐ Góc' ? 'CORNER' : les.subject === 'HĐ Ngoài trời' ? 'OUTDOOR' : 'MAIN')
            ).toUpperCase();
            const rc = normVN(les.cornerSubType || '');
            const lesCorner =
              lesSlot !== 'CORNER'
                ? ''
                : rc.includes('xay dung')
                ? 'Góc xây dựng'
                : rc.includes('nghe thuat') || rc.includes('tao hinh') || rc.includes('am nhac')
                ? 'Góc nghệ thuật'
                : rc.includes('hoc tap') || rc.includes('thu vien') || rc.includes('sach')
                ? 'Góc học tập – Thư viện'
                : rc.includes('thien nhien') || rc.includes('khoa hoc')
                ? 'Góc thiên nhiên'
                : 'Góc phân vai';

            const dedupeKey = `${doc.ageGroupId}|${lesSlot}|${normVN(les.subject)}|${normVN(cleanTopic).slice(0, 60)}`;
            if (seenTopics.has(dedupeKey)) continue;
            seenTopics.add(dedupeKey);
            if (q && !normVN(`${les.subject} ${lesCorner} ${cleanTopic} ${lesMt} ${doc.schoolName}`).includes(q)) continue;

            slotCounts[lesSlot] = (slotCounts[lesSlot] || 0) + 1;
            if (lesSlot === 'CORNER' && lesCorner) cornerCounts[lesCorner] = (cornerCounts[lesCorner] || 0) + 1;
            if (slotUpper && slotUpper !== 'ALL' && lesSlot !== slotUpper) continue;
            subjectCounts[les.subject] = (subjectCounts[les.subject] || 0) + 1;
            if (subjNorm && normVN(les.subject) !== subjNorm) continue;
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

      // 6. NHẬP & XUẤT FILE NHỊ PHÂN TRỰC TIẾP QUA PN_HDSBE_HocTap (.DOCX / .XLSX)
      if (apiPath === '/api/import/docx' && method === 'POST') {
        const { filename, base64, ageGroupId } = await parseJsonBody<{
          filename: string;
          base64: string;
          ageGroupId?: AgeGroupId;
        }>();
        const bytes = base64ToUint8(base64);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        const form = new FormData();
        form.append('ma_truong_bo', hdsbeState.maTruongBo);
        form.append('nam_hoc', hdsbeState.namHoc);
        form.append('lop_code', lopForGrade(ageGroupId || 'LA_5_6T'));
        form.append(
          'file',
          new Blob([copy], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          filename
        );
        const res = await nativeFetch(`${KHGD_API_PREFIX}/ImportGiaoAnDocx`, {
          method: 'POST',
          body: form,
        });
        const env = (await res.json()) as HResponceEnvelope<{ imported: unknown }>;
        const unwrapped = unwrapHResponce(env);
        return jsonResponse({ ok: true, imported: unwrapped.imported });
      }

      if (apiPath === '/api/export/annual-docx' && method === 'POST') {
        const { annualPlan } = await parseJsonBody<{ annualPlan: AnnualPlanDocument }>();
        return postKhgdBinary('ExportSoKeHoachNamDocx', {
          lop_code: lopForGrade(annualPlan?.ageGroupId),
          snapshot_data: annualPlan,
        });
      }

      if (apiPath === '/api/export/month-docx' && method === 'POST') {
        const payload = await parseJsonBody<{
          theme: AnnualPlanDocument['themes'][number];
          monthPlans: WeeklyPlanDocument[];
          profile: AnnualPlanDocument['profile'];
        }>();
        return postKhgdBinary('ExportKeHoachThangDocx', {
          lop_code: lopForGrade(payload.profile?.ageGroupId),
          thang: payload.theme?.monthNumber,
          ma_chu_de: payload.theme?.id,
          snapshot_data: {
            theme: payload.theme,
            annualPlan: {
              nhom_tuoi: payload.profile?.ageGroupId || 'LA_5_6T',
              profile: payload.profile,
              themes: payload.theme ? [payload.theme] : [],
            },
          },
        });
      }

      if (apiPath === '/api/export/docx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(plan, plan.id);
        return postKhgdBinary('ExportKeHoachTuanDocx', {
          lop_code: lopCode,
          tuan_thu: weekNumber,
          snapshot_data: plan,
        });
      }

      if (apiPath === '/api/export/xlsx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(plan, plan.id);
        return postKhgdBinary('ExportKeHoachTuanXlsx', {
          lop_code: lopCode,
          tuan_thu: weekNumber,
          snapshot_data: plan,
        });
      }

      if (apiPath === '/api/export/parent-schedule-docx' && method === 'POST') {
        const plan = await parseJsonBody<WeeklyPlanDocument>();
        const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(plan, plan.id);
        return postKhgdBinary('ExportLichTuanPhuHuynhDocx', {
          lop_code: lopCode,
          tuan_thu: weekNumber,
          snapshot_data: plan,
        });
      }

      if (apiPath === '/api/export/daily-plans-docx' && method === 'POST') {
        const { plans, options } = await parseJsonBody<{
          plans: WeeklyPlanDocument[];
          options: { orientation?: string; continuousDays?: boolean; startDate?: string; endDate?: string; weekNumber?: number };
        }>();
        const first = plans?.[0];
        const { lopCode, weekNumber } = resolveLopAndWeekFromPlan(first || {}, first?.id);
        return postKhgdBinary('ExportSoGiaoAnNgayDocx', {
          lop_code: lopCode,
          tuan_thu: options?.weekNumber || weekNumber,
          tu_ngay: options?.startDate,
          den_ngay: options?.endDate,
          kho_giay: options?.orientation === 'landscape' ? 'LANDSCAPE' : 'PORTRAIT',
          in_lien_tiep: options?.continuousDays !== false,
          snapshot_data: { plans },
        });
      }

      if (
        (apiPath === '/api/export/theme-assessment-docx' ||
          apiPath === '/api/export/individual-assessments-docx') &&
        method === 'POST'
      ) {
        const { assessment, students } = await parseJsonBody<{
          assessment: ThemeAssessmentDocument;
          students: StudentRosterItem[];
        }>();
        const isYearEnd = String(assessment?.id || '').startsWith('year_end_');
        const kieuXuat = isYearEnd
          ? 'TONG_HOP_CUOI_DO_TUOI'
          : apiPath === '/api/export/individual-assessments-docx'
          ? 'PHIEU_CA_NHAN_TRE'
          : 'TONG_HOP_CHU_DE';
        return postKhgdBinary('ExportBaoCaoDanhGiaDocx', {
          lop_code: lopForGrade(assessment?.ageGroupId),
          ma_chu_de: assessment?.id,
          kieu_xuat: kieuXuat,
          snapshot_data: { assessment, students },
        });
      }

      return jsonResponse({ error: `Route chưa ánh xạ: ${method} ${apiPath}` }, 404);
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? `${err.name}: ${err.message}`
          : err instanceof Error
          ? err.message
          : String(err);
      console.error(`[PN_HDSBE_HocTap Client Error] ${method} ${apiPath} -> ${msg}`);
      return jsonResponse({ error: msg }, 500);
    }
  };
}
