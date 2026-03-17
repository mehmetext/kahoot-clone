import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { CreateGameDto } from './dtos/create-game.dto';
import { FinishedGameResponseDto } from './dtos/finished-game-response.dto';
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

  @Get()
  @ApiOkResponseGeneric(GameResponseDto, { isArray: true })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getGamesByUserId(
    @CurrentUser() user: UserResponseDto,
  ): Promise<GameResponseDto[]> {
    const games = await this.gameService.getGamesByUserId(user.id);
    return games;
  }

  @Get('finished')
  @ApiOkResponseGeneric(FinishedGameResponseDto, { isArray: true })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getFinishedGames(
    @CurrentUser() user: UserResponseDto,
  ): Promise<FinishedGameResponseDto[]> {
    const finishedGames = await this.gameService.getFinishedGames(user.id);
    return finishedGames;
  }

  @Get('finished/:id')
  @ApiOkResponseGeneric(FinishedGameResponseDto)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getFinishedGame(
    @Param('id') id: string,
    @CurrentUser() user: UserResponseDto,
  ): Promise<FinishedGameResponseDto> {
    const finishedGame = await this.gameService.getFinishedGameById(
      id,
      user.id,
    );
    if (!finishedGame) {
      throw new NotFoundException('Finished game not found');
    }
    return finishedGame;
  }

  @Get(':pin')
  @ApiOkResponseGeneric(GameResponseDto)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getGame(@Param('pin') pin: string): Promise<GameResponseDto> {
    const game = await this.gameService.getGame(pin);
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }
}
