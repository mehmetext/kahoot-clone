import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { generateRandomPin } from 'src/shared/utils/generate-pin';
import { ClearGamePayload } from './dtos/clear-game.payload';
import { CreateGameDto } from './dtos/create-game.dto';
import { GameResponseDto } from './dtos/game-response.dto';
import { LeaderboardItemResponseDto } from './dtos/leaderboard-item.dto';
import { GameStatus } from './enums/game-status.enum';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('game') private gameQueue: Queue,
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

    let pin: string;
    let attempt = 0;
    const maxAttempts = 5;
    let isGameExists = true;

    // generate up to 5 times a unique pin
    while (attempt < maxAttempts) {
      pin = generateRandomPin();
      isGameExists = (await this.redis.sismember(`games`, pin)) === 1;
      if (!isGameExists) {
        break;
      }
      attempt++;
    }

    if (isGameExists) {
      throw new BadRequestException(
        'Could not generate a unique pin after 5 attempts',
      );
    }

    const redisPipeline = this.redis.pipeline();

    redisPipeline.sadd(`games`, pin!);
    redisPipeline.sadd(`user:${userId}:games`, pin!);
    redisPipeline.hset(`game:${pin!}`, {
      quizId: createGameDto.quizId,
      hostId: userId,
      status: GameStatus.WAITING,
      currentQuestionIndex: 0,
      startedAt: null,
    });

    await redisPipeline.exec();

    // If the game is not started after 2 hours, it will be ended automatically
    const clearGamePayload: ClearGamePayload = { pin: pin! };
    await this.gameQueue.add('clear-game', clearGamePayload, {
      delay: 1000 * 60 * 60 * 2, // 2 hours
      jobId: `clear-game-${pin!}`,
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000 * 60, // 1 minute
      },
    });

    return {
      pin: pin!,
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

  async getLeaderboard(pin: string): Promise<LeaderboardItemResponseDto[]> {
    const [leaderboardInRedis, players] = await Promise.all([
      this.redis.zrange(`game:${pin}:scores`, 0, -1, 'REV', 'WITHSCORES'),
      this.redis.hgetall(`game:${pin}:players`),
    ]);

    const leaderboard = leaderboardInRedis.reduce<LeaderboardItemResponseDto[]>(
      (acc, value, index) => {
        if (index % 2 === 0) {
          acc.push({
            playerId: value,
            score: Number(leaderboardInRedis[index + 1]),
            nickname: players[value] ?? null,
          });
        }
        return acc;
      },
      [],
    );

    return leaderboard;
  }
}
