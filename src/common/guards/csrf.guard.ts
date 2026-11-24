import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/jwt-user.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE.has(request.method) || request.headers.authorization) return true;
    if (request.headers['x-requested-with'] !== 'XMLHttpRequest') throw new ForbiddenException();
    return true;
  }
}
