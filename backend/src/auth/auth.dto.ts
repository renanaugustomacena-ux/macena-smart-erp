import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'mario.rossi@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Mario' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Rossi' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({ example: 'mario.rossi@example.com' })
  @IsEmail()
  email!: string;

  /**
   * Minimum 10 chars, at least one letter and one digit — aligned with the
   * OWASP ASVS V2.1 baseline for interactive accounts. Upper bound 128
   * prevents algorithm-of-death attacks with huge passwords.
   */
  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one digit',
  })
  password!: string;

  @ApiProperty({ example: 'Fonderia Mozzecane SRL' })
  @IsString()
  @Length(1, 255)
  companyName!: string;

  @ApiProperty({ example: '+39 045 123 4567', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({
    example: '02345678901',
    description: 'Italian Partita IVA, 11 numeric digits',
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'partitaIva must be 11 numeric digits' })
  partitaIva?: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token issued by /api/auth/login',
  })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
