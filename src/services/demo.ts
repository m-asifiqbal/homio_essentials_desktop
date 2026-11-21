/**
 * Demo store for previewing the screens in a browser (`npm run dev`, then open http://localhost:5173/#demo).
 * Sample data only, kept in memory: nothing here reaches the server. The Electron app never uses it.
 */
import type {
  AuditEntry, BackupRun, ContactChannel, AppConfigRow, Manufacturer, MedicineRequest, Product, Promotion, PublicSession,
  RemedyDetail, RemedyRow, StaffMember,
} from '@shared/types';

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const uuid = () => (crypto as any).randomUUID?.() || Math.random().toString(16).slice(2) + Date.now().toString(16);
const wait = (ms = 220) => new Promise(r => setTimeout(r, ms));

const ME: PublicSession = { userId: 'u-farzana', email: 'farzana@example.org', displayName: 'Dr. Farzana R.', role: 'owner' };
let session: PublicSession | null = null;

const R = (slug: string, latin: string, kingdom: any, bn: string | null, common: string, status: any = 'published', review = true, abbr: string | null = null): RemedyRow => ({
  id: `r-${slug}`, slug, latin_name: latin, abbreviation: abbr, kingdom, status, needs_medical_review: review, updated_at: ago(Math.random() * 400), groups: [],
  remedy_translations: [{ locale: 'en', display_name: null, common_name: common, summary: `${common}. Sample summary text.` }, ...(bn ? [{ locale: 'bn' as const, display_name: bn, common_name: null, summary: 'নমুনা সারাংশ।' }] : [])],
});
const remedies: RemedyRow[] = [
  R('aconitum-napellus', 'Aconitum napellus', 'plant', 'অ্যাকোনাইট', 'Monkshood', 'published', false, 'Acon.'),
  R('apis-mellifica', 'Apis mellifica', 'animal', 'এপিস মেলিফিকা', 'Honey bee', 'published', false, 'Apis.'),
  R('arnica-montana', 'Arnica montana', 'plant', 'আর্নিকা মন্টানা', "Leopard's bane", 'published', false, 'Arn.'),
  R('arsenicum-album', 'Arsenicum album', 'mineral', 'আর্সেনিকাম অ্যালবাম', 'Arsenic trioxide', 'published', true, 'Ars.'),
  R('belladonna', 'Belladonna', 'plant', 'বেলেডোনা', 'Deadly nightshade', 'published', false, 'Bell.'),
  R('bryonia-alba', 'Bryonia alba', 'plant', 'ব্রায়োনিয়া', 'Wild hops', 'published', true, 'Bry.'),
  R('calcarea-carbonica', 'Calcarea carbonica', 'mineral', null, 'Carbonate of lime', 'published', true, 'Calc.'),
  R('calendula-officinalis', 'Calendula officinalis', 'plant', null, 'Marigold', 'draft', true, 'Calen.'),
  R('chamomilla', 'Chamomilla', 'plant', 'ক্যামোমিলা', 'German chamomile', 'published', false, 'Cham.'),
  R('gelsemium-sempervirens', 'Gelsemium sempervirens', 'plant', null, 'Yellow jasmine', 'published', true, 'Gels.'),
  R('hepar-sulphuris', 'Hepar sulphuris calcareum', 'mineral', null, "Hahnemann's calcium sulphide", 'published', true, 'Hep.'),
  R('kali-phosphoricum', 'Kali phosphoricum', 'mineral', 'কালি ফস', 'Potassium phosphate', 'published', false, 'Kali-p.'),
  R('lachesis-mutus', 'Lachesis mutus', 'animal', null, 'Bushmaster snake', 'published', true, 'Lach.'),
  R('lycopodium-clavatum', 'Lycopodium clavatum', 'plant', null, 'Club moss', 'published', true, 'Lyc.'),
  R('medorrhinum', 'Medorrhinum', 'nosode', null, 'Gonorrhoeal virus', 'stub', true, 'Med.'),
  R('nux-vomica', 'Nux vomica', 'plant', 'নাক্স ভমিকা', 'Poison nut', 'published', false, 'Nux-v.'),
  R('pulsatilla-nigricans', 'Pulsatilla nigricans', 'plant', 'পালসেটিলা', 'Wind flower', 'published', false, 'Puls.'),
  R('rhus-toxicodendron', 'Rhus toxicodendron', 'plant', 'রাস টক্স', 'Poison ivy', 'published', true, 'Rhus-t.'),
  R('sepia-officinalis', 'Sepia officinalis', 'animal', null, 'Inky juice of cuttlefish', 'published', true, 'Sep.'),
  R('sulphur', 'Sulphur', 'mineral', 'সালফার', 'Sublimated sulphur', 'published', true, 'Sulph.'),
  R('thuja-occidentalis', 'Thuja occidentalis', 'plant', 'থুজা', 'Arbor vitae', 'published', true, 'Thuj.'),
  R('thyroidinum', 'Thyroidinum', 'sarcode', null, 'Dried thyroid gland', 'stub', true, null),
];

const requests: MedicineRequest[] = [
  { id: 'q1', code: 'REQ-1042', kind: 'remedy', payload: { latin_name: 'Calendula officinalis', common_name: 'Marigold', description: 'Used on minor cuts and grazes to support clean healing of the skin.', potency: 'Q, 30C', brand: 'SBL' }, photo_paths: [], requester_role: 'student', device_id: 'dev-aaaaaaaaaaaaaaaa', status: 'new', reviewer_note: null, linked_remedy_id: null, created_at: ago(2), updated_at: ago(2) },
  { id: 'q2', code: 'REQ-1039', kind: 'product', payload: { latin_name: 'Thuja Ointment 25 g', brand: 'SBL', description: 'Seen at a pharmacy in Mirpur, ৳180.' }, photo_paths: [], requester_role: 'general', device_id: 'dev-bbbbbbbbbbbbbbbb', status: 'new', reviewer_note: null, linked_remedy_id: null, created_at: ago(26), updated_at: ago(26) },
  { id: 'q3', code: 'REQ-1031', kind: 'remedy', payload: { latin_name: 'Kali phosphoricum 6X', bangla_name: 'কালি ফস', potency: '6X' }, photo_paths: [], requester_role: 'practitioner', device_id: 'dev-cccccccccccccccc', status: 'new', reviewer_note: null, linked_remedy_id: null, created_at: ago(98), updated_at: ago(98) },
  { id: 'q4', code: 'REQ-1027', kind: 'product', payload: { latin_name: 'Arsenicum Album 200', brand: "Bakson's" }, photo_paths: [], requester_role: 'general', device_id: 'dev-dddddddddddddddd', status: 'needs_info', reviewer_note: 'Please send a photo of the label.', linked_remedy_id: null, created_at: ago(130), updated_at: ago(40) },
  { id: 'q5', code: 'REQ-1012', kind: 'remedy', payload: { latin_name: 'Hypericum perforatum', common_name: "St. John's wort" }, photo_paths: [], requester_role: 'student', device_id: 'dev-eeeeeeeeeeeeeeee', status: 'approved', reviewer_note: 'Added, thank you!', linked_remedy_id: null, created_at: ago(300), updated_at: ago(280) },
  { id: 'q6', code: 'REQ-1004', kind: 'remedy', payload: { latin_name: 'Rescue drops' }, photo_paths: [], requester_role: 'general', device_id: 'dev-ffffffffffffffff', status: 'rejected', reviewer_note: 'This is a flower-essence blend, not a homeopathic remedy.', linked_remedy_id: null, created_at: ago(500), updated_at: ago(470) },
];

const staff: StaffMember[] = [
  { user_id: 'u-farzana', display_name: 'Dr. Farzana R.', role: 'owner', created_at: ago(900) },
  { user_id: 'u-tanvir', display_name: 'Tanvir H.', role: 'editor', created_at: ago(700) },
  { user_id: 'u-nadia', display_name: 'Nadia K.', role: 'reviewer', created_at: ago(400) },
];
const audit: AuditEntry[] = [
  { id: 5, actor_id: 'u-tanvir', action: 'update_remedy', entity: 'remedies', entity_id: 'r-arnica-montana', diff: { latin_name: 'Arnica montana' }, created_at: ago(0.4) },
  { id: 4, actor_id: 'u-farzana', action: 'update_product', entity: 'products', entity_id: 'p1', diff: { name: 'Nux Vomica 30' }, created_at: ago(20) },
  { id: 3, actor_id: 'u-nadia', action: 'request_rejected', entity: 'medicine_requests', entity_id: 'q6', diff: null, created_at: ago(48) },
  { id: 2, actor_id: 'u-farzana', action: 'create_promotion', entity: 'promotions', entity_id: 'pr1', diff: { advertiser: 'Hahnemann Lab' }, created_at: ago(72) },
];
const manufacturers: Manufacturer[] = [
  { id: 'm1', slug: 'sbl', name: 'SBL Pvt. Ltd.', short_name: 'SBL', country: 'India', city: 'Noida', website: 'https://www.sblglobal.com', evidence_url: null, sold_in_bd: true, status: 'published', product_count: 2 },
  { id: 'm2', slug: 'dr-reckeweg', name: 'Dr. Reckeweg & Co.', short_name: 'Reckeweg', country: 'Germany', city: 'Bensheim', website: null, evidence_url: null, sold_in_bd: true, status: 'published', product_count: 1 },
  { id: 'm3', slug: 'hahnemann-lab', name: 'Hahnemann Laboratory', short_name: 'HL', country: 'Bangladesh', city: 'Dhaka', website: null, evidence_url: null, sold_in_bd: true, status: 'published', product_count: 1 },
];
const products: Product[] = [
  { id: 'p1', remedy_id: 'r-nux-vomica', manufacturer_id: 'm3', name: 'Nux Vomica 30', form: 'dilution', potency: '30C', pack_size: 30, pack_unit: 'ml', price_bdt: 120, price_tier: 'economy', price_updated_at: ago(20), status: 'published', manufacturers: { name: 'Hahnemann Laboratory', short_name: 'HL' }, remedies: { latin_name: 'Nux vomica', slug: 'nux-vomica' } },
  { id: 'p2', remedy_id: 'r-arnica-montana', manufacturer_id: 'm1', name: 'Arnica Montana Q', form: 'mother_tincture', potency: 'Q', pack_size: 30, pack_unit: 'ml', price_bdt: 210, price_tier: 'standard', price_updated_at: ago(2400), status: 'published', manufacturers: { name: 'SBL Pvt. Ltd.', short_name: 'SBL' }, remedies: { latin_name: 'Arnica montana', slug: 'arnica-montana' } },
  { id: 'p3', remedy_id: null, manufacturer_id: 'm2', name: 'Calendula Ø', form: 'mother_tincture', potency: 'Q', pack_size: 20, pack_unit: 'ml', price_bdt: null, price_tier: null, price_updated_at: null, status: 'draft', manufacturers: { name: 'Dr. Reckeweg & Co.', short_name: 'Reckeweg' }, remedies: null },
  { id: 'p4', remedy_id: 'r-thuja-occidentalis', manufacturer_id: 'm1', name: 'Thuja Ointment', form: 'ointment', potency: null, pack_size: 25, pack_unit: 'g', price_bdt: 180, price_tier: 'economy', price_updated_at: ago(30), status: 'published', manufacturers: { name: 'SBL Pvt. Ltd.', short_name: 'SBL' }, remedies: { latin_name: 'Thuja occidentalis', slug: 'thuja-occidentalis' } },
];
const promotions: Promotion[] = [
  { id: 'pr1', advertiser: 'Hahnemann Lab', title: { en: 'Free delivery on remedy kits', bn: 'রেমেডি কিটে ফ্রি ডেলিভারি' }, image_path: '', image_bn_path: null, tap_action: 'link', tap_value: 'https://example.org', placements: ['home'], remedy_ids: [], starts_at: ago(72), ends_at: ago(-24 * 25), sort_order: 0, status: 'published', updated_at: ago(72) },
  { id: 'pr2', advertiser: 'Green Pharmacy', title: { en: 'Open late on Fridays', bn: 'শুক্রবার রাত পর্যন্ত খোলা' }, image_path: '', image_bn_path: null, tap_action: 'call', tap_value: '+8801700000000', placements: ['home', 'remedy'], remedy_ids: [], starts_at: ago(-24 * 3), ends_at: ago(-24 * 33), sort_order: 1, status: 'draft', updated_at: ago(10) },
];
const contacts: ContactChannel[] = [
  { id: 'c1', type: 'phone', label: { en: 'Helpline', bn: 'হেল্পলাইন' }, value: '+880 1700-000000', is_visible: true, sort_order: 0 },
  { id: 'c2', type: 'whatsapp', label: { en: 'WhatsApp', bn: 'হোয়াটসঅ্যাপ' }, value: '+8801700000000', is_visible: true, sort_order: 1 },
  { id: 'c3', type: 'email', label: { en: 'Email us', bn: 'ইমেইল করুন' }, value: 'hello@example.org', is_visible: true, sort_order: 2 },
  { id: 'c4', type: 'facebook', label: { en: 'Facebook page', bn: 'ফেসবুক পেজ' }, value: 'https://facebook.com/example', is_visible: false, sort_order: 3 },
];
// same keys and shapes as the live app_config (supabase/seed/data/reference.json)
const config: AppConfigRow[] = [
  { key: 'address', value: { text: { en: 'House 12, Road 5, Dhanmondi, Dhaka', bn: 'বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা' }, lat: null, lng: null, show_map: false }, is_public: true },
  { key: 'admob', value: { enabled: false, anchored_on_main_tabs: true, inline_on_detail_pages: true, in_onboarding_and_forms: false }, is_public: true },
  { key: 'ads_contact', value: { email: 'ads@example.org', whatsapp: '+8801700000000', rate_card_path: null }, is_public: true },
  { key: 'content_notice', value: { sample_data: true, note: 'Seed content awaiting review by a registered homeopath.' }, is_public: true },
  { key: 'disclaimer', value: { en: 'Reference information from homeopathic literature — not medical advice.', bn: 'হোমিওপ্যাথিক সাহিত্য থেকে নেওয়া তথ্য — চিকিৎসা পরামর্শ নয়।' }, is_public: true },
  { key: 'min_app_version', value: { android: '1.0.0', windows_admin: '1.0.0' }, is_public: true },
  { key: 'office_hours', value: { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'], opens: '10:00', closes: '18:00', timezone: 'Asia/Dhaka', show_open_now: true, closed_message: { en: "We're closed — leave a WhatsApp message.", bn: 'এখন বন্ধ — হোয়াটসঅ্যাপে বার্তা রাখুন।' } }, is_public: true },
  { key: 'promo_fallback', value: { enabled: true, title: { en: 'Your promotion here', bn: 'এখানে আপনার প্রচার' }, body: { en: 'Reach patients, students and practitioners across Bangladesh.', bn: 'সারা দেশের রোগী, শিক্ষার্থী ও চিকিৎসকদের কাছে পৌঁছে দিন।' }, cta: 'contact' }, is_public: true },
];
const runs: BackupRun[] = [
  { id: 'b2', kind: 'daily', status: 'verified', started_at: ago(9), finished_at: ago(8.98), db_size_bytes: 9_400_000, tables_count: 24, row_counts: { remedies: 750, materia_entries: 6669 }, sha256: 'a1b2c3', locations: ['this-pc', 'cloud'], error: null, created_by: 'u-farzana' },
  { id: 'b1', kind: 'manual', status: 'succeeded', started_at: ago(40), finished_at: ago(39.98), db_size_bytes: 9_380_000, tables_count: 24, row_counts: { remedies: 750 }, sha256: 'd4e5f6', locations: ['this-pc', 'cloud'], error: null, created_by: 'u-farzana' },
];

function detail(id: string): RemedyDetail {
  const r = remedies.find(x => x.id === id);
  if (!r) throw new Error('E_NOT_FOUND: This remedy no longer exists.');
  return {
    ...r, family: r.kingdom === 'plant' ? 'Ranunculaceae' : null, potencies: ['6C', '30C', '200C'], forms: ['globules', 'dilution'], external_use: r.slug.startsWith('arnica') || r.slug.startsWith('calendula'),
    search_keys: [r.slug.split('-')[0]], source_refs: [{ book: 'boericke' }], reviewed_at: r.needs_medical_review ? null : ago(200), created_at: ago(2000),
    remedy_translations: [
      { locale: 'en', display_name: null, common_name: r.remedy_translations[0]?.common_name ?? null, summary: r.remedy_translations[0]?.summary ?? null, origin: null, preparation: null, keynotes: ['Sudden onset after a shock or exposure to cold, dry wind.', 'Great restlessness and anxiety.'] },
      { locale: 'bn', display_name: r.remedy_translations[1]?.display_name ?? null, common_name: null, summary: r.remedy_translations[1]?.summary ?? null, origin: null, preparation: null, keynotes: [] },
    ],
    remedy_safety_notes: [{ id: 's1', severity: 'caution', body: { en: 'Mother tincture is for external use only.', bn: 'মাদার টিংচার শুধু বাহ্যিক ব্যবহারের জন্য।' }, sort_order: 0 }],
    remedy_uses: [{ id: 'u1', route: 'internal', typical_potencies: ['30C'], conditions: { slug: 'fever', condition_translations: [{ locale: 'en', name: 'Fever' }, { locale: 'bn', name: 'জ্বর' }] }, remedy_use_translations: [] }],
    products: products.filter(p => p.remedy_id === id).map(p => ({ id: p.id!, name: p.name, potency: p.potency, form: p.form, price_bdt: p.price_bdt, status: p.status, manufacturers: { name: p.manufacturers!.name } })),
    relations: [{ relation_type: 'compare', related: { slug: 'belladonna', latin_name: 'Belladonna' } }, { relation_type: 'complementary', related: { slug: 'sulphur', latin_name: 'Sulphur' } }],
    materia: [{ source_book: 'boericke', count: 14 }, { source_book: 'allen', count: 1 }],
  };
}

const handlers: Record<string, (...a: any[]) => any> = {
  getSession: () => session,
  signIn: (email: string, password: string) => {
    if (!email || !password) throw new Error('E_INPUT: Enter your email and password.');
    if (password.length < 4) throw new Error('E_AUTH: Wrong email or password.');
    session = { ...ME, email };
    return session;
  },
  signOut: () => { session = null; },
  changePassword: () => undefined,
  dashboard: () => ({
    stats: { remedies_published: remedies.filter(r => r.status === 'published').length + 696, remedies_stub: 34, remedies_need_review: 640, missing_bangla: 651,
      requests_waiting: requests.filter(r => r.status === 'new' || r.status === 'needs_info').length, stale_prices: 1,
      last_backup: { kind: runs[0].kind, status: runs[0].status, started_at: runs[0].started_at, finished_at: runs[0].finished_at } },
    drafts: remedies.filter(r => r.status === 'draft').length, conditions: 33, manufacturers: manufacturers.length, products: products.length,
    waiting: requests.filter(r => r.status === 'new' || r.status === 'needs_info').sort((a, b) => a.created_at.localeCompare(b.created_at)),
    activity: audit, staff,
  }),
  recentActivity: () => audit,
  listRemedies: (f: any) => {
    let rows = remedies.slice();
    const q = (f.q || '').toLowerCase();
    if (q) rows = rows.filter(r => r.latin_name.toLowerCase().includes(q) || r.slug.includes(q) || r.remedy_translations.some(t => (t.display_name || '').includes(f.q)));
    if (f.status) rows = rows.filter(r => r.status === f.status);
    if (f.kingdom) rows = rows.filter(r => r.kingdom === f.kingdom);
    if (f.review === 'needs') rows = rows.filter(r => r.needs_medical_review);
    if (f.review === 'done') rows = rows.filter(r => !r.needs_medical_review);
    return { rows: rows.slice(f.offset || 0, (f.offset || 0) + (f.limit || 50)), total: rows.length };
  },
  searchRemedies: (term: string) => remedies.filter(r => r.latin_name.toLowerCase().includes(term.toLowerCase())).slice(0, 12).map(r => ({ id: r.id, slug: r.slug, latin_name: r.latin_name, status: r.status })),
  getRemedy: (id: string) => detail(id),
  saveRemedy: (input: any) => {
    const id = input.id || `r-${input.slug || uuid()}`;
    const row = remedies.find(r => r.id === id);
    const tr = [{ locale: 'en' as const, ...input.translations.en }, { locale: 'bn' as const, ...input.translations.bn }];
    if (row) Object.assign(row, { latin_name: input.latin_name, kingdom: input.kingdom, status: input.status, needs_medical_review: input.needs_medical_review, updated_at: new Date().toISOString(), remedy_translations: tr });
    else remedies.push({ id, slug: input.slug, latin_name: input.latin_name, abbreviation: input.abbreviation, kingdom: input.kingdom, status: input.status, needs_medical_review: input.needs_medical_review, updated_at: new Date().toISOString(), groups: [], remedy_translations: tr });
    return id;
  },
  setRemedyStatus: (id: string, status: any) => { const r = remedies.find(x => x.id === id); if (r) r.status = status; },
  markReviewed: (id: string) => { const r = remedies.find(x => x.id === id); if (r) r.needs_medical_review = false; },
  listRequests: () => requests.slice(),
  requestDetail: (id: string) => {
    const request = requests.find(r => r.id === id)!;
    const name = String(request.payload.latin_name || '').toLowerCase();
    const first = name.split(' ')[0];
    return {
      request,
      exact: remedies.filter(r => r.latin_name.toLowerCase() === name).map(r => ({ id: r.id, slug: r.slug, latin_name: r.latin_name, status: r.status })),
      similar: remedies.filter(r => r.latin_name.toLowerCase().startsWith(first) && r.latin_name.toLowerCase() !== name).map(r => ({ id: r.id, slug: r.slug, latin_name: r.latin_name, status: r.status })),
      products: products.filter(p => p.name.toLowerCase().includes(first)).map(p => ({ id: p.id!, name: p.name, potency: p.potency, remedy_id: p.remedy_id, manufacturers: { name: p.manufacturers!.name } })),
      photos: [], history: { total: request.requester_role === 'student' ? 3 : 0, approved: request.requester_role === 'student' ? 2 : 0 },
    };
  },
  approveRequest: (id: string, _keep: string[], note: string) => { const r = requests.find(x => x.id === id)!; Object.assign(r, { status: 'approved', reviewer_note: note }); return 'r-calendula-officinalis'; },
  setRequestStatus: (id: string, status: any, note: string) => { Object.assign(requests.find(x => x.id === id)!, { status, reviewer_note: note, updated_at: new Date().toISOString() }); },
  mergeRequest: (id: string, remedyId: string, note: string) => { Object.assign(requests.find(x => x.id === id)!, { status: 'merged', linked_remedy_id: remedyId, reviewer_note: note }); },
  listPromotions: () => ({ rows: promotions.slice(), stats: { pr1: { impressions: 1840, taps: 37 } }, base: '' }),
  savePromotion: (p: Promotion) => { if (p.id) Object.assign(promotions.find(x => x.id === p.id)!, p); else promotions.push({ ...p, id: uuid() }); return p.id; },
  deletePromotion: (id: string) => { const i = promotions.findIndex(p => p.id === id); if (i >= 0) promotions.splice(i, 1); },
  uploadPromotionImage: () => '',
  listContacts: () => contacts.slice().sort((a, b) => a.sort_order - b.sort_order),
  saveContact: (c: ContactChannel) => { if (c.id) Object.assign(contacts.find(x => x.id === c.id)!, c); else contacts.push({ ...c, id: uuid() }); },
  deleteContact: (id: string) => { const i = contacts.findIndex(c => c.id === id); if (i >= 0) contacts.splice(i, 1); },
  reorderContacts: (ids: string[]) => ids.forEach((id, i) => { const c = contacts.find(x => x.id === id); if (c) c.sort_order = i; }),
  listConfig: () => config.slice(),
  saveConfig: (key: string, value: any, isPublic?: boolean) => { const c = config.find(x => x.key === key); if (c) { c.value = value; if (isPublic !== undefined) c.is_public = isPublic; } else config.push({ key, value, is_public: isPublic ?? true }); },
  listManufacturers: () => manufacturers.slice(),
  saveManufacturer: (m: Manufacturer) => { if (m.id) Object.assign(manufacturers.find(x => x.id === m.id)!, m); else manufacturers.push({ ...m, id: uuid(), product_count: 0 }); },
  listProducts: (f: any) => products.filter(p => (!f.manufacturer || p.manufacturer_id === f.manufacturer) && (!f.q || p.name.toLowerCase().includes(String(f.q).toLowerCase()))),
  saveProduct: (p: Product) => { const m = manufacturers.find(x => x.id === p.manufacturer_id); const full = { ...p, manufacturers: m ? { name: m.name, short_name: m.short_name } : null }; if (p.id) Object.assign(products.find(x => x.id === p.id)!, full); else products.push({ ...full, id: uuid() }); },
  deleteProduct: (id: string) => { const i = products.findIndex(p => p.id === id); if (i >= 0) products.splice(i, 1); },
  listStaff: () => staff.slice(),
  addStaff: (email: string, _pw: string, name: string, role: any) => { staff.push({ user_id: uuid(), display_name: name, role, created_at: new Date().toISOString() }); return { confirmed: false }; },
  setStaffRole: (id: string, role: any) => { const s = staff.find(x => x.user_id === id); if (s) s.role = role; },
  removeStaff: (id: string) => { const i = staff.findIndex(s => s.user_id === id); if (i >= 0) staff.splice(i, 1); },
  listBackupRuns: () => runs.slice(),
  __localBackups: () => runs.map(r => ({ name: `HomioBackup-${r.started_at.slice(0, 10).replace(/-/g, '')}-${r.kind}.json.gz`, path: '', size: 1_480_000, modified: r.started_at })),
  __runBackup: () => { const r: BackupRun = { ...runs[0], id: uuid(), kind: 'manual', status: 'succeeded', started_at: new Date().toISOString(), finished_at: new Date().toISOString() }; runs.unshift(r); return r; },
};

export async function demoCall(method: string, args: unknown[]): Promise<unknown> {
  await wait(method === 'dashboard' || method === 'listRemedies' ? 380 : 200);
  const fn = handlers[method];
  if (!fn) throw new Error(`E_DEMO: "${method}" is not available in the demo.`);
  return structuredClone(fn(...args));
}
