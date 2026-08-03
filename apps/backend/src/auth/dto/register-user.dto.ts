import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(64)
  @IsNotEmpty()
  @Matches(/[A-Z]/, {
    message: 'password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, { message: 'password must contain at least one digit' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'password must contain at least one special character',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message:
      'firstName may only contain letters, spaces, apostrophes, and hyphens',
  })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message:
      'lastName may only contain letters, spaces, apostrophes, and hyphens',
  })
  lastName?: string;
}
