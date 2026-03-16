import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { generateRandomPin } from 'src/shared/utils/generate-pin';
import { CreateGameDto } from './dtos/create-game.dto';
import { GameResponseDto } from './dtos/game-response.dto';
import { GameStatus } from './enums/game-status.enum';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async createGame(
    createGameDto: CreateGameDto,
    userId: string,
  ): Promise<GameResponseDto> {
    const quiz = await this.prisma.quiz.findUnique({
      where: {
        id: createGameDto.quizId,
        userId,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const pin = generateRandomPin();

    const redisPipeline = this.redis.pipeline();

    redisPipeline.sadd(`games`, pin);
    redisPipeline.sadd(`user:${userId}:games`, pin);
    redisPipeline.hset(`game:${pin}`, {
      quizId: createGameDto.quizId,
      hostId: userId,
      status: GameStatus.WAITING,
      currentQuestionIndex: 0,
      startedAt: null,
    });

    await redisPipeline.exec();

    return {
      pin,
      quizId: createGameDto.quizId,
      hostId: userId,
      status: GameStatus.WAITING,
      currentQuestionIndex: 0,
      startedAt: null,
    };
  }

  async getGamesByUserId(userId: string) {
    const gamePins = await this.redis.smembers(`user:${userId}:games`);

    const redisPipeline = this.redis.pipeline();

    for (const gamePin of gamePins) {
      redisPipeline.hgetall(`game:${gamePin}`);
    }

    const results = await redisPipeline.exec();

    if (!results) {
      return [];
    }

    return results.map((result, index) => {
      const game = result[1] as Record<string, string>;

      const gameResponseDto: GameResponseDto = {
        pin: gamePins[index],
        quizId: game.quizId,
        hostId: game.hostId,
        status: game.status as GameStatus,
        currentQuestionIndex: Number(game.currentQuestionIndex),
        startedAt: game.startedAt ? new Date(game.startedAt) : null,
      };

      return gameResponseDto;
    });
  }

  async getGame(pin: string): Promise<GameResponseDto> {
    const game = await this.redis.hgetall(`game:${pin}`);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return {
      pin,
      quizId: game.quizId,
      hostId: game.hostId,
      status: game.status as GameStatus,
      currentQuestionIndex: Number(game.currentQuestionIndex),
      startedAt: game.startedAt ? new Date(game.startedAt) : null,
    };
  }
}
