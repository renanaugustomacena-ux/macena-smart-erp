import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

import {
  hashPassword,
  verifyPassword,
  isLegacyBcryptHash,
} from '../common/password.util';
import {
  checkPasswordBreach,
  validatePasswordPolicy,
} from '../common/password-policy';

/**
 * Account-lockout policy (gap G-05, NIST SP 800-63B §5.2.2):
 *  - 5 failed attempts within the lockout window triggers a 15-minute lock.
 *  - On successful auth the counter resets.
 *
 * Session-ceiling policy (gap G-07, v2.0 §20.9 "Session timeout 15min idle
 * / 12h absolute"):
 *  - Access token TTL 15 min — enforced by JWT exp.
 *  - Refresh reject if `Date.now() - sessionCreatedAt > 12 h` — enforced
 *    in refreshToken().
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ length: 255 })
  companyName: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 11, nullable: true })
  partitaIva: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ADMIN })
  role: UserRole;

  @Column({ nullable: true })
  tenantId: string;

  /**
   * SHA-256 hash of the currently-valid refresh token. Stored rather than the
   * raw token so that a DB compromise does not hand the attacker a working
   * token. SHA-256 (instead of argon2) is sufficient here because the
   * refresh token itself is a 256-bit cryptographically-random opaque value
   * with high entropy; we store it hashed mainly to defend against DB dumps.
   */
  @Column({ nullable: true })
  refreshTokenHash: string | null;

  /**
   * Monotonically-increasing counter. Bumped on every successful refresh.
   * Included in the refresh JWT as `tv` (token version). A replay of a
   * previously-rotated refresh token carries an older `tv` and is rejected
   * with 401 — this is the mechanism for "second use of an already-used
   * refresh token rejects with 401" per plan §5.1.
   */
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  /** Counter for account lockout after N failed auth attempts. */
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  /** Timestamp until which further login attempts are rejected with 423. */
  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  /**
   * Absolute session start. Set at login, consulted at refresh to
   * enforce the v2.0 §20.9 12-h session ceiling even if the refresh
   * token itself has a longer TTL.
   */
  @Column({ type: 'timestamp', nullable: true })
  sessionCreatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

interface RefreshTokenPayload extends AccessTokenPayload {
  tv: number; // token version
  jti: string; // JWT id
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // ─── Login ─────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    ipAddress?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: Partial<User>;
  }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalised, isActive: true },
    });

    if (!user) {
      // Constant-time response: still run a dummy hash verification to
      // blunt user-enumeration timing side-channels.
      await verifyPassword(password, '$argon2id$v=19$m=19456,t=2,p=1$abc$def');
      this.logger.warn({
        event: 'auth.login',
        outcome: 'failure',
        email: normalised,
        ip: ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Lockout check (gap G-05).
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      this.logger.warn({
        event: 'auth.login',
        outcome: 'locked',
        userId: user.id,
        ip: ipAddress,
        minutesRemaining: minutes,
      });
      throw new HttpException(
        `Account locked for ${minutes} more minute(s) after repeated failed attempts`,
        423, // RFC 4918 §11.3 — Locked. Not in @nestjs/common's HttpStatus enum.
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        this.logger.warn({
          event: 'auth.login',
          outcome: 'locked_on_attempt',
          userId: user.id,
          ip: ipAddress,
        });
      }
      await this.userRepository.save(user);
      this.logger.warn({
        event: 'auth.login',
        outcome: 'failure',
        userId: user.id,
        ip: ipAddress,
        attempts: user.failedLoginAttempts,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Transparent migration: if the stored hash is legacy bcrypt and the
    // password verified, re-hash with argon2id on the fly.
    if (isLegacyBcryptHash(user.passwordHash)) {
      user.passwordHash = await hashPassword(password);
    }

    const tokens = await this.issueTokens(user);
    user.refreshTokenHash = this.hashForStorage(tokens.refreshToken);
    user.lastLoginAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.sessionCreatedAt = new Date();
    await this.userRepository.save(user);

    await this.cacheManager.set(
      `session:${user.id}`,
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      3600,
    );

    this.logger.log({ event: 'auth.login', outcome: 'success', userId: user.id });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.publicUser(user),
    };
  }

  // ─── Registration ──────────────────────────────────────────────

  async register(registerDto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    companyName: string;
    phone?: string;
    partitaIva?: string;
    tenantId?: string;
  }): Promise<{ message: string; user: Partial<User> }> {
    const normalised = registerDto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({
      where: { email: normalised },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Structural password policy (NIST SP 800-63B).
    const policy = validatePasswordPolicy(registerDto.password);
    if (!policy.valid) {
      throw new UnprocessableEntityException({
        message: 'Password fails policy',
        errors: policy.reasons,
      });
    }
    // Breach check (advisory — network failure => allowed through).
    const breach = await checkPasswordBreach(registerDto.password);
    if (breach.breached) {
      throw new UnprocessableEntityException({
        message:
          'Password was found in a known data breach. Please choose a different password.',
        errors: [`seen ${breach.count} times in public breach corpora`],
      });
    }

    const passwordHash = await hashPassword(registerDto.password);
    const tenantId = registerDto.tenantId ?? uuidv4();

    const user = this.userRepository.create({
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      email: normalised,
      passwordHash,
      companyName: registerDto.companyName,
      phone: registerDto.phone,
      partitaIva: registerDto.partitaIva,
      role: UserRole.ADMIN,
      tenantId,
      tokenVersion: 0,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    this.logger.log({
      event: 'auth.register',
      outcome: 'success',
      userId: savedUser.id,
      tenantId,
    });

    return {
      message: 'Registration successful',
      user: this.publicUser(savedUser),
    };
  }

  // ─── Refresh (with rotation + replay detection) ────────────────

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        issuer: 'smarterp',
        audience: 'smarterp-client',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 12-h absolute session ceiling (gap G-07).
    if (
      user.sessionCreatedAt &&
      Date.now() - user.sessionCreatedAt.getTime() > SESSION_ABSOLUTE_MS
    ) {
      await this.userRepository.update(user.id, {
        refreshTokenHash: null,
        tokenVersion: user.tokenVersion + 1,
        sessionCreatedAt: null,
      });
      this.logger.warn({
        event: 'auth.refresh',
        outcome: 'session_absolute_exceeded',
        userId: user.id,
      });
      throw new ForbiddenException(
        'Session exceeded 12-hour absolute ceiling. Please sign in again.',
      );
    }

    // Replay detection: the token's `tv` must match the user's current
    // tokenVersion. If the user already rotated (tv incremented), the old
    // token is rejected.
    if (payload.tv !== user.tokenVersion) {
      this.logger.warn({
        event: 'auth.refresh',
        outcome: 'replay_detected',
        userId: user.id,
      });
      // Security best practice — invalidate all refresh tokens for this user
      // on replay detection (suspected theft).
      await this.userRepository.update(user.id, {
        refreshTokenHash: null,
        tokenVersion: user.tokenVersion + 1,
      });
      throw new UnauthorizedException('Refresh token replay detected');
    }

    // Token hash sanity check
    const incomingHash = this.hashForStorage(refreshToken);
    if (incomingHash !== user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    // Rotate
    user.tokenVersion = user.tokenVersion + 1;
    const tokens = await this.issueTokens(user);
    user.refreshTokenHash = this.hashForStorage(tokens.refreshToken);
    await this.userRepository.save(user);

    return tokens;
  }

  // ─── Profile, logout ───────────────────────────────────────────

  async getProfile(userId: string): Promise<Partial<User>> {
    const cached = await this.cacheManager.get<Partial<User>>(
      `profile:${userId}`,
    );
    if (cached) return cached;

    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const profile = this.publicUser(user);
    await this.cacheManager.set(`profile:${userId}`, profile, 300);
    return profile;
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.userRepository.update(userId, {
      refreshTokenHash: null,
      tokenVersion: (await this.bumpVersion(userId)),
    });
    await this.cacheManager.del(`session:${userId}`);
    await this.cacheManager.del(`profile:${userId}`);
    this.logger.log({ event: 'auth.logout', outcome: 'success', userId });
    return { message: 'Logout successful' };
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async bumpVersion(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return (user?.tokenVersion ?? 0) + 1;
  }

  private async issueTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const refreshPayload: RefreshTokenPayload = {
      ...accessPayload,
      tv: user.tokenVersion,
      jti: uuidv4(),
    };

    const accessTtlRaw =
      this.configService.get<string>('JWT_ACCESS_TTL') ??
      this.configService.get<string>('JWT_EXPIRATION') ??
      '15m';
    const refreshTtlRaw =
      this.configService.get<string>('JWT_REFRESH_TTL') ??
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ??
      '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessTtlRaw,
        issuer: 'smarterp',
        audience: 'smarterp-client',
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtlRaw,
        issuer: 'smarterp',
        audience: 'smarterp-client',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTtlSeconds(accessTtlRaw),
    };
  }

  private parseTtlSeconds(ttl: string): number {
    const m = /^(\d+)\s*([smhd])$/.exec(ttl);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86_400;
      default:
        return 900;
    }
  }

  private hashForStorage(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private publicUser(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyName: user.companyName,
      phone: user.phone,
      partitaIva: user.partitaIva,
      tenantId: user.tenantId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
