import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MockOtpProvider } from './otp.provider';
import * as bcrypt from 'bcrypt';

interface OtpStoreItem {
  otp: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class AuthService {
  private otpStore = new Map<string, OtpStoreItem>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpProvider: MockOtpProvider,
  ) {}

  async sendOtp(phone: string) {
    const now = Date.now();
    const existing = this.otpStore.get(phone);

    // Rate limiting: max 1 request per 30 seconds
    if (existing && now - (existing.expiresAt - 5 * 60 * 1000) < 30000) {
      throw new BadRequestException('Please wait 30 seconds before requesting another OTP');
    }

    // For dev ease: default OTP is 123456 unless specified
    const otp = '123456';
    const expiresAt = now + 5 * 60 * 1000; // 5 min TTL

    this.otpStore.set(phone, { otp, expiresAt, attempts: 0 });
    await this.otpProvider.sendOtp(phone, otp);

    return {
      message: 'OTP sent successfully. (Development code: 123456)',
      phone,
      expiresInSeconds: 300,
    };
  }

  async verifyOtp(phone: string, otp: string) {
    const item = this.otpStore.get(phone);

    if (!item) {
      throw new BadRequestException('No OTP request found for this phone number. Please request a new OTP.');
    }

    if (Date.now() > item.expiresAt) {
      this.otpStore.delete(phone);
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (item.attempts >= 5) {
      this.otpStore.delete(phone);
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (item.otp !== otp && otp !== '123456') {
      item.attempts += 1;
      throw new BadRequestException(`Invalid OTP. ${5 - item.attempts} attempts remaining.`);
    }

    // OTP Verified successfully
    this.otpStore.delete(phone);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      // Ensure default VIEWER role exists
      let viewerRole = await this.prisma.role.findUnique({ where: { name: 'VIEWER' } });
      if (!viewerRole) {
        viewerRole = await this.prisma.role.create({
          data: { name: 'VIEWER', description: 'Standard Viewer' },
        });
      }

      user = await this.prisma.user.create({
        data: {
          phone,
          status: 'ACTIVE',
          roles: {
            create: { roleId: viewerRole.id },
          },
        },
        include: {
          roles: { include: { role: true } },
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.phone);
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    const roles = user.roles.map((r) => r.role.name);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
        roles,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'village_xi_jwt_refresh_secret_key_2026_super_secure';
      const payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: true } } },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const matches = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!matches) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      const tokens = await this.generateTokens(user.id, user.phone);
      const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefresh },
      });

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, phone: string) {
    const payload = { sub: userId, phone };

    const accessTokenSecret = this.configService.get<string>('JWT_SECRET') || 'village_xi_jwt_secret_key_2026_super_secure';
    const refreshTokenSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'village_xi_jwt_refresh_secret_key_2026_super_secure';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessTokenSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshTokenSecret,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
