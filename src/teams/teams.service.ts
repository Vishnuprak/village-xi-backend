import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async createTeam(dto: CreateTeamDto) {
    const existing = await this.prisma.team.findUnique({
      where: { shortName: dto.shortName.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Team with short name ${dto.shortName} already exists`);
    }

    return this.prisma.team.create({
      data: {
        name: dto.name,
        shortName: dto.shortName.toUpperCase(),
        logoUrl: dto.logoUrl,
        homeGround: dto.homeGround,
      },
    });
  }

  async findAll() {
    return this.prisma.team.findMany({
      include: {
        _count: {
          select: { players: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          orderBy: { fullName: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }
}
