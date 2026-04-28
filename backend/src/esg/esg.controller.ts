import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { EsgInputs, EsgService } from './esg.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('ESG')
@ApiBearerAuth('JWT-auth')
@Controller('esg')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class EsgController {
  constructor(private readonly svc: EsgService) {}

  @Post('compute')
  @ApiOperation({ summary: 'Compute Scope 1+2 emissions for a reporting year.' })
  compute(
    @Req() req: RequestWithUser,
    @Body() body: { reportingYear: number; inputs: EsgInputs },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = req;
    return this.svc.computeReport(
      req.user.tenantId,
      'tenant',
      body.reportingYear,
      body.inputs,
    );
  }

  @Post('export')
  @ApiOperation({ summary: 'Export the ESG report as a PDF (S45).' })
  @Header('Content-Type', 'application/pdf')
  @HttpCode(200)
  async export(
    @Req() req: RequestWithUser,
    @Body() body: { reportingYear: number; inputs: EsgInputs },
    @Res() res: Response,
  ) {
    const out = await this.svc.generateReportPdf(
      req.user.tenantId,
      body.reportingYear,
      body.inputs,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.body);
  }
}
