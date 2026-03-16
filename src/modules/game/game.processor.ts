import { InjectRedis } from '@nestjs-modules/ioredis';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { ClearGamePayload } from './dtos/clear-game.payload';
import { GameStatus } from './enums/game-status.enum';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Processor('game')
export class GameProcessor extends WorkerHost {
  private readonly logger = new Logger(GameProcessor.name);

  constructor(
    private readonly gameService: GameService,
    @InjectRedis() private readonly redis: Redis,
    private readonly gameGateway: GameGateway,
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

    // this.gameGateway.server.to(`game:${pin}`).emit('question:start', {});
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
