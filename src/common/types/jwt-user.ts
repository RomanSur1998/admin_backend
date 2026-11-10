import { Request } from 'express';
import { Role } from '../../generated/prisma/enums.js';

export type JwtUser = { sub: string; role: Role; branchId: string | null };
export type AuthenticatedRequest = Request & { user?: JwtUser };
