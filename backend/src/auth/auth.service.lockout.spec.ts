import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthService, User, UserRole } from './auth.service';

// HTTP 423 — Locked. Not exported by @nestjs/common's HttpStatus enum so we
// pin the literal once per RFC 4918 §11.3.
const HTTP_LOCKED = 423;

/**
 * Confirmation tests for Sprint 1 Story S1.5 — per-IP throttle + account
 * lockout backlog (T-06, T-07).
 *
 * The throttle is enforced by the `@Throttle({ auth: { limit: 5, ttl: 60_000 }})`
 * decorator on `auth.controller.ts:35,55` and the `auth` named throttler
 * declared in `app.module.ts`. This spec exercises the lockout-counter logic
 * inside `auth.service.ts` independently of the throttler.
 *
 * Lockout policy (per `auth.service.ts:42-44`): 5 failed attempts within the
 * lockout window triggers a 15-minute lock, returned as HTTP 423. On
 * successful auth the counter resets and `lockedUntil` clears.
 */

interface RepoMockState {
  user: User;
  saved: User[];
}

function makeUser(overrides: Partial<User> = {}): User {
  const base: Partial<User> = {
    id: 'u-1',
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco@example.it',
    passwordHash:
      // argon2id hash for 'correct-horse-battery-staple-42'; not used directly
      // in these tests because verifyPassword is mocked.
      '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVm$ZmFrZWhhc2g',
    companyName: 'Acme',
    role: UserRole.ADMIN,
    tenantId: 't-1',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    sessionCreatedAt: null,
    tokenVersion: 0,
    refreshTokenHash: undefined,
  };
  return { ...(base as unknown as User), ...(overrides as User) };
}

function makeRepoMock(state: RepoMockState) {
  return {
    findOne: jest.fn(async () => state.user),
    save: jest.fn(async (u: User) => {
      state.saved.push({ ...u });
      Object.assign(state.user, u);
      return u;
    }),
    update: jest.fn(),
  };
}

function makeJwtMock() {
  return {
    signAsync: jest.fn(async () => 'fake-token'),
    verify: jest.fn(),
  };
}

function makeConfigMock() {
  return {
    get: jest.fn((key: string) => {
      const env: Record<string, string> = {
        JWT_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
      };
      return env[key];
    }),
  };
}

function makeCacheMock() {
  return {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };
}

// Mock @node-rs/argon2 to avoid a binary dep at unit-test time.
jest.mock('../common/password.util', () => ({
  hashPassword: jest.fn(async () => '$argon2id$v=19$m=19456,t=2,p=1$x$y'),
  verifyPassword: jest.fn(),
  isLegacyBcryptHash: jest.fn(() => false),
}));

// Pull the mocked verifyPassword for per-test control
import { verifyPassword } from '../common/password.util';
const verifyPasswordMock = verifyPassword as jest.MockedFunction<
  typeof verifyPassword
>;

describe('AuthService — lockout policy (S1.5)', () => {
  let state: RepoMockState;
  let repo: ReturnType<typeof makeRepoMock>;
  let svc: AuthService;

  beforeEach(() => {
    state = { user: makeUser(), saved: [] };
    repo = makeRepoMock(state);
    svc = new AuthService(
      // @ts-expect-error — partial mock satisfies the interface used here
      repo,
      makeJwtMock(),
      makeConfigMock(),
      makeCacheMock(),
    );
    verifyPasswordMock.mockReset();
  });

  it('increments failedLoginAttempts on a single bad password', async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      svc.login('marco@example.it', 'wrong-password', '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(state.user.failedLoginAttempts).toBe(1);
    expect(state.user.lockedUntil).toBeNull();
  });

  it('locks the account on the 5th consecutive failure (HTTP 423 next attempt)', async () => {
    verifyPasswordMock.mockResolvedValue(false);

    // 5 bad attempts
    for (let i = 0; i < 5; i++) {
      await expect(
        svc.login('marco@example.it', 'wrong', '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(state.user.failedLoginAttempts).toBe(5);
    expect(state.user.lockedUntil).toBeInstanceOf(Date);
    expect(state.user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // 6th attempt: should be 423 Locked even with right password
    verifyPasswordMock.mockResolvedValue(true);
    await expect(
      svc.login('marco@example.it', 'correct', '127.0.0.1'),
    ).rejects.toMatchObject({
      status: HTTP_LOCKED,
    });
  });

  it('reports remaining lockout minutes in the 423 response', async () => {
    state.user.lockedUntil = new Date(Date.now() + 15 * 60_000);
    state.user.failedLoginAttempts = 5;

    await expect(
      svc.login('marco@example.it', 'whatever', '127.0.0.1'),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/locked for \d+ more minute/i),
    });
  });

  it('resets the counter and clears lockout on a successful login', async () => {
    state.user.failedLoginAttempts = 3;
    state.user.lockedUntil = null;
    verifyPasswordMock.mockResolvedValue(true);

    const result = await svc.login('marco@example.it', 'correct', '127.0.0.1');

    expect(result).toHaveProperty('accessToken');
    expect(state.user.failedLoginAttempts).toBe(0);
    expect(state.user.lockedUntil).toBeNull();
    expect(state.user.lastLoginAt).toBeInstanceOf(Date);
    expect(state.user.sessionCreatedAt).toBeInstanceOf(Date);
  });

  it('runs a dummy verifyPassword on unknown email (timing blunting)', async () => {
    repo.findOne.mockResolvedValueOnce(null as unknown as User);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      svc.login('nobody@example.it', 'whatever', '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The dummy verification was still issued.
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      'whatever',
      expect.stringContaining('$argon2id$'),
    );
  });

  it('the lockedUntil window respects LOCKOUT_MINUTES (~15 minutes)', async () => {
    verifyPasswordMock.mockResolvedValue(false);
    const before = Date.now();

    for (let i = 0; i < 5; i++) {
      await expect(
        svc.login('marco@example.it', 'wrong', '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    const lockedAtLeast = state.user.lockedUntil!.getTime() - before;
    expect(lockedAtLeast).toBeGreaterThanOrEqual(14 * 60_000);
    expect(lockedAtLeast).toBeLessThanOrEqual(16 * 60_000);
  });

  it('throws HttpException with status 423 (LOCKED) when called during the lockout window', async () => {
    state.user.lockedUntil = new Date(Date.now() + 60_000);
    state.user.failedLoginAttempts = 5;

    let caught: unknown;
    try {
      await svc.login('marco@example.it', 'whatever', '127.0.0.1');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(HTTP_LOCKED);
  });
});
