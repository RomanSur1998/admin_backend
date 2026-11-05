import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    this.auth.signIn(dto);
  }
  async authorise() {}
}
