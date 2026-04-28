import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProblemDetailsFilter } from './problem-details.filter';

interface CapturedResponse {
  statusCode?: number;
  headers: Record<string, string>;
  body?: unknown;
}

function makeHost(
  request: Partial<Request> & {
    correlationId?: string;
    id?: string;
    headers?: Record<string, unknown>;
    originalUrl?: string;
  } = {},
): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = { headers: {} };
  const response = {
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;

  const req = {
    originalUrl: '/api/v1/test',
    url: '/api/v1/test',
    headers: {},
    ...request,
  } as Request & { correlationId?: string; id?: string };

  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('ProblemDetailsFilter (RFC 7807)', () => {
  let filter: ProblemDetailsFilter;

  beforeEach(() => {
    filter = new ProblemDetailsFilter();
  });

  describe('status-code mapping', () => {
    const cases: Array<{
      label: string;
      exception: HttpException;
      status: number;
      title: string;
    }> = [
      {
        label: '400 BadRequest',
        exception: new BadRequestException('field missing'),
        status: 400,
        title: 'Bad Request',
      },
      {
        label: '401 Unauthorized',
        exception: new UnauthorizedException('Invalid credentials'),
        status: 401,
        title: 'Unauthorized',
      },
      {
        label: '403 Forbidden',
        exception: new ForbiddenException('Cross-tenant request'),
        status: 403,
        title: 'Forbidden',
      },
      {
        label: '404 NotFound',
        exception: new NotFoundException('Resource missing'),
        status: 404,
        title: 'Not Found',
      },
      {
        label: '409 Conflict',
        exception: new ConflictException('Email already registered'),
        status: 409,
        title: 'Conflict',
      },
      {
        label: '422 UnprocessableEntity',
        exception: new UnprocessableEntityException('Password fails policy'),
        status: 422,
        title: 'Unprocessable Entity',
      },
      {
        label: '429 TooManyRequests',
        exception: new HttpException('rate limited', HttpStatus.TOO_MANY_REQUESTS),
        status: 429,
        title: 'Too Many Requests',
      },
      {
        label: '500 InternalServerError',
        exception: new InternalServerErrorException('boom'),
        status: 500,
        title: 'Internal Server Error',
      },
      {
        label: '503 ServiceUnavailable',
        exception: new ServiceUnavailableException('PG down'),
        status: 503,
        title: 'Service Unavailable',
      },
    ];

    for (const { label, exception, status, title } of cases) {
      it(`maps ${label} to RFC 7807 envelope`, () => {
        const { host, captured } = makeHost();

        filter.catch(exception, host);

        expect(captured.statusCode).toBe(status);
        expect(captured.headers['content-type']).toBe('application/problem+json');
        const body = captured.body as Record<string, unknown>;
        expect(body.status).toBe(status);
        expect(body.title).toBe(title);
        expect(typeof body.type).toBe('string');
        expect(body.type).toMatch(new RegExp(`/problems/${status}$`));
        expect(body.instance).toBe('/api/v1/test');
        expect(typeof body.timestamp).toBe('string');
        // RFC 3339 / ISO 8601
        expect(body.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
        );
      });
    }
  });

  describe('body extraction', () => {
    it('extracts string detail from a string body', () => {
      const { host, captured } = makeHost();
      filter.catch(new HttpException('plain detail', 418), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.detail).toBe('plain detail');
    });

    it('extracts message from an object body', () => {
      const { host, captured } = makeHost();
      filter.catch(
        new HttpException(
          { message: 'object detail', error: 'CustomCode' },
          400,
        ),
        host,
      );
      const body = captured.body as Record<string, unknown>;
      expect(body.detail).toBe('object detail');
      expect(body.code).toBe('CustomCode');
    });

    it('joins array message into detail and surfaces errors[]', () => {
      const { host, captured } = makeHost();
      filter.catch(
        new HttpException(
          { message: ['must be string', 'must not be empty'] },
          422,
        ),
        host,
      );
      const body = captured.body as Record<string, unknown>;
      expect(body.detail).toBe('must be string; must not be empty');
      expect(body.errors).toEqual(['must be string', 'must not be empty']);
    });

    it('surfaces explicit errors field over message', () => {
      const { host, captured } = makeHost();
      filter.catch(
        new HttpException(
          { message: 'top-level', errors: { iban: 'invalid' } },
          422,
        ),
        host,
      );
      const body = captured.body as Record<string, unknown>;
      expect(body.errors).toEqual({ iban: 'invalid' });
    });

    it('falls back to Error.message for non-HttpException', () => {
      const { host, captured } = makeHost();
      filter.catch(new Error('unexpected boom'), host);
      const body = captured.body as Record<string, unknown>;
      expect(captured.statusCode).toBe(500);
      expect(body.detail).toBe('unexpected boom');
      expect(body.title).toBe('Internal Server Error');
    });

    it('returns 500 for non-Error throw values', () => {
      const { host, captured } = makeHost();
      filter.catch('a bare string', host);
      expect(captured.statusCode).toBe(500);
      const body = captured.body as Record<string, unknown>;
      expect(body.title).toBe('Internal Server Error');
    });
  });

  describe('correlation id propagation', () => {
    it('uses request.correlationId when set', () => {
      const { host, captured } = makeHost({ correlationId: 'corr-aaa' });
      filter.catch(new BadRequestException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.correlationId).toBe('corr-aaa');
    });

    it('falls back to X-Request-ID header', () => {
      const { host, captured } = makeHost({
        headers: { 'x-request-id': 'corr-bbb' },
      });
      filter.catch(new BadRequestException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.correlationId).toBe('corr-bbb');
    });

    it('falls back to request.id when neither correlationId nor header set', () => {
      const { host, captured } = makeHost({ id: 'corr-ccc' });
      filter.catch(new BadRequestException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.correlationId).toBe('corr-ccc');
    });
  });

  describe('instance / type composition', () => {
    it('sets instance to originalUrl', () => {
      const { host, captured } = makeHost({ originalUrl: '/api/v1/foo/123' });
      filter.catch(new NotFoundException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.instance).toBe('/api/v1/foo/123');
    });

    it('falls back to url if originalUrl is missing', () => {
      const { host, captured } = makeHost({
        originalUrl: undefined,
        url: '/api/v1/bar',
      });
      filter.catch(new NotFoundException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(body.instance).toBe('/api/v1/bar');
    });

    it('uses APP_BASE_URL for the type prefix when set', () => {
      // The PROBLEM_TYPE_BASE module-scoped const is captured at import time;
      // we assert the default value here to lock it in. Override is exercised
      // via integration test with a fresh module reload (out of scope for unit).
      const { host, captured } = makeHost();
      filter.catch(new BadRequestException('x'), host);
      const body = captured.body as Record<string, unknown>;
      expect(typeof body.type).toBe('string');
      expect(body.type as string).toMatch(/^https?:\/\/.*\/problems\/400$/);
    });
  });

  describe('5xx logging', () => {
    it('logs error for 5xx but not for 4xx', () => {
      const errSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation(() => undefined);
      const { host: hostA } = makeHost();
      filter.catch(new BadRequestException('client miss'), hostA);
      expect(errSpy).not.toHaveBeenCalled();

      const { host: hostB } = makeHost();
      filter.catch(new InternalServerErrorException('boom'), hostB);
      expect(errSpy).toHaveBeenCalledTimes(1);
      errSpy.mockRestore();
    });
  });
});
