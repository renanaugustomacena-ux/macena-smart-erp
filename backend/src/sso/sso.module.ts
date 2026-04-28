import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsoConfig } from './entities/sso-config.entity';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { ScimController } from './scim.controller';
import { SamlStrategy } from './saml.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([SsoConfig])],
  controllers: [SsoController, ScimController],
  providers: [SsoService, SamlStrategy],
  exports: [SsoService, SamlStrategy],
})
export class SsoModule {}
