import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/**
 * Login DTO.
 *
 * `email` is normalized (trim + lowercase) so a user can log in
 * regardless of the casing/whitespace they typed, matching the
 * normalization applied at register time.
 *
 * `password` is intentionally NOT validated for composition. Login
 * validates against the stored hash, which encodes whatever rules
 * were applied at registration. Adding complexity rules here would
 * break existing accounts.
 */
export class LoginUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @MinLength(8)
  @MaxLength(64)
  @IsNotEmpty()
  password!: string;
}
