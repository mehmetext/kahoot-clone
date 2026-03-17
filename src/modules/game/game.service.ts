import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { generateRandomPin } from 'src/shared/utils/generate-pin';
import { QuestionOptionResponseDto } from '../quiz/dtos/question-response.dto';
import { ClearGamePayload } from './dtos/clear-game.payload';
import { CreateGameDto } from './dtos/create-game.dto';
import { FinishedGameResponseDto } from './dtos/finished-game-response.dto';
import {
  GameQuestionResponseDto,
  GameResponseDto,
} from './dtos/game-response.dto';
import { LeaderboardItemResponseDto } from './dtos/leaderboard-item.dto';
import { GameStatus } from './enums/game-status.enum';
import { CLEAR_GAME_DELAY_AFTER_END_MS } from './game.constants';
import { GameGateway } from './game.gateway';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue('game') private gameQueue: Queue,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
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
      include: {
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        },
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
      name: quiz.name,
      hostId: userId,
      status: GameStatus.WAITING,
      questionCount: quiz.questions.length,
      currentQuestionIndex: 0,
      startedAt: null,
      questions: JSON.stringify(
        quiz.questions.map((question) => ({
          id: question.id,
          title: question.title,
          options: (
            question.options as unknown as QuestionOptionResponseDto[]
          ).map((option) => ({
            id: option.id,
            option: option.option,
            isCorrect: option.isCorrect,
          })),
          timeLimitInSeconds: question.timeLimitInSeconds,
        })),
      ),
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
      name: quiz.name,
      questionCount: quiz.questions.length,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        title: question.title,
        options: (
          question.options as unknown as QuestionOptionResponseDto[]
        ).map((option) => ({
          id: option.id,
          option: option.option,
          isCorrect: option.isCorrect,
        })),
        timeLimitInSeconds: question.timeLimitInSeconds,
        order: question.order,
      })),
      quizId: createGameDto.quizId,
      hostId: userId,
      status: GameStatus.WAITING,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: null,
      startedAt: null,
    };
  }

  async getGamesByUserId(userId: string) {
    const gamePins = await this.redis.smembers(`user:${userId}:games`);

    if (gamePins.length === 0) {
      return [];
    }

    const redisPipeline = this.redis.pipeline();

    for (const gamePin of gamePins) {
      redisPipeline.hgetall(`game:${gamePin}`);
    }

    const results = await redisPipeline.exec();

    if (!results) {
      return [];
    }

    const stalePins: string[] = [];
    const games: GameResponseDto[] = [];

    for (let index = 0; index < results.length; index++) {
      const game = results[index][1] as Record<string, string>;
      const pin = gamePins[index];

      if (!game || Object.keys(game).length === 0) {
        stalePins.push(pin);
        continue;
      }

      const questions = game.questions
        ? (JSON.parse(
            game.questions as unknown as string,
          ) as GameQuestionResponseDto[])
        : [];

      games.push({
        pin,
        name: game.name,
        questionCount: Number(game.questionCount),
        questions,
        quizId: game.quizId,
        hostId: game.hostId,
        status: game.status as GameStatus,
        currentQuestionIndex: Number(game.currentQuestionIndex),
        currentQuestionStartedAt: game.currentQuestionStartedAt
          ? new Date(game.currentQuestionStartedAt)
          : null,
        startedAt: game.startedAt ? new Date(game.startedAt) : null,
      });
    }

    if (stalePins.length > 0) {
      await this.redis.srem(`user:${userId}:games`, ...stalePins);
    }

    return games;
  }

  async getGame(pin: string): Promise<GameResponseDto | null> {
    const game = await this.redis.hgetall(`game:${pin}`);

    if (!game || Object.keys(game).length === 0) {
      return null;
    }

    const questions = game.questions
      ? (JSON.parse(
          game.questions as unknown as string,
        ) as GameQuestionResponseDto[])
      : [];

    return {
      pin,
      name: game.name,
      questionCount: Number(game.questionCount),
      questions: questions,
      quizId: game.quizId,
      hostId: game.hostId,
      status: game.status as GameStatus,
      currentQuestionIndex: Number(game.currentQuestionIndex),
      currentQuestionStartedAt: game.currentQuestionStartedAt
        ? new Date(game.currentQuestionStartedAt)
        : null,
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

  async getCurrentQuestionScores(
    pin: string,
  ): Promise<LeaderboardItemResponseDto[]> {
    const [currentQuestionScoresInRedis, players] = await Promise.all([
      this.redis.zrange(
        `game:${pin}:current-question-scores`,
        0,
        -1,
        'WITHSCORES',
      ),
      this.redis.hgetall(`game:${pin}:players`),
    ]);

    const scoreByPlayerId: Record<string, number> = {};
    const scoredPlayerIdsInOrder: string[] = [];

    for (let i = 0; i < currentQuestionScoresInRedis.length; i += 2) {
      const playerId = currentQuestionScoresInRedis[i];
      const score = Number(currentQuestionScoresInRedis[i + 1]);
      scoreByPlayerId[playerId] = score;
      scoredPlayerIdsInOrder.push(playerId);
    }

    const scoredPlayerIdSet = new Set(scoredPlayerIdsInOrder);
    const missingPlayerIds = Object.keys(players).filter(
      (playerId) => !scoredPlayerIdSet.has(playerId),
    );

    const currentQuestionScores: LeaderboardItemResponseDto[] = [
      ...scoredPlayerIdsInOrder,
      ...missingPlayerIds,
    ].map((playerId) => ({
      playerId,
      score: scoreByPlayerId[playerId] ?? 0,
      nickname: players[playerId] ?? null,
    }));

    return currentQuestionScores;
  }

  async endGame(pin: string): Promise<void> {
    const game = await this.getGame(pin);

    if (!game) {
      return;
    }

    await this.redis.hset(`game:${pin}`, { status: GameStatus.ENDED });

    // Stop any scheduled game progression/cleanup jobs for this pin.
    await Promise.all([
      this.gameQueue.remove(`next-question-${pin}`),
      this.gameQueue.remove(`end-question-${pin}`),
      this.gameQueue.remove(`clear-game-${pin}`),
    ]);

    const leaderboard = await this.getLeaderboard(pin);

    this.gameGateway.server.to(`game:${pin}`).emit('game:ended', {
      leaderboard,
    });

    await this.prisma.game.create({
      data: {
        pin,
        hostId: game.hostId,
        quizId: game.quizId,
        leaderboard: leaderboard.map((item) => ({
          playerId: item.playerId,
          score: item.score,
          nickname: item.nickname,
        })),
      },
    });

    const clearGamePayload: ClearGamePayload = { pin };
    await this.gameQueue.add('clear-game', clearGamePayload, {
      delay: CLEAR_GAME_DELAY_AFTER_END_MS,
      jobId: `clear-game-${pin}`,
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000 * 60, // 1 minute
      },
    });
  }

  async getFinishedGames(): Promise<FinishedGameResponseDto[]> {
    const finishedGames = await this.prisma.game.findMany();

    return finishedGames.map((game) => ({
      ...game,
      leaderboard: game.leaderboard as unknown as LeaderboardItemResponseDto[],
    }));
  }

  async getFinishedGameById(
    id: string,
  ): Promise<FinishedGameResponseDto | null> {
    const finishedGame = await this.prisma.game.findUnique({
      where: { id },
    });

    if (!finishedGame) {
      return null;
    }

    return {
      ...finishedGame,
      leaderboard:
        finishedGame.leaderboard as unknown as LeaderboardItemResponseDto[],
    };
  }
}
