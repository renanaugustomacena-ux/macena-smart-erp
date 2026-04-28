import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SsoService } from './sso.service';
import { SsoConfig } from './entities/sso-config.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';

interface QbStub<T> {
  where: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  getMany: () => Promise<T[]>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    orderBy: () => stub,
    getMany: async () => rows,
  };
  return stub;
}

async function build(initial: SsoConfig[] = []) {
  const data = [...initial];
  const repo = {
    findOne: async ({ where }: { where: Partial<SsoConfig> }) =>
      data.find((r) =>
        Object.entries(where ?? {}).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    save: async (r: SsoConfig) => {
      const i = data.findIndex((x) => x.id === r.id);
      if (i >= 0) data[i] = r;
      else {
        if (!r.id) r.id = `sso-${data.length + 1}`;
        data.push(r);
      }
      return r;
    },
    create: (partial: Partial<SsoConfig>) =>
      ({
        defaultRole: 'viewer',
        ...partial,
      }) as SsoConfig,
    createQueryBuilder: () => qb(data),
  };
  const module = await Test.createTestingModule({
    providers: [
      SsoService,
      { provide: getRepositoryToken(SsoConfig), useValue: repo },
    ],
  }).compile();
  return { svc: module.get(SsoService), data };
}

describe('SsoService (Sprint 22)', () => {
  it('upsert + activate flips status', async () => {
    const { svc } = await build();
    const created = await svc.upsert(TENANT, 'saml2', {
      idpEntityId: 'urn:idp:example',
      idpSsoUrl: 'https://idp.example/saml',
    });
    expect(created.status).toBe('pending');
    const activated = await svc.activate(TENANT, 'saml2');
    expect(activated.status).toBe('active');
  });

  it('SCIM token rotate + verify (constant-time hash compare)', async () => {
    const { svc } = await build();
    await svc.upsert(TENANT, 'scim2', {});
    const { token } = await svc.rotateScimToken(TENANT);
    expect(token.length).toBeGreaterThan(20);
    expect(await svc.verifyScimToken(TENANT, token)).toBe(true);
    expect(await svc.verifyScimToken(TENANT, 'wrong')).toBe(false);
  });

  it('setBreakGlass auto-creates a SAML placeholder when no config exists', async () => {
    const { svc } = await build();
    const cfg = await svc.setBreakGlass(TENANT, 'admin@example.com');
    expect(cfg.breakGlassEmail).toBe('admin@example.com');
    expect(cfg.breakGlassRotatedAt).toBeInstanceOf(Date);
    expect(cfg.protocol).toBe('saml2');
  });
});
