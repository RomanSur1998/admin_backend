import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import { AuthenticatedRequest } from '../types/jwt-user.js';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const target = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, target)) return true;

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, target) ?? [
      Role.SUPER_ADMIN,
    ];
    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !required.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
