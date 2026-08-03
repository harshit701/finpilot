import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({
    description: 'Short-lived access token (JWT). Use as Bearer for authenticated requests.',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'Long-lived refresh token (JWT). Rotate via POST /auth/refresh. The presented refresh token is invalidated on use.',
  })
  refreshToken!: string;
}
