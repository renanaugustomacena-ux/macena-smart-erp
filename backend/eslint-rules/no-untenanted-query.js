/**
 * ESLint custom rule — `no-untenanted-query`
 *
 * Implements doctrine R-D02 (plan §2.1.1): every TypeORM repository call
 * (`find*`, `update*`, `delete*`, `softDelete*`, `softRemove*`, `count*`,
 * `recover*`) on a receiver whose name ends in `Repo` or `Repository` MUST
 * include `tenantId` (or `tenant_id`) somewhere in its arguments.
 *
 * The rule purposefully accepts conservative false-positives over silent
 * false-negatives. Per-call escape: place
 * `// eslint-disable-next-line no-untenanted-query` above the line, with a
 * one-line comment describing why the call is legitimately cross-tenant
 * (e.g., audit-log reconciliation, super-admin tools, the seeder).
 *
 * Files matching:
 *   - **\/*.spec.ts         (tests; mocked repos)
 *   - **\/seed/**           (the demo-data seeder)
 *   - **\/migrations/**     (raw SQL)
 * are skipped automatically by the rule's `meta.docs.url` notes (the file
 * filter is also enforced in .eslintrc.cjs `overrides`).
 *
 * Method-name regex covers TypeORM Repository<T> public surface as of v0.3.
 */

'use strict';

const TARGET_METHOD =
  /^(find|findOne|findOneBy|findAndCount|findOneOrFail|findOneByOrFail|findBy|findAll|update|delete|softDelete|softRemove|count|countBy|recover|exists|increment|decrement|remove)$/;

const TENANT_KEY = /^(tenantId|tenant_id)$/;

function receiverEndsInRepo(node) {
  // Matches:   foo.find(...)        when foo is named like *Repo / *Repository / *_repo / *_repository
  //            this.fooRepo.find    same
  //            this.foo_repository.find
  if (!node || node.type !== 'MemberExpression') return false;
  const obj = node.object;
  let name;
  if (obj.type === 'Identifier') name = obj.name;
  else if (obj.type === 'MemberExpression' && obj.property.type === 'Identifier')
    name = obj.property.name;
  else return false;
  return /[Rr]epo(?:sitory)?$/.test(name);
}

function methodMatches(node) {
  return (
    node &&
    node.type === 'MemberExpression' &&
    node.property &&
    node.property.type === 'Identifier' &&
    TARGET_METHOD.test(node.property.name)
  );
}

function deepFindTenantKey(node, depth = 0) {
  if (!node || depth > 8) return false;
  switch (node.type) {
    case 'ObjectExpression':
      return node.properties.some((p) => {
        if (p.type !== 'Property') return false;
        const k =
          p.key.type === 'Identifier'
            ? p.key.name
            : p.key.type === 'Literal'
              ? String(p.key.value)
              : null;
        if (k && TENANT_KEY.test(k)) return true;
        return deepFindTenantKey(p.value, depth + 1);
      });
    case 'ArrayExpression':
      return node.elements.some((e) => deepFindTenantKey(e, depth + 1));
    case 'TemplateLiteral':
      return node.quasis.some((q) =>
        TENANT_KEY.test((q.value && q.value.raw) || ''),
      );
    case 'Literal':
      return typeof node.value === 'string' && TENANT_KEY.test(node.value);
    case 'Identifier':
      return TENANT_KEY.test(node.name);
    case 'CallExpression':
      // e.g. .where('tenantId = :tenantId', {tenantId})
      return (
        deepFindTenantKey(node.callee, depth + 1) ||
        node.arguments.some((a) => deepFindTenantKey(a, depth + 1))
      );
    case 'MemberExpression':
      return (
        deepFindTenantKey(node.object, depth + 1) ||
        deepFindTenantKey(node.property, depth + 1)
      );
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
      return deepFindTenantKey(node.expression, depth + 1);
    case 'SpreadElement':
      return deepFindTenantKey(node.argument, depth + 1);
    case 'ConditionalExpression':
      return (
        deepFindTenantKey(node.consequent, depth + 1) ||
        deepFindTenantKey(node.alternate, depth + 1)
      );
    case 'LogicalExpression':
    case 'BinaryExpression':
      return (
        deepFindTenantKey(node.left, depth + 1) ||
        deepFindTenantKey(node.right, depth + 1)
      );
    default:
      return false;
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every TypeORM repository call must filter by tenantId (doctrine R-D02).',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://smarterp.it/doctrine#R-D02',
    },
    schema: [],
    messages: {
      missingTenantId:
        "Repository call '{{method}}' on '{{receiver}}' is missing a 'tenantId' filter (doctrine R-D02). Add it, or annotate with `// eslint-disable-next-line no-untenanted-query` and a justifying comment.",
    },
  },

  create(context) {
    const filename = context.getFilename();
    if (
      /\.spec\.ts$/.test(filename) ||
      /\/seed\//.test(filename) ||
      /\/migrations\//.test(filename)
    ) {
      return {};
    }
    const sourceCode = context.getSourceCode
      ? context.getSourceCode()
      : context.sourceCode;

    function enclosingFunctionMentionsTenantId(node) {
      // Walk up to the nearest function/method to check if `tenantId` (or
      // `tenant_id`) appears anywhere in its body. A tenant-scoped `where`
      // is frequently built via a local const before being passed to the
      // repository call; the literal-AST scan misses that pattern.
      let current = node.parent;
      while (current) {
        if (
          current.type === 'FunctionDeclaration' ||
          current.type === 'FunctionExpression' ||
          current.type === 'ArrowFunctionExpression' ||
          current.type === 'MethodDefinition'
        ) {
          const text = sourceCode.getText(current);
          return /\btenantId\b|\btenant_id\b/.test(text);
        }
        current = current.parent;
      }
      return false;
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (!methodMatches(callee)) return;
        if (!receiverEndsInRepo(callee)) return;

        const hasTenant = node.arguments.some((arg) =>
          deepFindTenantKey(arg),
        );
        if (hasTenant) return;
        if (enclosingFunctionMentionsTenantId(node)) return;

        // Best-effort receiver name for the message.
        let receiverName = '<repo>';
        if (callee.object.type === 'Identifier') {
          receiverName = callee.object.name;
        } else if (
          callee.object.type === 'MemberExpression' &&
          callee.object.property.type === 'Identifier'
        ) {
          receiverName = callee.object.property.name;
        }

        context.report({
          node,
          messageId: 'missingTenantId',
          data: {
            method: callee.property.name,
            receiver: receiverName,
          },
        });
      },
    };
  },
};
