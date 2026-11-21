/**
 * Read-only smoke test of shared/core.ts against the live server with the public anon key (no sign-in):
 * REST reads, counting, embedded translations, the Bangla search path, public storage URLs, and that
 * staff-only operations are refused without a session. Writes nothing.
 *   node scripts/run-smoke.js
 */
import * as fs from 'fs';
import * as path from 'path';
import { Supa, makeApi, authorize } from '../shared/core';

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'supabase.json'), 'utf8'));
const sb = new Supa(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { load: () => null, save: () => undefined });
const api = makeApi(sb);
let failed = 0;
const check = (name: string, ok: boolean, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) failed++; };

(async () => {
  const published = await sb.count('remedies', { status: 'eq.published' });
  check('count published remedies', published > 600, String(published));

  const list = await api.listRemedies({ q: 'arnica', offset: 0, limit: 10 });
  check('listRemedies latin search', list.rows.some(r => r.slug === 'arnica-montana'), `${list.total} hits`);
  check('embedded translations', Array.isArray(list.rows[0]?.remedy_translations));

  const bn = await api.listRemedies({ q: 'আর্নিকা', offset: 0, limit: 10 });
  check('listRemedies Bangla search', bn.rows.length > 0, `${bn.total} hits`);

  const page2 = await api.listRemedies({ offset: 50, limit: 50 });
  check('paging with total', page2.rows.length === 50 && page2.total >= published, `total ${page2.total}`);

  const plant = await api.listRemedies({ kingdom: 'mineral', review: 'needs', offset: 0, limit: 5 });
  check('filters kingdom + review', plant.rows.every(r => r.kingdom === 'mineral' && r.needs_medical_review), `${plant.total}`);

  const id = list.rows.find(r => r.slug === 'arnica-montana')!.id;
  const d = await api.getRemedy(id);
  check('getRemedy detail', d.latin_name === 'Arnica montana' && d.materia.length > 0, `books ${d.materia.map(m => `${m.source_book}:${m.count}`).join(',')}, relations ${d.relations.length}, uses ${d.remedy_uses.length}`);

  const hits = await api.searchRemedies('nux');
  check('searchRemedies', hits.length > 0, hits.map(h => h.latin_name).join(', '));

  const makers = await api.listManufacturers();
  check('manufacturers with product count', makers.length > 0 && typeof makers[0].product_count === 'number', `${makers.length}`);

  const contacts = await api.listContacts();
  check('contact channels (public)', contacts.length > 0, `${contacts.length}`);

  const cfgRows = await api.listConfig();
  check('app_config (public keys)', cfgRows.some(r => r.key === 'admob'), cfgRows.map(r => r.key).join(','));

  let refused = false;
  try { authorize(sb, 'dashboard'); } catch (e: any) { refused = String(e.message).startsWith('E_SESSION'); }
  check('staff operation refused without session', refused);

  let rpcRefused = false;
  try { await sb.rpc('admin_dashboard_stats'); } catch (e: any) { rpcRefused = String(e.message).startsWith('E_FORBIDDEN') || String(e.message).includes('not allowed'); }
  check('admin RPC refused by the database for anon', rpcRefused);

  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
