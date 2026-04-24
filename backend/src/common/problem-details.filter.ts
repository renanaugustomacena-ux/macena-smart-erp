import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * RFC 7807 "Problem Details for HTTP APIs" exception filter.
 *
 * Closes gap B-06: Nest's default HttpException shape is non-standard;
 * consumers (the frontend, Spectral contract tests, SDK generators) need
 * a predictable `application/problem+json` body. All five RFC 7807 top-
 * level members are emitted: type, title, status, detail, instance.
 *
 * The filter is wired globally in `main.ts` via `useGlobalFilters`.
 */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  // Project-specific extensions
  code?: string;
  correlationId?: string;
  errors?: unknown;
  timestamp: string;
}

const PROBLEM_TYPE_BASE =
  process.env.APP_BASE_URL?.replace(/\/$/, '') ?? 'https://smarterp.it';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { correlationId?: string; id?: string }
    >();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isHttp = exception instanceof HttpException;
    const body = isHttp ? exception.getResponse() : undefined;

    const title = this.resolveTitle(status);
    let detail: string | undefined;
    let errors: unknown | undefined;
    let code: string | undefined;

    if (typeof body === 'string') {
      detail = body;
    } else if (body && typeof body === 'object') {
      const rec = body as Record<string, unknown>;
      detail =
        (typeof rec.message === 'string' ? rec.message : undefined) ??
        (Array.isArray(rec.message) ? rec.message.join('; ') : undefined);
      if (Array.isArray(rec.message) || rec.errors) {
        errors = rec.errors ?? rec.message;
      }
      code = typeof rec.error === 'string' ? rec.error : undefined;
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    const problem: ProblemDetails = {
      type: `${PROBLEM_TYPE_BASE}/problems/${status}`,
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      code,
      correlationId:
        request.correlationId ??
        (request.headers['x-request-id'] as string) ??
        request.id,
      errors,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        {
          event: 'http.error',
          status,
          path: problem.instance,
          correlationId: problem.correlationId,
          detail,
          stack:
            exception instanceof Error ? exception.stack : undefined,
        },
        'Unhandled exception',
      );
    }

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(problem);
  }

  private resolveTitle(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 409:
        return 'Conflict';
      case 422:
        return 'Unprocessable Entity';
      case 429:
        return 'Too Many Requests';
      case 500:
        return 'Internal Server Error';
      case 501:
        return 'Not Implemented';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      default:
        return status >= 500 ? 'Server Error' : 'Client Error';
    }
  }
}
