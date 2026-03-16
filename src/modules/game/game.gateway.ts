import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { GameStatus } from './enums/game-status.enum';
import { GAME_COUNTDOWN_SECONDS } from './game.constants';
import { GameService } from './game.service';

@WebSocketGateway(80, { namespace: 'game' })
export class GameGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gameService: GameService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('game') private readonly gameQueue: Queue,
  ) {}

  @SubscribeMessage('host:start-game')
  async handleHostStartGame(@MessageBody() payload: { pin: string }) {
    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game is not waiting');
    }

    await this.gameQueue.remove(`clear-game-${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}`, {
      status: GameStatus.STARTING,
      startedAt: new Date(),
    });

    await this.gameQueue.add(
      'start-game',
      { pin: payload.pin },
      {
        delay: GAME_COUNTDOWN_SECONDS * 1000,
        jobId: `start-game-${payload.pin}`,
        removeOnComplete: true,
      },
    );

    this.server.to(`game:${payload.pin}`).emit('game:starting', {
      countdown: GAME_COUNTDOWN_SECONDS,
    });
  }

  @SubscribeMessage('player:join')
  async handlePlayerJoin(
    @MessageBody() payload: { pin: string; nickname: string; playerId: string },
  ) {
    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game is not waiting');
    }

    const redisPipeline = this.redis.pipeline();

    redisPipeline.hset(`game:${payload.pin}:players`, {
      [payload.playerId]: payload.nickname,
    });

    await redisPipeline.exec();
  }
}
