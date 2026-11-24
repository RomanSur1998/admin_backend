import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthenticatedRequest, JwtUser } from '../types/jwt-user.js';
import { ACCESS_COOKIE } from '../../modules/auth/auth.cookie.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = req.cookies as Record<string, string | undefined> | undefined;
    const [type, bearer] = req.headers.authorization?.split(' ') ?? [];
    const token = cookie?.[ACCESS_COOKIE] ?? (type === 'Bearer' ? bearer : undefined);
    if (!token) throw new UnauthorizedException();

    try {
      req.user = await this.jwt.verifyAsync<JwtUser>(token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
