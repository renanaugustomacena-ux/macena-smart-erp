import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';

@Injectable()
export class MultiCompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async list(tenantId: string): Promise<Company[]> {
    return this.companyRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.isActive = true')
      .orderBy('c.code', 'ASC')
      .getMany();
  }

  async create(
    tenantId: string,
    dto: {
      code: string;
      name: string;
      vatNumber?: string;
      fiscalCode?: string;
      sdiDestinationCode?: string;
      pecEmail?: string;
      address?: Record<string, unknown>;
    },
  ): Promise<Company> {
    const dup = await this.companyRepo.findOne({
      where: { tenantId, code: dto.code },
    });
    if (dup) throw new ConflictException(`Company ${dto.code} already exists`);
    const entity = this.companyRepo.create({
      tenantId,
      code: dto.code,
      name: dto.name,
      vatNumber: dto.vatNumber ?? null,
      fiscalCode: dto.fiscalCode ?? null,
      sdiDestinationCode: dto.sdiDestinationCode ?? null,
      pecEmail: dto.pecEmail ?? null,
      address: dto.address ?? {},
      isPrimary: false,
      isActive: true,
    });
    return this.companyRepo.save(entity);
  }

  async setPrimary(tenantId: string, id: string): Promise<Company> {
    const target = await this.companyRepo.findOne({
      where: { tenantId, id },
    });
    if (!target) throw new NotFoundException(`Company ${id} not found`);
    if (!target.isActive)
      throw new BadRequestException('Cannot mark an inactive company as primary');
    const all = await this.list(tenantId);
    for (const c of all) {
      const wasPrimary = c.isPrimary;
      c.isPrimary = c.id === id;
      if (wasPrimary !== c.isPrimary) await this.companyRepo.save(c);
    }
    return target;
  }
}
