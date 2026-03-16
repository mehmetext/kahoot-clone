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

  async handleHostEndGame(@MessageBody() payload: { pin: string }) {
    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    await this.gameQueue.remove(`start-game-${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}`, {
      status: GameStatus.ENDED,
    });

    const leaderboard = await this.gameService.getLeaderboard(payload.pin);

    this.server.to(`game:${payload.pin}`).emit('game:ended', {
      leaderboard,
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

    const playerCount = await this.redis.hlen(`game:${payload.pin}:players`);

    if (playerCount > 99) {
      this.server.to(`game:${payload.pin}`).emit('error', {
        message: 'The game is full',
      });
      return;
    }

    const existingPlayerId = await this.redis.hget(
      `game:${payload.pin}:players`,
      payload.playerId,
    );

    const existingNickname = await this.redis.sismember(
      `game:${payload.pin}:nicknames`,
      payload.nickname,
    );

    if (existingPlayerId || existingNickname) {
      this.server.to(`game:${payload.pin}`).emit('error', {
        message: 'The player is already in the game',
      });
      return;
    }

    const redisPipeline = this.redis.pipeline();

    redisPipeline.hset(`game:${payload.pin}:players`, {
      [payload.playerId]: payload.nickname,
    });
    redisPipeline.sadd(`game:${payload.pin}:nicknames`, payload.nickname);

    await redisPipeline.exec();

    this.server.to(`game:${payload.pin}`).emit('player:joined', {
      nickname: payload.nickname,
      playerCount: playerCount + 1,
    });
  }
}
