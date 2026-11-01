import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Register a new CUSTOMER account */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    const token = this.signToken(user.id, user.email, user.role);
    return {
      user,
      accessToken: token,
      access_token: token,
      tokenType: 'Bearer',
      expiresIn: 86400,
    };
  }

  /** Login with email + password */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const { passwordHash: _pw, ...safeUser } = user;
    const token = this.signToken(user.id, user.email, user.role);
    return {
      user: safeUser,
      accessToken: token,
      access_token: token,
      tokenType: 'Bearer',
      expiresIn: 86400,
    };
  }

  private signToken(sub: number, email: string, role: string): string {
    const payload: JwtPayload = { sub, email, role };
    return this.jwtService.sign(payload, {
      expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '1d') as any,
    });
  }
}
