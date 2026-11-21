/**
 * Types shared by the main process (electron/), the renderer (src/) and the API core (shared/core.ts).
 * Column names follow the Supabase schema in the backend repo (supabase/migrations).
 */

export type StaffRole = 'reviewer' | 'editor' | 'owner';
export const ROLE_RANK: Record<StaffRole, number> = { reviewer: 1, editor: 2, owner: 3 };

export interface Session {
  access_token: string;
  refresh_token: string;
  /** epoch seconds */
  expires_at: number;
  user: { id: string; email: string };
  staff: { display_name: string; role: StaffRole };
}

/** What the renderer is allowed to know about the session (no tokens). */
export interface PublicSession {
  userId: string;
  email: string;
  displayName: string;
  role: StaffRole;
}

export type I18n = { en?: string | null; bn?: string | null };
export type ContentStatus = 'stub' | 'draft' | 'published' | 'archived';
export type Kingdom = 'plant' | 'mineral' | 'animal' | 'nosode' | 'sarcode' | 'imponderabilia' | 'other';
export type RequestStatus = 'new' | 'needs_info' | 'approved' | 'merged' | 'rejected';
export type ProductForm = 'dilution' | 'globules' | 'tablets' | 'mother_tincture' | 'ointment' | 'gel' | 'drops' | 'syrup' | 'combination' | 'other';

export const KINGDOMS: Kingdom[] = ['plant', 'mineral', 'animal', 'nosode', 'sarcode', 'imponderabilia', 'other'];
export const STATUSES: ContentStatus[] = ['published', 'draft', 'stub', 'archived'];
export const PRODUCT_FORMS: ProductForm[] = ['dilution', 'globules', 'tablets', 'mother_tincture', 'ointment', 'gel', 'drops', 'syrup', 'combination', 'other'];

export interface RemedyTranslation {
  remedy_id?: string;
  locale: 'en' | 'bn';
  display_name?: string | null;
  common_name?: string | null;
  summary?: string | null;
  origin?: string | null;
  preparation?: string | null;
  keynotes?: string[];
}

export interface RemedyRow {
  id: string;
  slug: string;
  latin_name: string;
  abbreviation: string | null;
  kingdom: Kingdom | null;
  status: ContentStatus;
  needs_medical_review: boolean;
  updated_at: string;
  groups: string[];
  remedy_translations: RemedyTranslation[];
}

export interface SafetyNote { id?: string; severity: 'info' | 'caution' | 'danger'; body: I18n; sort_order: number }

export interface RemedyDetail extends RemedyRow {
  family: string | null;
  potencies: string[];
  forms: ProductForm[];
  external_use: boolean;
  search_keys: string[];
  source_refs: { book?: string; url?: string }[];
  reviewed_at: string | null;
  created_at: string;
  remedy_safety_notes: SafetyNote[];
  remedy_uses: { id: string; route: string; typical_potencies: string[]; conditions: { slug: string; condition_translations: { locale: string; name: string }[] } | null; remedy_use_translations: { locale: string; title: string | null; description: string | null }[] }[];
  products: { id: string; name: string; potency: string | null; form: ProductForm; price_bdt: number | null; status: string; manufacturers: { name: string } | null }[];
  relations: { relation_type: string; related: { slug: string; latin_name: string } | null }[];
  materia: { source_book: string; count: number }[];
}

export interface RemedyInput {
  id?: string;
  slug: string;
  latin_name: string;
  abbreviation: string | null;
  kingdom: Kingdom | null;
  family: string | null;
  groups: string[];
  potencies: string[];
  forms: ProductForm[];
  external_use: boolean;
  search_keys: string[];
  status: ContentStatus;
  needs_medical_review: boolean;
  translations: { en: RemedyTranslation; bn: RemedyTranslation };
  safety: SafetyNote[];
}

export interface MedicineRequest {
  id: string;
  code: string;
  kind: 'remedy' | 'product';
  payload: Record<string, any>;
  photo_paths: string[];
  requester_role: 'general' | 'student' | 'practitioner' | null;
  device_id: string;
  status: RequestStatus;
  reviewer_note: string | null;
  linked_remedy_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestDetail {
  request: MedicineRequest;
  exact: { id: string; slug: string; latin_name: string; status: ContentStatus }[];
  similar: { id: string; slug: string; latin_name: string; status: ContentStatus }[];
  products: { id: string; name: string; potency: string | null; remedy_id: string | null; manufacturers: { name: string } | null }[];
  photos: { path: string; url: string | null }[];
  history: { total: number; approved: number };
}

export interface Promotion {
  id?: string;
  advertiser: string;
  title: I18n;
  image_path: string;
  image_bn_path: string | null;
  tap_action: 'link' | 'call' | 'whatsapp';
  tap_value: string;
  placements: ('home' | 'remedy')[];
  remedy_ids: string[];
  starts_at: string;
  ends_at: string;
  sort_order: number;
  status: 'draft' | 'published' | 'archived';
  updated_at?: string;
}
export interface PromotionStats { impressions: number; taps: number }

export type ContactType = 'phone' | 'whatsapp' | 'email' | 'facebook' | 'messenger' | 'youtube' | 'website' | 'address';
export const CONTACT_TYPES: ContactType[] = ['phone', 'whatsapp', 'email', 'facebook', 'messenger', 'youtube', 'website', 'address'];
export interface ContactChannel { id?: string; type: ContactType; label: I18n; value: string; is_visible: boolean; sort_order: number }

export interface AppConfigRow { key: string; value: any; is_public: boolean; updated_at?: string }

export interface Manufacturer {
  id?: string; slug: string; name: string; short_name: string | null; country: string | null; city: string | null;
  website: string | null; evidence_url: string | null; sold_in_bd: boolean | null; status: ContentStatus; product_count?: number;
}
export interface Product {
  id?: string; remedy_id: string | null; manufacturer_id: string; name: string; form: ProductForm; potency: string | null;
  pack_size: number | null; pack_unit: 'ml' | 'g' | 'tablets' | 'pellets' | null; price_bdt: number | null; price_tier: 'economy' | 'standard' | 'premium' | null;
  price_updated_at?: string | null; status: ContentStatus;
  manufacturers?: { name: string; short_name: string | null } | null; remedies?: { latin_name: string; slug: string } | null;
}

export interface StaffMember { user_id: string; display_name: string; role: StaffRole; created_at: string }
export interface AuditEntry { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; diff: any; created_at: string }

export interface BackupRun {
  id: string; kind: 'daily' | 'manual' | 'monthly'; status: 'running' | 'succeeded' | 'failed' | 'verified' | 'test_restored';
  started_at: string; finished_at: string | null; db_size_bytes: number | null; tables_count: number | null;
  row_counts: Record<string, number> | null; sha256: string | null; locations: string[]; error: string | null; created_by: string | null;
}
export interface LocalBackupFile { name: string; path: string; size: number; modified: string }

export interface DashboardData {
  stats: {
    remedies_published: number; remedies_stub: number; remedies_need_review: number; missing_bangla: number;
    requests_waiting: number; stale_prices: number;
    last_backup: { kind: string; status: string; started_at: string; finished_at: string | null } | null;
  };
  drafts: number;
  conditions: number;
  manufacturers: number;
  products: number;
  waiting: MedicineRequest[];
  activity: AuditEntry[];
  staff: StaffMember[];
}

export interface AppInfo { version: string; electron: string; backupsDir: string; serverUrl: string; platform: string }
