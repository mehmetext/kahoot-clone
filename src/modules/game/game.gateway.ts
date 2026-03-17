import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import {
  forwardRef,
  Inject,
  Logger,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { WsUser } from 'src/shared/decorators/ws-user.decorator';
import { WsExceptionFilter } from 'src/shared/filters/ws-exception.filter';
import { WsGuard } from 'src/shared/guards/ws.guard';
import { calculateScore } from 'src/shared/utils/ calculate-score';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { GameStatus } from './enums/game-status.enum';
import {
  GAME_COUNTDOWN_SECONDS,
  QUESTION_END_TIME_LIMIT_IN_SECONDS,
} from './game.constants';
import { GameService } from './game.service';

@WebSocketGateway({ namespace: 'game' })
@UseFilters(WsExceptionFilter)
export class GameGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('game') private readonly gameQueue: Queue,
  ) {}

  handleConnection(client: Socket) {
    client.on('disconnecting', async () => {
      await this.cleanupSocketFromGames(client);
    });
  }

  private async cleanupSocketFromGames(client: Socket) {
    const rooms = Array.from(client.rooms ?? []);

    for (const room of rooms) {
      if (room.startsWith('game:')) {
        const pin = room.split(':')[1];
        await this.redis.hdel(`game:${pin}:sockets`, client.id);
      }
    }
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('host:join-game')
  async handleHostJoinGame(
    @MessageBody() payload: { pin: string },
    @ConnectedSocket() client: Socket,
    @WsUser() user: UserResponseDto,
  ) {
    if (!payload?.pin) {
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      return { success: false, message: 'You are not the host of this game' };
    }

    await client.join(`game:${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}:sockets`, {
      [client.id]: user.id,
    });

    const playerCount = await this.redis.hlen(`game:${payload.pin}:players`);

    return {
      success: true,
      data: { playerCount, status: game.status },
    };
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('host:start-game')
  async handleHostStartGame(
    @MessageBody() payload: { pin: string },
    @WsUser() user: UserResponseDto,
  ) {
    if (!payload || !payload.pin) {
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      return { success: false, message: 'You are not the host of this game' };
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
      'next-question',
      { pin: payload.pin },
      {
        delay: GAME_COUNTDOWN_SECONDS * 1000,
        jobId: `next-question-${payload.pin}`,
        removeOnComplete: true,
      },
    );

    this.server.to(`game:${payload.pin}`).emit('game:starting', {
      countdown: GAME_COUNTDOWN_SECONDS,
    });

    return { success: true, message: 'Game started' };
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('host:end-game')
  async handleHostEndGame(
    @MessageBody() payload: { pin: string },
    @WsUser() user: UserResponseDto,
  ) {
    if (!payload || !payload.pin) {
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      return { success: false, message: 'You are not the host of this game' };
    }

    await this.gameService.endGame(payload.pin);
    return { success: true, message: 'Game ended' };
  }

  @SubscribeMessage('player:join')
  async handlePlayerJoin(
    @MessageBody()
    payload: { pin: string; nickname: string; playerId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload?.pin || !payload?.nickname) {
      return { success: false, message: 'Pin and nickname are required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    const playerCount = await this.redis.hlen(`game:${payload.pin}:players`);

    let playerId: string;
    let isReconnecting = false;

    // Verify reconnection: playerId must exist in the server-issued hash
    if (payload.playerId) {
      const existingNickname = await this.redis.hget(
        `game:${payload.pin}:players`,
        payload.playerId,
      );
      if (existingNickname) {
        playerId = payload.playerId;
        isReconnecting = true;
      }
    }

    if (!isReconnecting) {
      if (game.status !== GameStatus.WAITING) {
        return { success: false, message: 'Game is not waiting' };
      }

      if (playerCount > 99) {
        return { success: false, message: 'The game is full' };
      }

      const existingNickname = await this.redis.sismember(
        `game:${payload.pin}:nicknames`,
        payload.nickname,
      );

      if (existingNickname) {
        return { success: false, message: 'Nickname is already taken' };
      }

      playerId = randomUUID();

      const redisPipeline = this.redis.pipeline();

      redisPipeline.hset(`game:${payload.pin}:players`, {
        [playerId]: payload.nickname,
      });
      redisPipeline.sadd(`game:${payload.pin}:nicknames`, payload.nickname);

      await redisPipeline.exec();
    }

    await client.join(`game:${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}:sockets`, {
      [client.id]: playerId!,
    });

    this.server.to(`game:${payload.pin}`).emit('player:joined', {
      nickname: payload.nickname,
      playerCount: isReconnecting ? playerCount : playerCount + 1,
    });

    return {
      success: true,
      data: {
        playerId: playerId!,
        playerCount: isReconnecting ? playerCount : playerCount + 1,
      },
    };
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('host:next-question')
  async handleHostNextQuestion(
    @MessageBody() payload: { pin: string },
    @WsUser() user: UserResponseDto,
  ) {
    if (!payload || !payload.pin) {
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      return { success: false, message: 'You are not the host of this game' };
    }

    if (game.status !== GameStatus.REVIEWING) {
      return { success: false, message: 'The game is not active' };
    }

    /* Increment the current question index */
    await this.redis.hincrby(`game:${payload.pin}`, 'currentQuestionIndex', 1);

    /* Start the next question */
    await this.gameQueue.add(
      'next-question',
      { pin: payload.pin },
      {
        jobId: `next-question-${payload.pin}`,
        removeOnComplete: true,
      },
    );

    return { success: true, message: 'The next question is starting' };
  }

  @SubscribeMessage('player:answer')
  async handlePlayerAnswer(
    @MessageBody() payload: { pin: string; answerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload || !payload.pin || !payload.answerId) {
      return { success: false, message: 'Pin and answer are required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.status !== GameStatus.ACTIVE) {
      return { success: false, message: 'The game is not active' };
    }

    const playerId = await this.redis.hget(
      `game:${payload.pin}:sockets`,
      client.id,
    );

    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const isAnswered = await this.redis.hget(
      `game:${payload.pin}:answered:${game.currentQuestionIndex}`,
      playerId,
    );

    if (isAnswered) {
      return {
        success: false,
        message: 'The player has already answered the question',
      };
    }

    const currentQuestion = game.questions[game.currentQuestionIndex];

    const correctAnswerId = currentQuestion.options.find(
      (option) => option.isCorrect,
    )?.id;

    const isCorrect = correctAnswerId === payload.answerId;

    if (isCorrect) {
      const score = calculateScore(
        new Date().getTime(),
        new Date(game.currentQuestionStartedAt!).getTime(),
        currentQuestion.timeLimitInSeconds ??
          QUESTION_END_TIME_LIMIT_IN_SECONDS,
        isCorrect,
      );

      const redisPipeline = this.redis.pipeline();
      redisPipeline.zincrby(`game:${payload.pin}:scores`, score, playerId);
      redisPipeline.zincrby(
        `game:${payload.pin}:current-question-scores`,
        score,
        playerId,
      );
      redisPipeline.hset(
        `game:${payload.pin}:answered:${game.currentQuestionIndex}`,
        { [playerId]: payload.answerId },
      );
      await redisPipeline.exec();
    } else {
      const redisPipeline = this.redis.pipeline();
      redisPipeline.zincrby(`game:${payload.pin}:scores`, 0, playerId);
      redisPipeline.zincrby(
        `game:${payload.pin}:current-question-scores`,
        0,
        playerId,
      );
      redisPipeline.hset(
        `game:${payload.pin}:answered:${game.currentQuestionIndex}`,
        { [playerId]: payload.answerId },
      );
      await redisPipeline.exec();
    }

    return { success: true, message: 'The answer is received' };
  }
}
