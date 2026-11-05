import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  findByItem(email: string) {
    return this.prisma.admin.findUnique({
      where: { email },
    });
  }

  findById(id: string) {
    return this.prisma.admin.findUnique({ where: { id } });
  }
}
