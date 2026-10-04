import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async createPlayer(dto: CreatePlayerDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
    }

    return this.prisma.player.create({
      data: {
        teamId: dto.teamId,
        fullName: dto.fullName,
        jerseyNumber: dto.jerseyNumber,
        primaryRole: dto.primaryRole,
        battingStyle: dto.battingStyle,
        bowlingStyle: dto.bowlingStyle,
      },
    });
  }

  async findAll(teamId?: string) {
    return this.prisma.player.findMany({
      where: teamId ? { teamId } : {},
      include: {
        team: {
          select: { name: true, shortName: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        team: true,
        strikerBalls: true,
        bowlerBalls: true,
        wicketsTaken: true,
        wicketsOut: true,
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    // Compute career stats from ball-by-ball history
    const totalMatches = new Set([
      ...player.strikerBalls.map((b) => b.inningsId),
      ...player.bowlerBalls.map((b) => b.inningsId),
    ]).size;

    const totalRuns = player.strikerBalls.reduce((acc, b) => acc + b.runsBat, 0);
    const totalBallsFaced = player.strikerBalls.length;
    const fours = player.strikerBalls.filter((b) => b.runsBat === 4).length;
    const sixes = player.strikerBalls.filter((b) => b.runsBat === 6).length;
    const totalWickets = player.wicketsTaken.length;

    const strikeRate = totalBallsFaced > 0 ? parseFloat(((totalRuns / totalBallsFaced) * 100).toFixed(2)) : 0;

    return {
      player: {
        id: player.id,
        fullName: player.fullName,
        jerseyNumber: player.jerseyNumber,
        primaryRole: player.primaryRole,
        battingStyle: player.battingStyle,
        bowlingStyle: player.bowlingStyle,
        team: player.team,
      },
      stats: {
        matches: totalMatches,
        runs: totalRuns,
        ballsFaced: totalBallsFaced,
        fours,
        sixes,
        strikeRate,
        wickets: totalWickets,
      },
    };
  }
}
