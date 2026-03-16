import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { CreateGameDto } from './dtos/create-game.dto';
import { GameResponseDto } from './dtos/game-response.dto';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @ApiOkResponseGeneric(GameResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async createGame(
    @Body() createGameDto: CreateGameDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<GameResponseDto> {
    const game = await this.gameService.createGame(createGameDto, user.id);
    return game;
  }

  @Get(':pin')
  @ApiOkResponseGeneric(GameResponseDto)
  @ApiBearerAuth()
  async getGame(@Param('pin') pin: string): Promise<GameResponseDto> {
    const game = await this.gameService.getGame(pin);
    return game;
  }
}
