import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Payroll-adjacent controller — explicit stub.
 *
 * Closes gap H-08. v2.0 §20.8 states "INPS / INAIL: payroll-adjacent
 * interfaces exposed for future TeamFlow integration." Per the Mission
 * II.5 rule ("no silent stubs"), every endpoint here answers with a
 * typed HTTP 501 that names the env vars and the owning project.
 */
@ApiTags('Payroll-adjacent')
@Controller('v1/payroll-adjacent')
export class PayrollAdjacentController {
  @Get('employees')
  @ApiOperation({ summary: 'List employees (stub — TeamFlow integration pending)' })
  @ApiResponse({
    status: 501,
    description:
      'Endpoint reserved for TeamFlow integration. Configure TEAMFLOW_API_URL + TEAMFLOW_API_KEY.',
  })
  listEmployees(): never {
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message:
          'Payroll-adjacent endpoints require the TeamFlow integration to be wired. ' +
          'Set TEAMFLOW_API_URL and TEAMFLOW_API_KEY environment variables, then ' +
          'enable the live branch per docs/INTEGRATIONS.md#teamflow.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Post('compute-monthly')
  @ApiOperation({
    summary: 'Trigger monthly payroll batch (stub — enqueues then 501s)',
  })
  computeMonthly(@Body() _body: unknown): never {
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message:
          'Payroll batch computation is a BullMQ stub until TeamFlow ships. ' +
          'Use the backend worker image with TEAMFLOW_API_URL / TEAMFLOW_API_KEY set ' +
          'and a real PayrollBatchProcessor implementation.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Get('inps-export')
  @ApiOperation({ summary: 'INPS Uniemens export stub (501)' })
  inpsExport(): never {
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message:
          'INPS Uniemens export is not yet available. Scheduled with TeamFlow Q3 2026.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Get('inail-ot23')
  @ApiOperation({ summary: 'INAIL OT23 export stub (501)' })
  inailOt23(): never {
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message:
          'INAIL OT23 export is not yet available. Scheduled with TeamFlow Q3 2026.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
