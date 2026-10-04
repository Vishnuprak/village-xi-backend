import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TossDecision } from '@prisma/client';

export class StartMatchDto {
  @ApiProperty({ example: 'team-uuid-toss-winner' })
  @IsString()
  @IsNotEmpty()
  tossWinnerId: string;

  @ApiProperty({ enum: TossDecision, example: TossDecision.BAT })
  @IsEnum(TossDecision)
  @IsNotEmpty()
  tossDecision: TossDecision;

  @ApiProperty({ example: 'player-uuid-striker' })
  @IsString()
  @IsNotEmpty()
  strikerId: string;

  @ApiProperty({ example: 'player-uuid-non-striker' })
  @IsString()
  @IsNotEmpty()
  nonStrikerId: string;

  @ApiProperty({ example: 'player-uuid-opening-bowler' })
  @IsString()
  @IsNotEmpty()
  openingBowlerId: string;
}
