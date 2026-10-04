import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExtraType, DismissalType, MatchStatus, InningsStatus } from '@prisma/client';

export interface RecordBallInput {
  matchId: string;
  runsBat: number;
  extraType?: ExtraType;
  extraRuns?: number;
  isWicket?: boolean;
  dismissalType?: DismissalType;
  playerOutId?: string;
  fielderId?: string;
  nextStrikerId?: string; // If wicket occurs, specify new incoming batter
}

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  /**
   * Process a single ball delivery inside an atomic database transaction
   */
  async recordBall(input: RecordBallInput) {
    const { matchId, runsBat, extraType = ExtraType.NONE, extraRuns = 0, isWicket = false, dismissalType, playerOutId, fielderId, nextStrikerId } = input;

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          orderBy: { inningsNumber: 'desc' },
          include: {
            overs: {
              orderBy: { overNumber: 'desc' },
              take: 1,
              include: {
                balls: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    if (match.status !== MatchStatus.LIVE) {
      throw new BadRequestException(`Cannot score a match in ${match.status} status. Match must be LIVE.`);
    }

    const currentInnings = match.innings[0];
    if (!currentInnings || currentInnings.status !== InningsStatus.IN_PROGRESS) {
      throw new BadRequestException(`No active innings found for match ${matchId}`);
    }

    const currentOver = currentInnings.overs[0];
    if (!currentOver) {
      throw new BadRequestException(`No active over found. Please assign bowler for new over.`);
    }

    // Determine legal balls in current over
    const legalBallsInOver = currentOver.balls.filter(
      (b) => b.extraType !== ExtraType.WIDE && b.extraType !== ExtraType.NO_BALL,
    ).length;

    if (legalBallsInOver >= 6) {
      throw new BadRequestException(`Current over #${currentOver.overNumber} is completed. Please end over and start next over.`);
    }

    // Get current striker, non-striker, and bowler from last ball or squad
    const lastBall = currentOver.balls[0] || (await this.getLastBallInInnings(currentInnings.id));

    if (!lastBall) {
      throw new BadRequestException(`Opening batters not selected for this innings.`);
    }

    let strikerId = lastBall.strikerId;
    let nonStrikerId = lastBall.nonStrikerId;
    const bowlerId = currentOver.bowlerId;

    // Calculate run values
    const isExtra = extraType !== ExtraType.NONE;
    let totalBallRuns = runsBat;

    if (extraType === ExtraType.WIDE || extraType === ExtraType.NO_BALL) {
      totalBallRuns += 1 + extraRuns; // 1 penalty run + additional runs taken
    } else if (extraType === ExtraType.BYE || extraType === ExtraType.LEG_BYE) {
      totalBallRuns += extraRuns;
    }

    // Execute atomic transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Ball Record
      const ballNumber = currentOver.balls.length + 1;
      const createdBall = await tx.ball.create({
        data: {
          inningsId: currentInnings.id,
          overId: currentOver.id,
          ballNumber,
          strikerId,
          nonStrikerId,
          bowlerId,
          runsBat: extraType === ExtraType.NONE ? runsBat : 0,
          totalRuns: totalBallRuns,
          isExtra,
          extraType,
          isWicket,
        },
      });

      // 2. Handle Wicket if present
      if (isWicket) {
        const outId = playerOutId || strikerId;
        await tx.wicket.create({
          data: {
            ballId: createdBall.id,
            playerOutId: outId,
            bowlerId,
            fielderId,
            dismissalType: dismissalType || DismissalType.BOWLED,
          },
        });

        // Replace out player with nextStrikerId if provided
        if (outId === strikerId && nextStrikerId) {
          strikerId = nextStrikerId;
        } else if (outId === nonStrikerId && nextStrikerId) {
          nonStrikerId = nextStrikerId;
        }
      }

      // 3. Update Over Stats
      const runsConcededForBowler = (extraType === ExtraType.BYE || extraType === ExtraType.LEG_BYE) ? 0 : totalBallRuns;
      const isWicketCreditToBowler = isWicket && dismissalType !== DismissalType.RUN_OUT && dismissalType !== DismissalType.RETIRED;

      await tx.over.update({
        where: { id: currentOver.id },
        data: {
          runsConceded: { increment: runsConcededForBowler },
          wicketsTaken: isWicketCreditToBowler ? { increment: 1 } : undefined,
        },
      });

      // 4. Update Innings Stats
      const isLegalDelivery = extraType !== ExtraType.WIDE && extraType !== ExtraType.NO_BALL;
      const updatedLegalBallsInOver = legalBallsInOver + (isLegalDelivery ? 1 : 0);

      // Recalculate total overs float representation (e.g., 4.2 overs)
      const fullOversCompleted = Math.floor(currentInnings.totalOvers) + (updatedLegalBallsInOver === 6 ? 1 : 0);
      const remainingBallsInOver = updatedLegalBallsInOver === 6 ? 0 : updatedLegalBallsInOver;
      const newTotalOversFloat = parseFloat(`${fullOversCompleted}.${remainingBallsInOver}`);

      const newInnings = await tx.innings.update({
        where: { id: currentInnings.id },
        data: {
          totalRuns: { increment: totalBallRuns },
          totalWickets: isWicket ? { increment: 1 } : undefined,
          totalOvers: newTotalOversFloat,
        },
      });

      // 5. Calculate Strike Rotation
      // Swap strike if odd runs (unless over completed)
      let nextStriker = strikerId;
      let nextNonStriker = nonStrikerId;

      const runsForRotation = extraType === ExtraType.NONE ? runsBat : extraRuns;
      if (runsForRotation % 2 !== 0) {
        nextStriker = nonStrikerId;
        nextNonStriker = strikerId;
      }

      // End of over strike rotation
      if (updatedLegalBallsInOver === 6) {
        const temp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = temp;
      }

      return {
        ball: createdBall,
        innings: newInnings,
        overNumber: currentOver.overNumber,
        legalBallsInOver: updatedLegalBallsInOver,
        isOverComplete: updatedLegalBallsInOver === 6,
        nextStrikerId: nextStriker,
        nextNonStrikerId: nextNonStriker,
      };
    });
  }

  /**
   * Undo the last recorded ball in current innings
   */
  async undoLastBall(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          orderBy: { inningsNumber: 'desc' },
          take: 1,
          include: {
            overs: {
              orderBy: { overNumber: 'desc' },
              take: 1,
              include: {
                balls: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: { wicket: true },
                },
              },
            },
          },
        },
      },
    });

    if (!match || match.innings.length === 0) {
      throw new NotFoundException(`No active innings found for match ${matchId}`);
    }

    const currentInnings = match.innings[0];
    const currentOver = currentInnings.overs[0];

    if (!currentOver || currentOver.balls.length === 0) {
      throw new BadRequestException(`No ball available to undo in current over.`);
    }

    const lastBall = currentOver.balls[0];

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete Wicket if applicable
      if (lastBall.wicket) {
        await tx.wicket.delete({ where: { id: lastBall.wicket.id } });
      }

      // 2. Delete Ball
      await tx.ball.delete({ where: { id: lastBall.id } });

      // 3. Recalculate Innings Score
      const isLegal = lastBall.extraType !== ExtraType.WIDE && lastBall.extraType !== ExtraType.NO_BALL;
      const newTotalRuns = Math.max(0, currentInnings.totalRuns - lastBall.totalRuns);
      const newWickets = lastBall.isWicket ? Math.max(0, currentInnings.totalWickets - 1) : currentInnings.totalWickets;

      // Update Innings
      const updatedInnings = await tx.innings.update({
        where: { id: currentInnings.id },
        data: {
          totalRuns: newTotalRuns,
          totalWickets: newWickets,
        },
      });

      return {
        message: 'Last ball successfully reverted',
        undoneBallId: lastBall.id,
        innings: updatedInnings,
      };
    });
  }

  private async getLastBallInInnings(inningsId: string) {
    return this.prisma.ball.findFirst({
      where: { inningsId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
