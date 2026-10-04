import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchFormat } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty({ example: 'Village XI vs Town Royals — Championship Final' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'team-a-uuid' })
  @IsString()
  @IsNotEmpty()
  teamAId: string;

  @ApiProperty({ example: 'team-b-uuid' })
  @IsString()
  @IsNotEmpty()
  teamBId: string;

  @ApiProperty({ example: 'Village Oval Ground' })
  @IsString()
  @IsNotEmpty()
  venue: string;

  @ApiProperty({ example: '2026-10-04T10:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiProperty({ example: 20, default: 20 })
  @IsInt()
  @IsOptional()
  totalOvers?: number;

  @ApiProperty({ enum: MatchFormat, default: MatchFormat.LIMITED_OVERS })
  @IsEnum(MatchFormat)
  @IsOptional()
  format?: MatchFormat;

  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', required: false })
  @IsString()
  @IsOptional()
  liveStreamUrl?: string;

  @ApiProperty({ example: 'Annual league match fixture', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
