export interface JwtPayload {
  sub: string;
  sid: string;
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  family_id: string;
  jti: string;
  iat?: number;
  exp?: number;
}
