import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validator.js';
import { createHash, randomBytes } from 'crypto';
import ms from 'ms';

export type ClientMeta = { ip?: string; useAgent?: string };
export type IssuedRefreshToken = { token: string; expiresAt: Date };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(adminId: string, meta: ClientMeta): Promise<IssuedRefreshToken> {
    const token = randomBytes(64).toString('hex');
    const ttl = this.config.get('JWT_REFRESH_SECRET', { infer: true });
    const expiresAt = new Date(Date.now() + ms(ttl as ms.StringValue));

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(token),
        adminId,
        expiresAt,
        ip: meta.ip,
        userAgent: meta.useAgent,
      },
    });

    return { token, expiresAt };
  }
}
