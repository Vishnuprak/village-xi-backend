import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlayerRole, BattingStyle, BowlingStyle } from '@prisma/client';

export class CreatePlayerDto {
  @ApiProperty({ example: 'team-uuid-here' })
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ example: 'Senthil Kumar' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '7', required: false })
  @IsString()
  @IsOptional()
  jerseyNumber?: string;

  @ApiProperty({ enum: PlayerRole, default: PlayerRole.ALL_ROUNDER })
  @IsEnum(PlayerRole)
  @IsOptional()
  primaryRole?: PlayerRole;

  @ApiProperty({ enum: BattingStyle, default: BattingStyle.RIGHT_HAND })
  @IsEnum(BattingStyle)
  @IsOptional()
  battingStyle?: BattingStyle;

  @ApiProperty({ enum: BowlingStyle, default: BowlingStyle.RIGHT_ARM_MEDIUM })
  @IsEnum(BowlingStyle)
  @IsOptional()
  bowlingStyle?: BowlingStyle;
}
