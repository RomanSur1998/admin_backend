import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import { Env, NodeEnv } from '../../config/env.validator.js';
import type { Response } from 'express';
import { clearCookie, setAccesCookie } from './auth.cookie.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtUser } from '../../common/types/jwt-user.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}
  private get secure() {
    return this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  @Public()
  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken } = await this.auth.signIn(dto);
    setAccesCookie(
      res,
      accessToken,
      this.config.get('JWT_ACCESS_TTL', { infer: true }),
      this.secure,
    );
    return true;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    clearCookie(res, this.secure);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return user;
  }
}
