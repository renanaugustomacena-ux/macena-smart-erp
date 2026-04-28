import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import type {
  MembershipRole,
  MembershipStatus,
} from './membership.entity';

const ROLES: MembershipRole[] = [
  'admin',
  'manager',
  'operator',
  'viewer',
  'commercialista',
];

const STATUSES: MembershipStatus[] = ['pending', 'active', 'revoked'];

export class InviteMembershipDto {
  @IsUUID()
  userId: string;

  @IsIn(ROLES)
  role: MembershipRole;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class SwitchTenantDto {
  @IsUUID()
  tenantId: string;
}

export class ListTenantMembershipsQueryDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: MembershipRole;

  @IsOptional()
  @IsIn(STATUSES)
  status?: MembershipStatus;
}
