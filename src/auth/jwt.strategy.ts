import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'village_xi_jwt_secret_key_2026_super_secure',
    });
  }

  async validate(payload: { sub: string; phone: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    const roles = user.roles.map((r) => r.role.name);
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles,
    };
  }
}
