/**
 * Every string on screen goes through t(key, english). The English text lives at the call site; the Bangla text
 * lives in src/locales/* (one file per area). A missing Bangla entry falls back to the English text.
 * Labels built from data (kingdom.plant, form.mother_tincture …) also have English entries in locales/common.ts.
 */
import shell from '../locales/shell';
import common, { EN_LABELS } from '../locales/common';
import medicines from '../locales/medicines';
import requests from '../locales/requests';
import content from '../locales/content';
import system from '../locales/system';

export type AppLanguage = 'en' | 'bn';
export type Dict = Record<string, string>;

export const BN: Dict = { ...shell, ...common, ...medicines, ...requests, ...content, ...system };
export const EN: Dict = EN_LABELS;

const DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const toBanglaDigits = (val: string | number): string => String(val).replace(/[0-9]/g, d => DIGITS[+d]);

export function translate(lang: AppLanguage, key: string, fallback?: string): string {
  if (lang === 'bn') return BN[key] ?? EN[key] ?? fallback ?? key;
  return EN[key] ?? fallback ?? key;
}

/** "{n} remedies" style placeholders. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
