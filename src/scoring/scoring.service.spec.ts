import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExtraType, DismissalType } from '@prisma/client';

describe('ScoringService', () => {
  let service: ScoringService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      match: { findUnique: jest.fn() },
      ball: { create: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
      wicket: { create: jest.fn(), delete: jest.fn() },
      over: { update: jest.fn() },
      innings: { update: jest.fn() },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate 4 runs bat correctly', async () => {
    const mockMatch = {
      id: 'match-1',
      status: 'LIVE',
      innings: [
        {
          id: 'inn-1',
          status: 'IN_PROGRESS',
          totalOvers: 0.1,
          overs: [
            {
              id: 'over-1',
              overNumber: 1,
              bowlerId: 'bowler-1',
              balls: [
                {
                  id: 'ball-1',
                  extraType: 'NONE',
                  strikerId: 'striker-1',
                  nonStrikerId: 'striker-2',
                },
              ],
            },
          ],
        },
      ],
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatch);
    prismaMock.ball.create.mockResolvedValue({ id: 'ball-2', totalRuns: 4 });
    prismaMock.over.update.mockResolvedValue({});
    prismaMock.innings.update.mockResolvedValue({ id: 'inn-1', totalRuns: 4 });

    const result = await service.recordBall({
      matchId: 'match-1',
      runsBat: 4,
      extraType: ExtraType.NONE,
    });

    expect(prismaMock.ball.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runsBat: 4,
        totalRuns: 4,
        isExtra: false,
      }),
    );
    expect(result.ball.totalRuns).toBe(4);
  });

  it('should handle Wide extra run penalty correctly', async () => {
    const mockMatch = {
      id: 'match-1',
      status: 'LIVE',
      innings: [
        {
          id: 'inn-1',
          status: 'IN_PROGRESS',
          totalOvers: 0.1,
          overs: [
            {
              id: 'over-1',
              overNumber: 1,
              bowlerId: 'bowler-1',
              balls: [
                {
                  id: 'ball-1',
                  extraType: 'NONE',
                  strikerId: 'striker-1',
                  nonStrikerId: 'striker-2',
                },
              ],
            },
          ],
        },
      ],
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatch);
    prismaMock.ball.create.mockResolvedValue({ id: 'ball-2', totalRuns: 1, isExtra: true });
    prismaMock.over.update.mockResolvedValue({});
    prismaMock.innings.update.mockResolvedValue({ id: 'inn-1', totalRuns: 5 });

    const result = await service.recordBall({
      matchId: 'match-1',
      runsBat: 0,
      extraType: ExtraType.WIDE,
    });

    expect(prismaMock.ball.create).toHaveBeenCalledWith(
      expect.objectContaining({
        extraType: ExtraType.WIDE,
        totalRuns: 1,
        isExtra: true,
      }),
    );
    expect(result.ball.isExtra).toBe(true);
  });
});
