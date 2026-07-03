import { IsNotEmpty, IsEmail, MaxLength, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @MinLength(8)
  @MaxLength(64)
  @IsNotEmpty()
  password!: string;
}
