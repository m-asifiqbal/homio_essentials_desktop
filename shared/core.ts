/**
 * ============================================================
 * API CORE — Supabase over HTTPS (Auth + PostgREST + Storage)
 * ============================================================
 * One implementation used by the Electron main process (the real app: tokens never reach the screen code)
 * and by the browser preview (`npm run dev`). Same role as bondhu-fund's electron/database.ts:
 * every operation the screens can ask for is a method of `makeApi()`, and `authorize()` checks the staff
 * role first (the database checks it again through row-level security).
 *
 * Errors carry a short code in front of the message ("E_AUTH: …") so the screen can show its own wording.
 * ============================================================
 */
import type {
  AppConfigRow, AuditEntry, ContactChannel, DashboardData, Manufacturer, MedicineRequest, Product, Promotion, PromotionStats,
  PublicSession, RemedyDetail, RemedyInput, RemedyRow, RequestDetail, RequestStatus, Session, StaffMember, StaffRole,
} from './types';
import { ROLE_RANK } from './types';

export interface SessionStore { load(): Session | null; save(s: Session | null): void }

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(`${code}: ${message}`); }
}

const nowSec = () => Math.floor(Date.now() / 1000);
const enc = encodeURIComponent;
/** PostgREST `in.(…)` / `ilike` values: quote anything with commas, dots, brackets or spaces. */
const pgQuote = (v: string) => (/[,.()":\s]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);
const likeSafe = (q: string) => q.replace(/[%*,()]/g, ' ').trim();

type Query = Record<string, string | number | undefined | null>;
const qs = (q: Query = {}) => {
  const parts = Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${enc(k)}=${enc(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export class Supa {
  session: Session | null;
  private refreshing: Promise<void> | null = null;

  constructor(public url: string, public key: string, private store: SessionStore) {
    this.session = store.load();
  }

  get configured() { return !!(this.url && this.key); }

  private setSession(s: Session | null) { this.session = s; this.store.save(s); }

  private async send(input: string, init: RequestInit): Promise<Response> {
    if (!this.configured) throw new ApiError('E_CONFIG', 'The server address is not set in this build.');
    try {
      return await fetch(input, init);
    } catch {
      throw new ApiError('E_OFFLINE', 'Could not reach the server. Check the internet connection.');
    }
  }

  // ---- auth -------------------------------------------------------------------------------------------------------
  private async auth(path: string, body: unknown, method = 'POST', bearer?: string) {
    const r = await this.send(`${this.url}/auth/v1/${path}`, {
      method,
      headers: { apikey: this.key, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j.msg || j.error_description || j.message || j.error || `HTTP ${r.status}`;
      if (r.status === 400 && /invalid/i.test(msg) && /credential|grant|login/i.test(msg)) throw new ApiError('E_AUTH', 'Wrong email or password.');
      if (/not confirmed/i.test(msg)) throw new ApiError('E_UNCONFIRMED', 'This email address is not confirmed yet.');
      if (/signups not allowed|signup.*disabled/i.test(msg)) throw new ApiError('E_SIGNUP_OFF', 'New accounts are switched off for this project.');
      if (/already registered|already been registered/i.test(msg)) throw new ApiError('E_EXISTS', 'An account with this email already exists.');
      if (/password/i.test(msg) && /(short|weak|least|characters)/i.test(msg)) throw new ApiError('E_WEAK', msg);
      throw new ApiError(r.status === 429 ? 'E_RATE' : 'E_SERVER', msg);
    }
    return j;
  }

  async passwordGrant(email: string, password: string) {
    return this.auth('token?grant_type=password', { email, password });
  }

  /** Signs in and checks that the account is on the staff list. */
  async signIn(email: string, password: string): Promise<Session> {
    const t = await this.passwordGrant(email, password);
    const base = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at || nowSec() + (t.expires_in || 3600), user: { id: t.user.id, email: t.user.email } };
    this.session = { ...base, staff: { display_name: '', role: 'reviewer' } };
    const rows = await this.get<{ display_name: string; role: StaffRole }>('staff', { select: 'display_name,role', user_id: `eq.${t.user.id}` }).catch(() => []);
    if (!rows.length) {
      await this.auth('logout', {}, 'POST', base.access_token).catch(() => undefined);
      this.session = null;
      throw new ApiError('E_NOT_STAFF', 'This account is not on the Homio Essentials team. Ask an owner to add you.');
    }
    const s: Session = { ...base, staff: { display_name: rows[0].display_name, role: rows[0].role } };
    this.setSession(s);
    return s;
  }

  async signOut() {
    const tok = this.session?.access_token;
    this.setSession(null);
    if (tok) await this.auth('logout', {}, 'POST', tok).catch(() => undefined);
  }

  private async refresh() {
    if (!this.session) return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const t = await this.auth('token?grant_type=refresh_token', { refresh_token: this.session!.refresh_token });
          this.setSession({ ...this.session!, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at || nowSec() + (t.expires_in || 3600) });
        } catch (e: any) {
          if (String(e?.message).startsWith('E_OFFLINE')) throw e;
          this.setSession(null);
          throw new ApiError('E_SESSION', 'Your session has ended. Please sign in again.');
        } finally { this.refreshing = null; }
      })();
    }
    return this.refreshing;
  }

  /** Re-reads the staff row (role changes, removal) — called when the app starts with a saved session. */
  async revalidate(): Promise<Session | null> {
    if (!this.session) return null;
    try {
      const rows = await this.get<{ display_name: string; role: StaffRole }>('staff', { select: 'display_name,role', user_id: `eq.${this.session.user.id}` });
      if (!rows.length) { await this.signOut(); return null; }
      this.setSession({ ...this.session, staff: { display_name: rows[0].display_name, role: rows[0].role } });
    } catch (e: any) {
      if (String(e?.message).startsWith('E_SESSION')) return null;
      // offline: keep the saved session, screens show their own errors
    }
    return this.session;
  }

  async updatePassword(newPassword: string) {
    await this.ensureFresh();
    await this.auth('user', { password: newPassword }, 'PUT', this.session?.access_token);
  }

  /** Creates a sign-in account for a new team member without touching the current session. */
  async signUp(email: string, password: string): Promise<{ id: string; confirmed: boolean }> {
    const j = await this.auth('signup', { email, password });
    const user = j.user || j;
    if (!user?.id) throw new ApiError('E_SERVER', 'The server did not return the new account.');
    return { id: user.id, confirmed: !!(user.email_confirmed_at || user.confirmed_at) };
  }

  private async ensureFresh() {
    if (this.session && this.session.expires_at - nowSec() < 90) await this.refresh();
  }

  // ---- REST ---------------------------------------------------------------------------------------------------------
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.session?.access_token || this.key}`, ...extra };
  }

  async request(method: string, path: string, opts: { body?: unknown; prefer?: string; headers?: Record<string, string>; raw?: boolean } = {}): Promise<{ data: any; res: Response }> {
    await this.ensureFresh();
    const go = () => this.send(`${this.url}${path}`, {
      method,
      headers: this.headers({
        ...(opts.body !== undefined && !(opts.body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.prefer ? { Prefer: opts.prefer } : {}),
        ...(opts.headers || {}),
      }),
      body: opts.body === undefined ? undefined : opts.body instanceof Uint8Array ? (opts.body as any) : JSON.stringify(opts.body),
    });
    let res = await go();
    if (res.status === 401 && this.session) { await this.refresh(); res = await go(); }
    if (!res.ok) {
      const j: any = await res.json().catch(() => ({}));
      const msg = j.message || j.msg || j.error || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403 || j.code === '42501') throw new ApiError('E_FORBIDDEN', 'Your role does not allow this change.');
      if (j.code === '23505') throw new ApiError('E_DUPLICATE', j.details || msg);
      if (j.code === '23503') throw new ApiError('E_IN_USE', j.details || msg);
      if (j.code === '23514' || j.code === '22P02') throw new ApiError('E_INVALID', msg);
      throw new ApiError('E_SERVER', msg);
    }
    if (opts.raw) return { data: null, res };
    const text = await res.text();
    return { data: text ? JSON.parse(text) : null, res };
  }

  async get<T = any>(table: string, q: Query = {}): Promise<T[]> {
    return (await this.request('GET', `/rest/v1/${table}${qs(q)}`)).data as T[];
  }

  async getCounted<T = any>(table: string, q: Query, offset: number, limit: number): Promise<{ rows: T[]; total: number }> {
    const { data, res } = await this.request('GET', `/rest/v1/${table}${qs(q)}`, { prefer: 'count=exact', headers: { Range: `${offset}-${offset + limit - 1}`, 'Range-Unit': 'items' } });
    const total = Number((res.headers.get('content-range') || '').split('/')[1]) || (data?.length ?? 0);
    return { rows: data as T[], total };
  }

  async count(table: string, q: Query = {}): Promise<number> {
    const { res } = await this.request('HEAD', `/rest/v1/${table}${qs({ select: 'id', ...q })}`, { prefer: 'count=exact', raw: true });
    return Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
  }

  /** Every row, in pages of 1000 (PostgREST caps a response). `order` must be unique for stable paging. */
  async getAll<T = any>(table: string, q: Query, order: string): Promise<T[]> {
    const out: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this.get<T>(table, { ...q, order, offset, limit: 1000 });
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }

  async rpc<T = any>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    return (await this.request('POST', `/rest/v1/rpc/${fn}`, { body: params })).data as T;
  }

  async insert<T = any>(table: string, rows: unknown, opts: { onConflict?: string; merge?: boolean; returning?: boolean } = {}): Promise<T[]> {
    const prefer = [opts.returning === false ? 'return=minimal' : 'return=representation'];
    if (opts.onConflict) prefer.push(opts.merge === false ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates');
    const { data } = await this.request('POST', `/rest/v1/${table}${qs(opts.onConflict ? { on_conflict: opts.onConflict } : {})}`, { body: rows, prefer: prefer.join(',') });
    return (data || []) as T[];
  }

  async update<T = any>(table: string, q: Query, patch: unknown): Promise<T[]> {
    return ((await this.request('PATCH', `/rest/v1/${table}${qs(q)}`, { body: patch, prefer: 'return=representation' })).data || []) as T[];
  }

  async remove(table: string, q: Query) {
    await this.request('DELETE', `/rest/v1/${table}${qs(q)}`, { prefer: 'return=minimal', raw: true });
  }

  // ---- storage ------------------------------------------------------------------------------------------------------
  publicUrl(bucket: string, path: string) {
    return `${this.url}/storage/v1/object/public/${bucket}/${path.split('/').map(enc).join('/')}`;
  }

  async upload(bucket: string, path: string, bytes: Uint8Array, contentType: string, upsert = false) {
    await this.request('POST', `/storage/v1/object/${bucket}/${path.split('/').map(enc).join('/')}`, {
      body: bytes, headers: { 'Content-Type': contentType, 'x-upsert': upsert ? 'true' : 'false', 'cache-control': '3600' }, raw: true,
    });
    return path;
  }

  async signedUrl(bucket: string, path: string, expiresIn = 600): Promise<string | null> {
    try {
      const { data } = await this.request('POST', `/storage/v1/object/sign/${bucket}/${path.split('/').map(enc).join('/')}`, { body: { expiresIn } });
      const u = data?.signedURL || data?.signedUrl;
      return u ? `${this.url}/storage/v1${u.startsWith('/') ? u : `/${u}`}` : null;
    } catch { return null; }
  }

  async removeObjects(bucket: string, paths: string[]) {
    if (!paths.length) return;
    await this.request('DELETE', `/storage/v1/object/${bucket}`, { body: { prefixes: paths }, raw: true }).catch(() => undefined);
  }
}

// =====================================================================================================================
// Permissions: the lowest staff role allowed to call each operation. Anything not listed needs no session.
// =====================================================================================================================
export const METHOD_ROLE: Record<string, StaffRole> = {
  dashboard: 'reviewer', listRemedies: 'reviewer', getRemedy: 'reviewer', saveRemedy: 'editor', setRemedyStatus: 'editor', markReviewed: 'editor',
  listRequests: 'reviewer', requestDetail: 'reviewer', approveRequest: 'editor', setRequestStatus: 'editor', mergeRequest: 'editor', searchRemedies: 'reviewer',
  listPromotions: 'reviewer', savePromotion: 'editor', deletePromotion: 'editor', uploadPromotionImage: 'editor',
  listContacts: 'reviewer', saveContact: 'editor', deleteContact: 'editor', reorderContacts: 'editor',
  listConfig: 'reviewer', saveConfig: 'editor',
  listManufacturers: 'reviewer', saveManufacturer: 'editor', listProducts: 'reviewer', saveProduct: 'editor', deleteProduct: 'editor',
  listStaff: 'reviewer', addStaff: 'owner', setStaffRole: 'owner', removeStaff: 'owner',
  recentActivity: 'reviewer', listBackupRuns: 'reviewer', changePassword: 'reviewer', getSession: 'reviewer',
};

export function toPublic(s: Session | null): PublicSession | null {
  return s ? { userId: s.user.id, email: s.user.email, displayName: s.staff.display_name, role: s.staff.role } : null;
}

export function authorize(sb: Supa, method: string) {
  const need = METHOD_ROLE[method];
  if (!need || method === 'getSession') return;
  if (!sb.session) throw new ApiError('E_SESSION', 'Please sign in.');
  if (ROLE_RANK[sb.session.staff.role] < ROLE_RANK[need]) throw new ApiError('E_FORBIDDEN', `This needs the ${need} role.`);
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hasBangla = (s: string) => /[ঀ-৿]/.test(s);
const clean = (s: string | null | undefined) => { const v = (s ?? '').trim(); return v === '' ? null : v; };

/** Every operation the screens may request. */
export function makeApi(sb: Supa) {
  const uid = () => sb.session?.user.id ?? null;
  const audit = (action: string, entity: string, entity_id: string | null, diff?: unknown) =>
    sb.insert('audit_log', { actor_id: uid(), action, entity, entity_id, diff: diff ?? null }, { returning: false }).catch(() => undefined);

  const api = {
    // ---- session ----------------------------------------------------------------------------------------------------
    async getSession(): Promise<PublicSession | null> { return toPublic(await sb.revalidate()); },
    async signIn(email: string, password: string): Promise<PublicSession> {
      if (!email?.trim() || !password) throw new ApiError('E_INPUT', 'Enter your email and password.');
      return toPublic(await sb.signIn(email.trim().toLowerCase(), password))!;
    },
    async signOut() { await sb.signOut(); },
    async changePassword(current: string, next: string) {
      if (!next || next.length < 8) throw new ApiError('E_WEAK', 'Use at least 8 characters.');
      await sb.passwordGrant(sb.session!.user.email, current).catch(() => { throw new ApiError('E_AUTH', 'The current password is not right.'); });
      await sb.updatePassword(next);
      await audit('change_password', 'auth.users', uid());
    },

    // ---- dashboard --------------------------------------------------------------------------------------------------
    async dashboard(): Promise<DashboardData> {
      const [stats, drafts, conditions, manufacturers, products, waiting, activity, staff] = await Promise.all([
        sb.rpc('admin_dashboard_stats'),
        sb.count('remedies', { status: 'eq.draft' }),
        sb.count('conditions', { status: 'eq.published' }),
        sb.count('manufacturers'),
        sb.count('products'),
        sb.get<MedicineRequest>('medicine_requests', { select: '*', status: 'in.(new,needs_info)', order: 'created_at.asc', limit: 6 }),
        sb.get<AuditEntry>('audit_log', { select: '*', order: 'created_at.desc', limit: 8 }),
        sb.get<StaffMember>('staff', { select: 'user_id,display_name,role,created_at', order: 'display_name.asc' }),
      ]);
      return { stats, drafts, conditions, manufacturers, products, waiting, activity, staff };
    },
    async recentActivity(limit = 50): Promise<AuditEntry[]> {
      return sb.get<AuditEntry>('audit_log', { select: '*', order: 'created_at.desc', limit });
    },

    // ---- medicines --------------------------------------------------------------------------------------------------
    async listRemedies(f: { q?: string; status?: string; kingdom?: string; review?: 'needs' | 'done' | ''; offset?: number; limit?: number }): Promise<{ rows: RemedyRow[]; total: number }> {
      const q: Query = {
        select: 'id,slug,latin_name,abbreviation,kingdom,status,needs_medical_review,updated_at,groups,remedy_translations(locale,display_name,common_name,summary)',
        order: 'latin_name.asc',
      };
      if (f.status) q.status = `eq.${f.status}`;
      if (f.kingdom) q.kingdom = `eq.${f.kingdom}`;
      if (f.review === 'needs') q.needs_medical_review = 'is.true';
      if (f.review === 'done') q.needs_medical_review = 'is.false';
      const term = likeSafe(f.q || '');
      if (term) {
        if (hasBangla(term)) {
          const hits = await sb.get<{ remedy_id: string }>('remedy_translations', { select: 'remedy_id', display_name: `ilike.*${term}*`, limit: 200 });
          if (!hits.length) return { rows: [], total: 0 };
          q.id = `in.(${[...new Set(hits.map(h => h.remedy_id))].join(',')})`;
        } else {
          const t = pgQuote(`*${term}*`);
          q.or = `(latin_name.ilike.${t},slug.ilike.${t},abbreviation.ilike.${t},search_keys.cs.{${pgQuote(term.toLowerCase())}})`;
        }
      }
      return sb.getCounted<RemedyRow>('remedies', q, f.offset ?? 0, f.limit ?? 50);
    },

    async searchRemedies(term: string): Promise<{ id: string; slug: string; latin_name: string; status: string }[]> {
      const t = likeSafe(term);
      if (!t) return [];
      return sb.get('remedies', { select: 'id,slug,latin_name,status', latin_name: `ilike.*${t}*`, order: 'latin_name.asc', limit: 12 });
    },

    async getRemedy(id: string): Promise<RemedyDetail> {
      const [rows, relations, materia] = await Promise.all([
        sb.get<RemedyDetail>('remedies', {
          id: `eq.${id}`,
          select: '*,remedy_translations(*),remedy_safety_notes(*),remedy_uses(id,route,typical_potencies,conditions(slug,condition_translations(locale,name)),remedy_use_translations(locale,title,description)),products(id,name,potency,form,price_bdt,status,manufacturers(name))',
        }),
        sb.get('remedy_relations', { remedy_id: `eq.${id}`, select: 'relation_type,related:remedies!remedy_relations_related_remedy_id_fkey(slug,latin_name)', limit: 200 }).catch(() => []),
        sb.get<{ source_book: string }>('materia_entries', { remedy_id: `eq.${id}`, select: 'source_book', locale: 'eq.en' }).catch(() => []),
      ]);
      if (!rows.length) throw new ApiError('E_NOT_FOUND', 'This remedy no longer exists.');
      const counts = new Map<string, number>();
      for (const m of materia) counts.set(m.source_book, (counts.get(m.source_book) || 0) + 1);
      const r = rows[0];
      r.remedy_safety_notes = (r.remedy_safety_notes || []).sort((a, b) => a.sort_order - b.sort_order);
      return { ...r, relations, materia: [...counts].map(([source_book, count]) => ({ source_book, count })) };
    },

    async saveRemedy(input: RemedyInput): Promise<string> {
      const latin = clean(input.latin_name);
      if (!latin) throw new ApiError('E_INPUT', 'The Latin name is required.');
      const slug = slugify(clean(input.slug) || latin);
      if (!slug) throw new ApiError('E_INPUT', 'The web address (slug) is empty.');
      const row: Record<string, unknown> = {
        slug, latin_name: latin, abbreviation: clean(input.abbreviation), kingdom: input.kingdom || null, family: clean(input.family),
        groups: input.groups, potencies: input.potencies, forms: input.forms, external_use: !!input.external_use,
        search_keys: input.search_keys.map(s => s.trim().toLowerCase()).filter(Boolean), status: input.status,
        needs_medical_review: input.needs_medical_review, updated_by: uid(),
      };
      let id = input.id;
      if (id) {
        const before = await sb.get<{ needs_medical_review: boolean }>('remedies', { id: `eq.${id}`, select: 'needs_medical_review' });
        if (before[0]?.needs_medical_review && !input.needs_medical_review) Object.assign(row, { reviewed_by: uid(), reviewed_at: new Date().toISOString() });
        await sb.update('remedies', { id: `eq.${id}` }, row);
      } else {
        const made = await sb.insert<{ id: string }>('remedies', row);
        id = made[0].id;
      }
      const tr = (['en', 'bn'] as const).map(locale => {
        const t = input.translations[locale] || ({} as any);
        return {
          remedy_id: id, locale, display_name: clean(t.display_name), common_name: clean(t.common_name), summary: clean(t.summary),
          origin: clean(t.origin), preparation: clean(t.preparation), keynotes: (t.keynotes || []).map((k: string) => k.trim()).filter(Boolean),
        };
      });
      await sb.insert('remedy_translations', tr, { onConflict: 'remedy_id,locale', returning: false });

      // safety notes: replace the set
      const existing = await sb.get<{ id: string }>('remedy_safety_notes', { remedy_id: `eq.${id}`, select: 'id' });
      const keep = new Set(input.safety.filter(s => s.id).map(s => s.id));
      const gone = existing.filter(e => !keep.has(e.id)).map(e => e.id);
      if (gone.length) await sb.remove('remedy_safety_notes', { id: `in.(${gone.join(',')})` });
      const notes = input.safety.map((s, i) => ({ ...s, remedy_id: id, sort_order: i, body: { en: clean(s.body.en) || '', bn: clean(s.body.bn) || '' } }))
        .filter(s => s.body.en || s.body.bn);
      const old = notes.filter(n => n.id), fresh = notes.filter(n => !n.id).map(({ id: _drop, ...n }) => n);
      if (old.length) await sb.insert('remedy_safety_notes', old, { onConflict: 'id', returning: false });
      if (fresh.length) await sb.insert('remedy_safety_notes', fresh, { returning: false });

      await audit(input.id ? 'update_remedy' : 'create_remedy', 'remedies', id!, { latin_name: latin, status: input.status });
      return id!;
    },

    async setRemedyStatus(id: string, status: string) {
      await sb.update('remedies', { id: `eq.${id}` }, { status, updated_by: uid() });
      await audit(`remedy_${status}`, 'remedies', id);
    },
    async markReviewed(id: string) {
      await sb.update('remedies', { id: `eq.${id}` }, { needs_medical_review: false, reviewed_by: uid(), reviewed_at: new Date().toISOString() });
      await audit('review_remedy', 'remedies', id);
    },

    // ---- requests ---------------------------------------------------------------------------------------------------
    async listRequests(): Promise<MedicineRequest[]> {
      return sb.get<MedicineRequest>('medicine_requests', { select: '*', order: 'created_at.desc', limit: 500 });
    },
    async requestDetail(id: string): Promise<RequestDetail> {
      const rows = await sb.get<MedicineRequest>('medicine_requests', { select: '*', id: `eq.${id}` });
      if (!rows.length) throw new ApiError('E_NOT_FOUND', 'This request no longer exists.');
      const request = rows[0];
      const name = likeSafe(String(request.payload?.latin_name || request.payload?.name || ''));
      const first = name.split(/\s+/)[0] || '';
      const [exact, similar, products, history, photos] = await Promise.all([
        name ? sb.get('remedies', { select: 'id,slug,latin_name,status', latin_name: `ilike.${name}`, limit: 3 }) : Promise.resolve([]),
        first.length >= 3 ? sb.get('remedies', { select: 'id,slug,latin_name,status', latin_name: `ilike.${first}*`, order: 'latin_name.asc', limit: 6 }) : Promise.resolve([]),
        first.length >= 3 ? sb.get('products', { select: 'id,name,potency,remedy_id,manufacturers(name)', name: `ilike.*${first}*`, limit: 5 }) : Promise.resolve([]),
        sb.get<{ status: string }>('medicine_requests', { select: 'status', device_id: `eq.${request.device_id}`, id: `neq.${id}` }),
        Promise.all((request.photo_paths || []).map(async path => ({ path, url: await sb.signedUrl('request-photos', path) }))),
      ]);
      return {
        request, exact, photos, products,
        similar: similar.filter((s: any) => !exact.some((e: any) => e.id === s.id)),
        history: { total: history.length, approved: history.filter(h => h.status === 'approved' || h.status === 'merged').length },
      };
    },
    async approveRequest(id: string, keep: string[], note: string | null): Promise<string> {
      return sb.rpc<string>('approve_remedy_request', { p_request_id: id, p_keep_fields: keep, p_note: clean(note) });
    },
    async setRequestStatus(id: string, status: RequestStatus, note: string | null) {
      await sb.update('medicine_requests', { id: `eq.${id}` }, { status, reviewer_note: clean(note), reviewer_id: uid() });
      await audit(`request_${status}`, 'medicine_requests', id, note ? { note } : undefined);
    },
    async mergeRequest(id: string, remedyId: string, note: string | null) {
      await sb.update('medicine_requests', { id: `eq.${id}` }, { status: 'merged', linked_remedy_id: remedyId, reviewer_note: clean(note), reviewer_id: uid() });
      await audit('request_merged', 'medicine_requests', id, { remedy_id: remedyId });
    },

    // ---- promotions -------------------------------------------------------------------------------------------------
    async listPromotions(): Promise<{ rows: Promotion[]; stats: Record<string, PromotionStats>; base: string }> {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const [rows, events] = await Promise.all([
        sb.get<Promotion>('promotions', { select: '*', order: 'sort_order.asc,starts_at.desc' }),
        sb.get<{ promotion_id: string; event: string }>('promotion_events', { select: 'promotion_id,event', created_at: `gte.${since}`, limit: 50000 }).catch(() => []),
      ]);
      const stats: Record<string, PromotionStats> = {};
      for (const e of events) {
        const s = (stats[e.promotion_id] ||= { impressions: 0, taps: 0 });
        if (e.event === 'tap') s.taps++; else s.impressions++;
      }
      return { rows, stats, base: sb.publicUrl('promotions', '') };
    },
    async savePromotion(p: Promotion): Promise<string> {
      if (!clean(p.advertiser)) throw new ApiError('E_INPUT', 'Enter the advertiser.');
      if (!clean(p.title?.en) && !clean(p.title?.bn)) throw new ApiError('E_INPUT', 'Enter a title.');
      if (!p.image_path) throw new ApiError('E_INPUT', 'Upload the banner image.');
      if (!clean(p.tap_value)) throw new ApiError('E_INPUT', 'Enter where a tap should go.');
      if (!(new Date(p.ends_at) > new Date(p.starts_at))) throw new ApiError('E_INPUT', 'The end date must be after the start date.');
      if (!p.placements?.length) throw new ApiError('E_INPUT', 'Choose at least one place to show it.');
      const row = {
        advertiser: p.advertiser.trim(), title: { en: clean(p.title.en) || clean(p.title.bn), bn: clean(p.title.bn) || clean(p.title.en) },
        image_path: p.image_path, image_bn_path: p.image_bn_path || null, tap_action: p.tap_action, tap_value: p.tap_value.trim(),
        placements: p.placements, remedy_ids: p.remedy_ids || [], starts_at: p.starts_at, ends_at: p.ends_at, sort_order: p.sort_order || 0,
        status: p.status, updated_by: uid(),
      };
      const id = p.id ? (await sb.update('promotions', { id: `eq.${p.id}` }, row))[0]?.id ?? p.id : (await sb.insert<{ id: string }>('promotions', row))[0].id;
      await audit(p.id ? 'update_promotion' : 'create_promotion', 'promotions', id, { advertiser: row.advertiser, status: row.status });
      return id;
    },
    async deletePromotion(id: string) {
      const rows = await sb.get<{ image_path: string; image_bn_path: string | null }>('promotions', { id: `eq.${id}`, select: 'image_path,image_bn_path' });
      await sb.remove('promotions', { id: `eq.${id}` });
      if (rows[0]) await sb.removeObjects('promotions', [rows[0].image_path, rows[0].image_bn_path].filter(Boolean) as string[]);
      await audit('delete_promotion', 'promotions', id);
    },
    async uploadPromotionImage(bytes: Uint8Array, fileName: string, contentType: string): Promise<string> {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new ApiError('E_INPUT', 'Use a JPG, PNG or WebP image.');
      if (bytes.byteLength > 512 * 1024) throw new ApiError('E_INPUT', 'The image must be 512 KB or smaller.');
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const base = slugify(fileName.replace(/\.[a-z0-9]+$/i, '')).slice(0, 40) || 'banner';
      const path = `banners/${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}-${base}.${ext}`;
      return sb.upload('promotions', path, bytes, contentType);
    },

    // ---- contact info & app settings ----------------------------------------------------------------------------------
    async listContacts(): Promise<ContactChannel[]> { return sb.get<ContactChannel>('contact_channels', { select: '*', order: 'sort_order.asc' }); },
    async saveContact(c: ContactChannel): Promise<string> {
      if (!clean(c.value)) throw new ApiError('E_INPUT', 'Enter the number, address or link.');
      const row = { type: c.type, label: { en: clean(c.label.en) || '', bn: clean(c.label.bn) || clean(c.label.en) || '' }, value: c.value.trim(), is_visible: c.is_visible, sort_order: c.sort_order, updated_by: uid() };
      const id = c.id ? (await sb.update('contact_channels', { id: `eq.${c.id}` }, row))[0]?.id ?? c.id : (await sb.insert<{ id: string }>('contact_channels', row))[0].id;
      await audit(c.id ? 'update_contact' : 'create_contact', 'contact_channels', id, { type: c.type });
      return id;
    },
    async deleteContact(id: string) { await sb.remove('contact_channels', { id: `eq.${id}` }); await audit('delete_contact', 'contact_channels', id); },
    async reorderContacts(ids: string[]) {
      await Promise.all(ids.map((id, i) => sb.update('contact_channels', { id: `eq.${id}` }, { sort_order: i })));
    },
    async listConfig(): Promise<AppConfigRow[]> { return sb.get<AppConfigRow>('app_config', { select: '*', order: 'key.asc' }); },
    async saveConfig(key: string, value: unknown, isPublic?: boolean) {
      if (!/^[a-z0-9_]+$/.test(key)) throw new ApiError('E_INPUT', 'Keys use lowercase letters, digits and _ only.');
      const row: Record<string, unknown> = { key, value, updated_by: uid() };
      if (isPublic !== undefined) row.is_public = isPublic;
      await sb.insert('app_config', row, { onConflict: 'key', returning: false });
      await audit('update_config', 'app_config', null, { key });
    },

    // ---- brands & products --------------------------------------------------------------------------------------------
    async listManufacturers(): Promise<Manufacturer[]> {
      const rows = await sb.get<any>('manufacturers', { select: '*,products(count)', order: 'name.asc' });
      return rows.map(r => ({ ...r, product_count: r.products?.[0]?.count ?? 0, products: undefined }));
    },
    async saveManufacturer(m: Manufacturer): Promise<string> {
      const name = clean(m.name);
      if (!name) throw new ApiError('E_INPUT', 'Enter the company name.');
      const row = {
        slug: slugify(clean(m.slug) || name), name, short_name: clean(m.short_name), country: clean(m.country), city: clean(m.city),
        website: clean(m.website), evidence_url: clean(m.evidence_url), sold_in_bd: m.sold_in_bd, status: m.status,
      };
      const id = m.id ? (await sb.update('manufacturers', { id: `eq.${m.id}` }, row))[0]?.id ?? m.id : (await sb.insert<{ id: string }>('manufacturers', row))[0].id;
      await audit(m.id ? 'update_manufacturer' : 'create_manufacturer', 'manufacturers', id, { name });
      return id;
    },
    async listProducts(f: { q?: string; manufacturer?: string }): Promise<Product[]> {
      const q: Query = { select: '*,manufacturers(name,short_name),remedies(latin_name,slug)', order: 'name.asc', limit: 500 };
      if (f.manufacturer) q.manufacturer_id = `eq.${f.manufacturer}`;
      const t = likeSafe(f.q || '');
      if (t) q.name = `ilike.*${t}*`;
      return sb.get<Product>('products', q);
    },
    async saveProduct(p: Product): Promise<string> {
      const name = clean(p.name);
      if (!name) throw new ApiError('E_INPUT', 'Enter the product name.');
      if (!p.manufacturer_id) throw new ApiError('E_INPUT', 'Choose the manufacturer.');
      const row: Record<string, unknown> = {
        remedy_id: p.remedy_id || null, manufacturer_id: p.manufacturer_id, name, form: p.form, potency: clean(p.potency),
        pack_size: p.pack_size || null, pack_unit: p.pack_unit || null, price_bdt: p.price_bdt ?? null, price_tier: p.price_tier || null,
        status: p.status, updated_by: uid(),
      };
      if (p.id) {
        const before = await sb.get<{ price_bdt: number | null }>('products', { id: `eq.${p.id}`, select: 'price_bdt' });
        if (Number(before[0]?.price_bdt ?? -1) !== Number(p.price_bdt ?? -1)) row.price_updated_at = new Date().toISOString();
      } else if (p.price_bdt != null) row.price_updated_at = new Date().toISOString();
      const id = p.id ? (await sb.update('products', { id: `eq.${p.id}` }, row))[0]?.id ?? p.id : (await sb.insert<{ id: string }>('products', row))[0].id;
      await audit(p.id ? 'update_product' : 'create_product', 'products', id, { name });
      return id;
    },
    async deleteProduct(id: string) { await sb.remove('products', { id: `eq.${id}` }); await audit('delete_product', 'products', id); },

    // ---- team ---------------------------------------------------------------------------------------------------------
    async listStaff(): Promise<StaffMember[]> { return sb.get<StaffMember>('staff', { select: 'user_id,display_name,role,created_at', order: 'created_at.asc' }); },
    async addStaff(email: string, password: string, displayName: string, role: StaffRole): Promise<{ confirmed: boolean }> {
      if (!clean(displayName)) throw new ApiError('E_INPUT', 'Enter the person\'s name.');
      if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new ApiError('E_INPUT', 'Enter a valid email address.');
      if (!password || password.length < 8) throw new ApiError('E_WEAK', 'The first password needs at least 8 characters.');
      const u = await sb.signUp(email.trim().toLowerCase(), password);
      await sb.insert('staff', { user_id: u.id, display_name: displayName.trim(), role }, { returning: false });
      await audit('add_staff', 'staff', u.id, { role });
      return { confirmed: u.confirmed };
    },
    async setStaffRole(userId: string, role: StaffRole) {
      if (userId === uid()) throw new ApiError('E_INPUT', 'You cannot change your own role.');
      await sb.update('staff', { user_id: `eq.${userId}` }, { role });
      await audit('set_role', 'staff', userId, { role });
    },
    async removeStaff(userId: string) {
      if (userId === uid()) throw new ApiError('E_INPUT', 'You cannot remove yourself.');
      await sb.remove('staff', { user_id: `eq.${userId}` });
      await audit('remove_staff', 'staff', userId);
    },

    async listBackupRuns(): Promise<import('./types').BackupRun[]> {
      return sb.get('backup_runs', { select: '*', order: 'started_at.desc', limit: 60 });
    },
  };
  return api;
}

export type Api = ReturnType<typeof makeApi>;
export type ApiMethod = keyof Api;
