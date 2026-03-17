import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
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
    if (!payload || !payload.pin) {
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.status !== GameStatus.WAITING) {
      return { success: false, message: 'Game is not waiting' };
    }

    await this.gameQueue.remove(`clear-game-${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}`, {
      status: GameStatus.STARTING,
      startedAt: new Date().toISOString(),
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

    return { success: true, message: 'Game started' };
  }

  @SubscribeMessage('host:end-game')
  async handleHostEndGame(@MessageBody() payload: { pin: string }) {
    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    await this.gameQueue.remove(`start-game-${payload.pin}`);
    await this.gameQueue.remove(`end-question-${payload.pin}`);

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
      return { success: false, message: 'Game not found' };
    }

    if (game.status !== GameStatus.WAITING) {
      return { success: false, message: 'Game is not waiting' };
    }

    const playerCount = await this.redis.hlen(`game:${payload.pin}:players`);

    if (playerCount > 99) {
      return { success: false, message: 'The game is full' };
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
      return { success: false, message: 'The player is already in the game' };
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

    return {
      success: true,
      data: {
        playerCount: playerCount + 1,
      },
    };
  }

  @SubscribeMessage('host:next-question')
  async handleHostNextQuestion(@MessageBody() payload: { pin: string }) {
    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.status !== GameStatus.ACTIVE) {
      return { success: false, message: 'The game is not active' };
    }

    /* Increment the current question index */
    await this.redis.hincrby(`game:${payload.pin}`, 'currentQuestionIndex', 1);

    /* Start the next question */
    await this.gameQueue.add(
      'next-question',
      { pin: payload.pin },
      {
        jobId: `start-question-${payload.pin}`,
        removeOnComplete: true,
      },
    );

    return { success: true, message: 'The next question is starting' };
  }
}
