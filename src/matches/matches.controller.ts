import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { StartMatchDto } from './dto/start-match.dto';
import { RecordBallInput } from '../scoring/scoring.service';
import { MatchStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Matches & Live Scoring')
@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all matches with optional status filter' })
  @ApiQuery({ name: 'status', enum: MatchStatus, required: false })
  async findAll(@Query('status') status?: MatchStatus) {
    return this.matchesService.findAll(status);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get match overview and squads' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.matchesService.findOne(idOrSlug);
  }

  @Get(':idOrSlug/live')
  @ApiOperation({ summary: 'Public Live Scoreboard Feed (UNAUTHENTICATED)' })
  async getLiveFeed(@Param('idOrSlug') idOrSlug: string) {
    return this.matchesService.getLiveFeed(idOrSlug);
  }

  @Get(':idOrSlug/scorecard')
  @ApiOperation({ summary: 'Detailed Match Scorecard' })
  async getScorecard(@Param('idOrSlug') idOrSlug: string) {
    return this.matchesService.getScorecard(idOrSlug);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule new match (ADMIN only)' })
  async create(@Body() dto: CreateMatchDto) {
    return this.matchesService.createMatch(dto);
  }

  @Post(':id/start')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start match and record toss details (SCORER/ADMIN)' })
  async startMatch(@Param('id') id: string, @Body() dto: StartMatchDto) {
    return this.matchesService.startMatch(id, dto);
  }

  @Post(':id/balls')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record single ball delivery (SCORER/ADMIN)' })
  async recordBall(@Param('id') id: string, @Body() input: RecordBallInput) {
    return this.matchesService.recordBall(id, input);
  }

  @Post(':id/undo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Undo last ball delivery (SCORER/ADMIN)' })
  async undoLastBall(@Param('id') id: string) {
    return this.matchesService.undoLastBall(id);
  }

  @Post(':id/end-over')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End over and assign new bowler (SCORER/ADMIN)' })
  async endOver(@Param('id') id: string, @Body('nextBowlerId') nextBowlerId: string) {
    return this.matchesService.endOver(id, nextBowlerId);
  }

  @Post(':id/end-innings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End current innings (SCORER/ADMIN)' })
  async endInnings(@Param('id') id: string) {
    return this.matchesService.endInnings(id);
  }

  @Post(':id/complete')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SCORER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize match and enter result (SCORER/ADMIN)' })
  async completeMatch(
    @Param('id') id: string,
    @Body('winnerTeamId') winnerTeamId?: string,
    @Body('resultSummary') resultSummary?: string,
  ) {
    return this.matchesService.completeMatch(id, winnerTeamId, resultSummary);
  }
}
