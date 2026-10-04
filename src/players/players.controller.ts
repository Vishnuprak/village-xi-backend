import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Players')
@Controller('players')
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'List players with optional team filter' })
  @ApiQuery({ name: 'teamId', required: false })
  async findAll(@Query('teamId') teamId?: string) {
    return this.playersService.findAll(teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get player profile and computed career stats' })
  async findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create player profile (ADMIN only)' })
  async create(@Body() dto: CreatePlayerDto) {
    return this.playersService.createPlayer(dto);
  }
}
