import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from '../admin/admin.service.js';
import { LoginDto } from './dto/login.dto.js';

import { Admin } from '../../generated/prisma/client.js';
import argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private jwtService: JwtService,
  ) {}

  async signIn({ identifier, password }: LoginDto): Promise<{ accessToken: string }> {
    const admin = await this.adminService.findByItem(identifier);

    const valid = admin ? await argon2.verify(admin.passwordHash, password) : false;

    if (!admin || !valid) {
      throw new UnauthorizedException('Не валидные даные входа');
    }
    return this.issueToken(admin);
  }

  private async issueToken(admin: Admin): Promise<{ accessToken: string }> {
    const payload = { sub: admin.id, role: admin.role, branchId: admin.branchId };

    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
