import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AdminModule } from '../admin/admin.module.js';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validator.js';

@Module({
  imports: [
    AdminModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }) },
      }),
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
