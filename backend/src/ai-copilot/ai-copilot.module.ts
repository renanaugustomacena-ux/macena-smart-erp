import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnthropicClient } from './anthropic.client';
import { ToolRegistry } from './tool-registry.service';
import { CopilotService } from './copilot.service';
import { CopilotEvalHarness } from './eval.harness';
import { CopilotController } from './copilot.controller';
import { CopilotCostCounter } from './entities/copilot-cost-counter.entity';
import { SARA_TOOL_PROVIDERS } from './tools/sara-tools';
import { PRODUCTION_TOOL_PROVIDERS } from './tools/production-tools';
import { Tenant } from '../tenants/tenant.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { Customer } from '../sales/sales.entity';
import { IntrastatDeclaration } from '../intrastat/entities/intrastat-declaration.entity';
import { ReadModelRow } from '../bi/entities/read-model-row.entity';
import { Ddt } from '../sales/entities/ddt.entity';
import { Product } from '../inventory/inventory.entity';
import { RagChunk } from './rag/entities/rag-chunk.entity';
import { RagService } from './rag/rag.service';
import { RagController } from './rag/rag.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CopilotCostCounter,
      Tenant,
      Invoice,
      SupplierInvoice,
      Customer,
      IntrastatDeclaration,
      ReadModelRow,
      Product,
      RagChunk,
      Ddt,
    ]),
  ],
  controllers: [CopilotController, RagController],
  providers: [
    AnthropicClient,
    ...SARA_TOOL_PROVIDERS,
    ...PRODUCTION_TOOL_PROVIDERS,
    {
      provide: ToolRegistry,
      inject: [...SARA_TOOL_PROVIDERS, ...PRODUCTION_TOOL_PROVIDERS],
      useFactory: (...tools: unknown[]) => new ToolRegistry(tools as never),
    },
    CopilotService,
    CopilotEvalHarness,
    RagService,
  ],
  exports: [CopilotService, ToolRegistry, CopilotEvalHarness, RagService],
})
export class AiCopilotModule {}
