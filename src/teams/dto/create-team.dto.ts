import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ example: 'Village XI Kings' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'VXI' })
  @IsString()
  @IsNotEmpty()
  shortName: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ example: 'Village Main Ground', required: false })
  @IsString()
  @IsOptional()
  homeGround?: string;
}
