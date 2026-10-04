import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService, RecordBallInput } from '../scoring/scoring.service';
import { LiveGateway } from '../live/live.gateway';
import { CreateMatchDto } from './dto/create-match.dto';
import { StartMatchDto } from './dto/start-match.dto';
import { MatchStatus, InningsStatus, TossDecision } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
    private liveGateway: LiveGateway,
  ) {}

  async createMatch(dto: CreateMatchDto) {
    const slug = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    return this.prisma.match.create({
      data: {
        title: dto.title,
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        venue: dto.venue,
        scheduledAt: new Date(dto.scheduledAt),
        totalOvers: dto.totalOvers || 20,
        format: dto.format,
        liveStreamUrl: dto.liveStreamUrl,
        description: dto.description,
        status: MatchStatus.SCHEDULED,
      },
      include: {
        teamA: true,
        teamB: true,
      },
    });
  }

  async findAll(status?: MatchStatus) {
    return this.prisma.match.findMany({
      where: status ? { status } : {},
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
        innings: {
          orderBy: { inningsNumber: 'asc' },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findOne(idOrSlug: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        teamA: { include: { players: true } },
        teamB: { include: { players: true } },
        tossWinner: true,
        winnerTeam: true,
        squads: { include: { player: true } },
        innings: {
          orderBy: { inningsNumber: 'asc' },
          include: {
            battingTeam: true,
            bowlingTeam: true,
            overs: {
              orderBy: { overNumber: 'desc' },
              include: {
                bowler: true,
                balls: {
                  orderBy: { createdAt: 'desc' },
                  include: { striker: true, nonStriker: true, bowler: true, wicket: true },
                },
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match ${idOrSlug} not found`);
    }

    return match;
  }

  async startMatch(id: string, dto: StartMatchDto) {
    const match = await this.findOne(id);

    if (match.status === MatchStatus.LIVE) {
      throw new BadRequestException('Match is already LIVE');
    }

    // Determine batting & bowling teams based on toss
    let battingTeamId = dto.tossWinnerId;
    let bowlingTeamId = dto.tossWinnerId === match.teamAId ? match.teamBId : match.teamAId;

    if (dto.tossDecision === TossDecision.BOWL) {
      const temp = battingTeamId;
      battingTeamId = bowlingTeamId;
      bowlingTeamId = temp;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Match state
      const updatedMatch = await tx.match.update({
        where: { id },
        data: {
          status: MatchStatus.LIVE,
          tossWinnerId: dto.tossWinnerId,
          tossDecision: dto.tossDecision,
        },
      });

      // 2. Create 1st Innings
      const innings1 = await tx.innings.create({
        data: {
          matchId: id,
          inningsNumber: 1,
          battingTeamId,
          bowlingTeamId,
          status: InningsStatus.IN_PROGRESS,
        },
      });

      // 3. Create 1st Over
      const over1 = await tx.over.create({
        data: {
          inningsId: innings1.id,
          overNumber: 1,
          bowlerId: dto.openingBowlerId,
        },
      });

      // 4. Record Initial Dummy Ball setup marker for opening batters
      await tx.ball.create({
        data: {
          inningsId: innings1.id,
          overId: over1.id,
          ballNumber: 0,
          strikerId: dto.strikerId,
          nonStrikerId: dto.nonStrikerId,
          bowlerId: dto.openingBowlerId,
          runsBat: 0,
          totalRuns: 0,
        },
      });

      const liveFeed = await this.getLiveFeed(id);
      this.liveGateway.broadcastMatchEvent(id, 'match.started', liveFeed);

      return updatedMatch;
    });
  }

  async recordBall(id: string, input: RecordBallInput) {
    const result = await this.scoringService.recordBall({ ...input, matchId: id });
    const liveFeed = await this.getLiveFeed(id);
    this.liveGateway.broadcastScoreUpdate(id, liveFeed);
    return result;
  }

  async undoLastBall(id: string) {
    const result = await this.scoringService.undoLastBall(id);
    const liveFeed = await this.getLiveFeed(id);
    this.liveGateway.broadcastScoreUpdate(id, liveFeed);
    return result;
  }

  async endOver(id: string, nextBowlerId: string) {
    const match = await this.findOne(id);
    const currentInnings = match.innings[match.innings.length - 1];

    if (!currentInnings || currentInnings.status !== InningsStatus.IN_PROGRESS) {
      throw new BadRequestException('No active innings found');
    }

    const nextOverNumber = currentInnings.overs.length + 1;

    const newOver = await this.prisma.over.create({
      data: {
        inningsId: currentInnings.id,
        overNumber: nextOverNumber,
        bowlerId: nextBowlerId,
      },
    });

    const liveFeed = await this.getLiveFeed(id);
    this.liveGateway.broadcastMatchEvent(id, 'over.completed', liveFeed);

    return newOver;
  }

  async endInnings(id: string) {
    const match = await this.findOne(id);
    const currentInnings = match.innings[match.innings.length - 1];

    if (!currentInnings) {
      throw new BadRequestException('No active innings');
    }

    await this.prisma.innings.update({
      where: { id: currentInnings.id },
      data: { status: InningsStatus.COMPLETED },
    });

    if (currentInnings.inningsNumber === 1) {
      // Initialize 2nd Innings
      const innings2 = await this.prisma.innings.create({
        data: {
          matchId: id,
          inningsNumber: 2,
          battingTeamId: currentInnings.bowlingTeamId,
          bowlingTeamId: currentInnings.battingTeamId,
          status: InningsStatus.IN_PROGRESS,
        },
      });
      const liveFeed = await this.getLiveFeed(id);
      this.liveGateway.broadcastMatchEvent(id, 'innings.completed', liveFeed);
      return innings2;
    } else {
      // Complete Match
      return this.completeMatch(id, null, 'Match Innings Concluded');
    }
  }

  async completeMatch(id: string, winnerTeamId?: string, resultSummary?: string) {
    const updated = await this.prisma.match.update({
      where: { id },
      data: {
        status: MatchStatus.COMPLETED,
        winnerTeamId,
        resultSummary: resultSummary || 'Match completed',
      },
    });

    const liveFeed = await this.getLiveFeed(id);
    this.liveGateway.broadcastMatchEvent(id, 'match.completed', liveFeed);
    return updated;
  }

  async getLiveFeed(idOrSlug: string) {
    const match = await this.findOne(idOrSlug);
    const currentInnings = match.innings[match.innings.length - 1] || null;

    let striker = null;
    let nonStriker = null;
    let currentBowler = null;
    let recentBalls: any[] = [];
    let crr = '0.00';
    let rrr = null;
    let target = null;
    let runsRequired = null;

    if (currentInnings && currentInnings.overs.length > 0) {
      const currentOver = currentInnings.overs[0];
      const validBalls = currentOver.balls.filter((b) => b.ballNumber > 0);

      if (validBalls.length > 0) {
        const lastBall = validBalls[0];
        striker = lastBall.striker;
        nonStriker = lastBall.nonStriker;
        currentBowler = currentOver.bowler;

        recentBalls = validBalls.slice(0, 6).map((b) => ({
          runs: b.runsBat,
          isWicket: b.isWicket,
          extraType: b.extraType,
          totalRuns: b.totalRuns,
        }));
      }

      const totalOversDec = currentInnings.totalOvers;
      if (totalOversDec > 0) {
        const oversInDec = Math.floor(totalOversDec) + (totalOversDec % 1) * (10 / 6);
        crr = (currentInnings.totalRuns / oversInDec).toFixed(2);
      }

      if (currentInnings.inningsNumber === 2 && match.innings[0]) {
        target = match.innings[0].totalRuns + 1;
        runsRequired = Math.max(0, target - currentInnings.totalRuns);
        const remainingOvers = match.totalOvers - totalOversDec;
        if (remainingOvers > 0) {
          rrr = (runsRequired / remainingOvers).toFixed(2);
        }
      }
    }

    return {
      matchId: match.id,
      slug: match.slug,
      title: match.title,
      status: match.status,
      venue: match.venue,
      totalOvers: match.totalOvers,
      liveStreamUrl: match.liveStreamUrl,
      resultSummary: match.resultSummary,
      teamA: match.teamA,
      teamB: match.teamB,
      tossWinner: match.tossWinner,
      tossDecision: match.tossDecision,
      currentInnings: currentInnings
        ? {
            id: currentInnings.id,
            inningsNumber: currentInnings.inningsNumber,
            battingTeam: currentInnings.battingTeam,
            bowlingTeam: currentInnings.bowlingTeam,
            totalRuns: currentInnings.totalRuns,
            totalWickets: currentInnings.totalWickets,
            totalOvers: currentInnings.totalOvers,
          }
        : null,
      striker,
      nonStriker,
      currentBowler,
      recentBalls,
      crr,
      rrr,
      target,
      runsRequired,
    };
  }

  async getScorecard(idOrSlug: string) {
    return this.findOne(idOrSlug);
  }
}
