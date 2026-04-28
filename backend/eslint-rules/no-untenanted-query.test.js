/**
 * RuleTester-based unit test for the `no-untenanted-query` ESLint rule.
 *
 * Run from repo root:
 *   node backend/eslint-rules/no-untenanted-query.test.js
 *
 * Exits 0 on success, non-zero on rule-behaviour regression.
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-untenanted-query');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-untenanted-query', rule, {
  valid: [
    // tenantId in inline object
    {
      code: `this.repo.find({ where: { tenantId } });`,
    },
    {
      code: `this.repo.findOne({ where: { tenantId, id } });`,
    },
    {
      code: `this.userRepository.update({ tenantId, id }, { isActive: false });`,
    },
    // tenantId in nested object
    {
      code: `this.repo.findAndCount({ where: { tenantId, status: 'active' }, order: { id: 'DESC' } });`,
    },
    // tenant_id snake_case alias
    {
      code: `this.repo.find({ where: { tenant_id: id } });`,
    },
    // tenantId in template literal (querybuilder fallback)
    {
      code: `qb.where('tenantId = :tenantId', { tenantId });`,
    },
    // Receiver name doesn't match repo pattern → rule does not fire
    {
      code: `this.cache.find('key');`,
    },
    {
      code: `array.find(x => x === 1);`,
    },
    // Method name doesn't match → no fire
    {
      code: `this.repo.create({ name: 'x' });`,
    },
    {
      code: `this.repo.save(entity);`,
    },
    // Enclosing function mentions tenantId → allowed via heuristic
    {
      code: `
        function loadAll(tenantId) {
          const where = { tenantId };
          return this.repo.find({ where });
        }
      `,
    },
    // File excluded by filename
    {
      code: `this.repo.find({ where: { id: 1 } });`,
      filename: 'src/something/foo.spec.ts',
    },
    {
      code: `this.repo.find({ where: { id: 1 } });`,
      filename: 'src/seed/seed.ts',
    },
    {
      code: `this.repo.find({ where: { id: 1 } });`,
      filename: 'src/migrations/0001-init.ts',
    },
  ],
  invalid: [
    {
      code: `this.repo.find({ where: { id: 'x' } });`,
      errors: [{ messageId: 'missingTenantId' }],
    },
    {
      code: `this.userRepository.findOne({ where: { email: 'x@y.it' } });`,
      errors: [{ messageId: 'missingTenantId' }],
    },
    {
      code: `this.salesOrderRepo.findAndCount({ where: { status: 'open' } });`,
      errors: [{ messageId: 'missingTenantId' }],
    },
    {
      code: `this.invoiceRepository.delete({ id: 'abc' });`,
      errors: [{ messageId: 'missingTenantId' }],
    },
    {
      code: `repo.update({ id: 1 }, { x: 2 });`,
      errors: [{ messageId: 'missingTenantId' }],
    },
  ],
});

// RuleTester throws on failure; if we reach here the suite passed.
// eslint-disable-next-line no-console
console.log('no-untenanted-query: all rule-tester cases pass.');
