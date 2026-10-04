import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of all cricket teams' })
  async findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team details and roster' })
  async findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new team (ADMIN only)' })
  async create(@Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(dto);
  }
}
