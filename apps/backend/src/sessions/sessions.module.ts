import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsService } from './sessions.service';

@Module({
  // JwtModule is registered secret-less here: SessionsService only ever
  // calls JwtService.decode() to read the exp claim off an already-verified
  // token, never sign()/verify(), so no secret is needed in this module.
  imports: [PrismaModule, JwtModule.register({})],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
