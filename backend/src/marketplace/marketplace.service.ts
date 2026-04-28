import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MarketplaceInstallation,
  MarketplacePackage,
} from './entities/marketplace-package.entity';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplacePackage)
    private readonly pkgRepo: Repository<MarketplacePackage>,
    @InjectRepository(MarketplaceInstallation)
    private readonly instRepo: Repository<MarketplaceInstallation>,
  ) {}

  async listPackages(): Promise<MarketplacePackage[]> {
    // eslint-disable-next-line no-untenanted-query
    return this.pkgRepo.find({
      where: { status: 'active' },
      order: { displayName: 'ASC' },
    });
  }

  async install(
    tenantId: string,
    packageId: string,
    config: Record<string, unknown> = {},
  ): Promise<MarketplaceInstallation> {
    // eslint-disable-next-line no-untenanted-query
    const pkg = await this.pkgRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException(`Package ${packageId} not found`);
    const dup = await this.instRepo.findOne({
      where: { tenantId, packageId },
    });
    if (dup) throw new ConflictException('Package already installed');
    const inst = this.instRepo.create({
      tenantId,
      packageId,
      status: 'active',
      config,
      installedAt: new Date(),
    });
    return this.instRepo.save(inst);
  }

  async listInstallations(tenantId: string): Promise<MarketplaceInstallation[]> {
    return this.instRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere('i.status = :st', { st: 'active' })
      .orderBy('i.installedAt', 'DESC')
      .getMany();
  }

  async cancel(tenantId: string, id: string): Promise<MarketplaceInstallation> {
    const inst = await this.instRepo.findOne({ where: { tenantId, id } });
    if (!inst) throw new NotFoundException(`Installation ${id} not found`);
    inst.status = 'cancelled';
    inst.cancelledAt = new Date();
    return this.instRepo.save(inst);
  }
}
