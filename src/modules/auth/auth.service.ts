import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private userServive: UsersService,
    private jwtService: JwtService,
  ) {}

  // async login(username: string, password: string) {}
  async signIn(
    username: string,
    password: string,
  ): Promise<{ acces_token: string }> {
    const user = await this.userServive.findOne(username);
    if (user?.password !== password) {
      throw new UnauthorizedException();
    }

    return {
      acces_token: 'acces_token',
    };
  }
}
