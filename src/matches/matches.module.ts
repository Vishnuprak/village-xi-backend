import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { ScoringService } from '../scoring/scoring.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, ScoringService],
  exports: [MatchesService, ScoringService],
})
export class MatchesModule {}
