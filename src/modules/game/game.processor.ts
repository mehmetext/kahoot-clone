import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { ClearGamePayload } from './dtos/clear-game.payload';
import { NextQuestionPayload } from './dtos/next-question.payload';
import { QuestionStartPayload } from './dtos/question:start.payload';
import { GameStatus } from './enums/game-status.enum';
import { QUESTION_END_TIME_LIMIT_IN_SECONDS } from './game.constants';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Processor('game')
export class GameProcessor extends WorkerHost {
  private readonly logger = new Logger(GameProcessor.name);

  constructor(
    private readonly gameService: GameService,
    @InjectRedis() private readonly redis: Redis,
    private readonly gameGateway: GameGateway,
    @InjectQueue('game') private readonly gameQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    switch (job.name) {
      case 'clear-game':
        await this.clearGame(job.data as ClearGamePayload);
        break;
      case 'start-game':
        await this.startGame(job.data as { pin: string });
        break;
      case 'next-question':
        await this.nextQuestion(job.data as NextQuestionPayload);
        break;
    }
  }

  async clearGame(data: ClearGamePayload): Promise<void> {
    const { pin } = data;

    const game = await this.gameService.getGame(pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const redisPipeline = this.redis.pipeline();

    redisPipeline.srem(`games`, pin);
    redisPipeline.srem(`user:${game.hostId}:games`, pin);
    redisPipeline.del(`game:${pin}`);

    await redisPipeline.exec();
  }

  async startGame(data: { pin: string }): Promise<void> {
    const { pin } = data;

    const game = await this.gameService.getGame(pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    await this.redis.hset(`game:${pin}`, {
      status: GameStatus.ACTIVE,
    });

    const nextQuestionPayload: NextQuestionPayload = { pin };
    await this.gameQueue.add('next-question', nextQuestionPayload, {
      jobId: `next-question-${pin}`,
      removeOnComplete: true,
    });
  }

  async nextQuestion(data: NextQuestionPayload): Promise<void> {
    const game = await this.gameService.getGame(data.pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    await this.redis.hset(`game:${data.pin}`, {
      status: GameStatus.ACTIVE,
    });

    const currentQuestionIndex = game.currentQuestionIndex;
    const questions = game.questions;
    const timeLimitInSeconds =
      questions[currentQuestionIndex].timeLimitInSeconds ??
      QUESTION_END_TIME_LIMIT_IN_SECONDS;

    const questionStartPayload: QuestionStartPayload = {
      text: questions[currentQuestionIndex].title,
      answers: questions[currentQuestionIndex].options.map((option) => ({
        id: option.id,
        text: option.option,
      })),
      timeLimitInSeconds,
      currentQuestionIndex: currentQuestionIndex,
      totalQuestionCount: questions.length,
    };

    this.gameGateway.server
      .to(`game:${data.pin}`)
      .emit('question:start', questionStartPayload);

    await this.gameQueue.add(
      'end-question',
      { pin: data.pin },
      {
        jobId: `end-question-${data.pin}`,
        removeOnComplete: true,
        delay: timeLimitInSeconds * 1000,
      },
    );
  }

  async endQuestion(data: { pin: string }): Promise<void> {
    const game = await this.gameService.getGame(data.pin);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    await this.redis.hset(`game:${data.pin}`, {
      status: GameStatus.REVIEWING,
    });

    const correctAnswerId = game.questions[
      game.currentQuestionIndex
    ].options.find((option) => option.isCorrect)?.id;

    const currentQuestionScores =
      await this.gameService.getCurrentQuestionScores(data.pin);

    const leaderboard = await this.gameService.getLeaderboard(data.pin);
    const top5 = leaderboard.slice(0, 5);

    this.gameGateway.server.to(`game:${data.pin}`).emit('question:end', {
      correctAnswerId,
      currentQuestionScores,
      top5,
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is active`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
