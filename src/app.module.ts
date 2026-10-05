import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
