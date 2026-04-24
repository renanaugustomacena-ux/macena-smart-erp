/**
 * Tiny i18n loader for the SmartERP frontend.
 *
 * Kept intentionally dependency-free so the Next.js client bundle stays
 * small. A full `next-intl` integration is scheduled for Q3 2026 along
 * with the dashboard forms build-out; until then this module exposes the
 * minimum API that page / layout components need.
 */
import itBundle from '../locales/it.json';
import enBundle from '../locales/en.json';
import deBundle from '../locales/de.json';

export type Locale = 'it' | 'en' | 'de';

type Bundle = Record<string, unknown>;

const bundles: Record<Locale, Bundle> = {
  it: itBundle as Bundle,
  en: enBundle as Bundle,
  de: deBundle as Bundle,
};

export const DEFAULT_LOCALE: Locale = 'it';
export const SUPPORTED_LOCALES: Locale[] = ['it', 'en', 'de'];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

/**
 * Resolve a dotted key (`navigation.dashboard`) against the chosen locale
 * bundle. Falls back to Italian (DEFAULT_LOCALE), then to the key itself
 * so a missing translation is visible rather than silently empty.
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const resolve = (bundle: Bundle | undefined): string | undefined => {
    if (!bundle) return undefined;
    const parts = key.split('.');
    let cursor: unknown = bundle;
    for (const part of parts) {
      if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return typeof cursor === 'string' ? cursor : undefined;
  };

  const raw = resolve(bundles[locale]) ?? resolve(bundles[DEFAULT_LOCALE]) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name) => String(vars[name] ?? `{${name}}`));
}
