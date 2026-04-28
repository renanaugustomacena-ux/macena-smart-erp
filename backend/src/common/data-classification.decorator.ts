import 'reflect-metadata';

/**
 * Data-classification levels per plan §10.7 + §11.5.
 *
 * - `public`       — Landing-page copy, OpenAPI spec, marketing PDFs.
 *                    No restrictions.
 * - `internal`     — Chart-of-accounts templates, country aggregates,
 *                    reference data. Authenticated users of any tenant.
 * - `confidential` — Products, sales orders, production plans, invoices,
 *                    customer/supplier anagraphics. Tenant-scoped.
 * - `restricted`   — Payment IBANs, SDI credentials, password hashes,
 *                    audit-log bodies, totpSecret, PSD2 consents. Field-
 *                    level AES-256-GCM at rest (per ADR-DA07);
 *                    KMS-sourced key; access logged.
 */
export type DataClassificationLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

const META_KEY = Symbol('smarterp:data-classification');
const META_KEYS_LIST = Symbol('smarterp:data-classification:keys');

/**
 * Property decorator that records the data-classification level of an
 * entity column. The classification is consumed by:
 *   - the field-level-encryption layer (`restricted` triggers AES-256-GCM
 *     wrapping of the column at rest; per ADR-DA07 / plan §11.5),
 *   - the structured-log redaction config (`restricted` and many
 *     `confidential` fields are added to the Pino redact list),
 *   - the GDPR ROPA export (auto-derives "categorie di dati" per
 *     processing per art. 30 GDPR / plan §12.2.4),
 *   - the OpenAPI generator (Phase 3+ — "x-data-classification" extension
 *     surfaces the level on every schema property).
 *
 * Usage:
 *   ```ts
 *   @Column({ length: 11, nullable: true })
 *   @DataClassification('confidential')
 *   vatNumber: string;
 *   ```
 */
export function DataClassification(
  level: DataClassificationLevel,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(META_KEY, level, target, propertyKey);
    // Also maintain a per-class array of classified keys, because plain
    // TypeScript class field declarations like `email: string;` (without
    // an initializer) do NOT create property descriptors on the prototype
    // at runtime — they are erased to type annotations. So we cannot
    // discover them via `Object.getOwnPropertyNames(proto)`.
    const existing =
      (Reflect.getOwnMetadata(META_KEYS_LIST, target) as
        | (string | symbol)[]
        | undefined) ?? [];
    if (!existing.includes(propertyKey)) {
      Reflect.defineMetadata(
        META_KEYS_LIST,
        [...existing, propertyKey],
        target,
      );
    }
  };
}

/**
 * Read the classification of a column. Returns `undefined` for unannotated
 * columns; callers should treat that as "default policy" (currently:
 * confidential at the application layer, not encrypted at rest).
 */
export function getDataClassification(
  target: object,
  propertyKey: string | symbol,
): DataClassificationLevel | undefined {
  return Reflect.getMetadata(META_KEY, target, propertyKey) as
    | DataClassificationLevel
    | undefined;
}

/**
 * List every classified property on an instance / prototype. Used by the
 * audit script and by the redaction-config builder.
 */
export function listClassifiedProperties(
  target: object,
): { propertyKey: string; level: DataClassificationLevel }[] {
  const proto =
    typeof target === 'function'
      ? (target as { prototype: object }).prototype
      : Object.getPrototypeOf(target);
  const keys =
    (Reflect.getOwnMetadata(META_KEYS_LIST, proto) as
      | (string | symbol)[]
      | undefined) ?? [];
  const out: { propertyKey: string; level: DataClassificationLevel }[] = [];
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const level = Reflect.getMetadata(META_KEY, proto, key) as
      | DataClassificationLevel
      | undefined;
    if (level) out.push({ propertyKey: key, level });
  }
  return out;
}
