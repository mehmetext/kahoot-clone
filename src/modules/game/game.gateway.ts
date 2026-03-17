import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
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
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { WsUser } from 'src/shared/decorators/ws-user.decorator';
import { WsExceptionFilter } from 'src/shared/filters/ws-exception.filter';
import { WsGuard } from 'src/shared/guards/ws.guard';
import { calculateScore } from 'src/shared/utils/calculate-score';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { GameStatus } from './enums/game-status.enum';
import {
  GAME_COUNTDOWN_SECONDS,
  QUESTION_END_TIME_LIMIT_IN_SECONDS,
} from './game.constants';
import { GameService } from './game.service';

@WebSocketGateway({
  namespace: 'game',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
  },
})
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
    this.logger.debug(`socket connected (socketId=${client.id})`);
    client.on('disconnecting', async () => {
      this.logger.debug(
        `socket disconnecting (socketId=${client.id}, rooms=${Array.from(client.rooms ?? []).join(',')})`,
      );
      await this.cleanupSocketFromGames(client);
    });
  }

  private async cleanupSocketFromGames(client: Socket) {
    const rooms = Array.from(client.rooms ?? []);

    for (const room of rooms) {
      if (room.startsWith('game:')) {
        const pin = room.split(':')[1];
        this.logger.debug(
          `cleanup socket mapping (pin=${pin}, socketId=${client.id})`,
        );
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
      this.logger.warn(
        `host:join-game rejected (reason=missing_pin, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `host:join-game rejected (reason=game_not_found, pin=${payload.pin}, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      this.logger.warn(
        `host:join-game rejected (reason=not_host, pin=${payload.pin}, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'You are not the host of this game' };
    }

    if (game.status === GameStatus.ENDED) {
      this.logger.warn(
        `host:join-game rejected (reason=already_ended, pin=${payload.pin}, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'Game is already ended' };
    }

    await client.join(`game:${payload.pin}`);
    this.logger.log(
      `host joined room (pin=${payload.pin}, socketId=${client.id}, userId=${user.id}, status=${game.status})`,
    );

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
    @ConnectedSocket() client: Socket,
    @WsUser() user: UserResponseDto,
  ) {
    if (!payload || !payload.pin) {
      this.logger.warn(
        `host:start-game rejected (reason=missing_pin, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `host:start-game rejected (reason=game_not_found, pin=${payload.pin}, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      this.logger.warn(
        `host:start-game rejected (reason=not_host, pin=${payload.pin}, socketId=${client.id}, userId=${user.id})`,
      );
      return { success: false, message: 'You are not the host of this game' };
    }

    if (game.status !== GameStatus.WAITING) {
      this.logger.warn(
        `host:start-game rejected (reason=invalid_status, pin=${payload.pin}, socketId=${client.id}, userId=${user.id}, status=${game.status})`,
      );
      return { success: false, message: 'Game is not waiting' };
    }

    await client.join(`game:${payload.pin}`);
    await this.redis.hset(`game:${payload.pin}:sockets`, {
      [client.id]: user.id,
    });

    await this.gameQueue.remove(`clear-game-${payload.pin}`);
    this.logger.log(
      `game starting scheduled (pin=${payload.pin}, socketId=${client.id}, userId=${user.id}, countdown=${GAME_COUNTDOWN_SECONDS})`,
    );

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
      this.logger.warn(
        `host:end-game rejected (reason=missing_pin, userId=${user.id})`,
      );
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `host:end-game rejected (reason=game_not_found, pin=${payload.pin}, userId=${user.id})`,
      );
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      this.logger.warn(
        `host:end-game rejected (reason=not_host, pin=${payload.pin}, userId=${user.id})`,
      );
      return { success: false, message: 'You are not the host of this game' };
    }

    if (game.status === GameStatus.ENDED) {
      this.logger.warn(
        `host:end-game rejected (reason=already_ended, pin=${payload.pin}, userId=${user.id})`,
      );
      return { success: false, message: 'Game is already ended' };
    }

    this.logger.log(`host ending game (pin=${payload.pin}, userId=${user.id})`);
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
      this.logger.warn(
        `player:join rejected (reason=missing_fields, socketId=${client.id}, pin=${payload?.pin ?? 'null'})`,
      );
      return { success: false, message: 'Pin and nickname are required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `player:join rejected (reason=game_not_found, pin=${payload.pin}, socketId=${client.id})`,
      );
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
        if (existingNickname !== payload.nickname) {
          this.logger.warn(
            `player:join rejected (reason=nickname_mismatch, pin=${payload.pin}, socketId=${client.id}, playerId=${payload.playerId})`,
          );
          return {
            success: false,
            message: 'Nickname does not match this playerId',
          };
        }
        playerId = payload.playerId;
        isReconnecting = true;
      }
    }

    if (!isReconnecting) {
      if (game.status !== GameStatus.WAITING) {
        this.logger.warn(
          `player:join rejected (reason=invalid_status, pin=${payload.pin}, socketId=${client.id}, status=${game.status})`,
        );
        return { success: false, message: 'Game is not waiting' };
      }

      if (playerCount > 99) {
        this.logger.warn(
          `player:join rejected (reason=game_full, pin=${payload.pin}, socketId=${client.id})`,
        );
        return { success: false, message: 'The game is full' };
      }

      playerId = randomUUID();

      const redisPipeline = this.redis.pipeline();

      redisPipeline.hset(`game:${payload.pin}:players`, {
        [playerId]: payload.nickname,
      });
      redisPipeline.sadd(`game:${payload.pin}:nicknames`, payload.nickname);

      const pipelineResults = await redisPipeline.exec();
      const saddResult = pipelineResults?.[1]?.[1];

      if (saddResult !== 1) {
        await this.redis.hdel(`game:${payload.pin}:players`, playerId);
        this.logger.warn(
          `player:join rejected (reason=nickname_taken, pin=${payload.pin}, socketId=${client.id}, nickname=${payload.nickname})`,
        );
        return { success: false, message: 'Nickname is already taken' };
      }
    }

    await client.join(`game:${payload.pin}`);

    await this.redis.hset(`game:${payload.pin}:sockets`, {
      [client.id]: playerId!,
    });

    const players = await this.redis.hgetall(`game:${payload.pin}:players`);

    this.server.to(`game:${payload.pin}`).emit('player:joined', {
      nickname: payload.nickname,
      playerCount: isReconnecting ? playerCount : playerCount + 1,
    });

    this.logger.log(
      `player joined (pin=${payload.pin}, socketId=${client.id}, playerId=${playerId!}, reconnect=${isReconnecting})`,
    );

    return {
      success: true,
      data: {
        playerId: playerId!,
        playerCount: isReconnecting ? playerCount : playerCount + 1,
        players: Object.values(players),
        game: {
          name: game.name,
          status: game.status,
        },
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
      this.logger.warn(
        `host:next-question rejected (reason=missing_pin, userId=${user.id})`,
      );
      return { success: false, message: 'Pin is required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `host:next-question rejected (reason=game_not_found, pin=${payload.pin}, userId=${user.id})`,
      );
      return { success: false, message: 'Game not found' };
    }

    if (game.hostId !== user.id) {
      this.logger.warn(
        `host:next-question rejected (reason=not_host, pin=${payload.pin}, userId=${user.id})`,
      );
      return { success: false, message: 'You are not the host of this game' };
    }

    if (game.status !== GameStatus.REVIEWING) {
      this.logger.warn(
        `host:next-question rejected (reason=invalid_status, pin=${payload.pin}, userId=${user.id}, status=${game.status})`,
      );
      return { success: false, message: 'The game is not active' };
    }

    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      this.logger.warn(
        `host:next-question rejected (reason=no_more_questions, pin=${payload.pin}, userId=${user.id}, index=${game.currentQuestionIndex}, total=${game.questions.length})`,
      );
      return { success: false, message: 'No more questions' };
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

    this.logger.log(
      `next question requested (pin=${payload.pin}, userId=${user.id}, fromIndex=${game.currentQuestionIndex})`,
    );
    return { success: true, message: 'The next question is starting' };
  }

  @SubscribeMessage('player:answer')
  async handlePlayerAnswer(
    @MessageBody() payload: { pin: string; answerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload || !payload.pin || !payload.answerId) {
      this.logger.warn(
        `player:answer rejected (reason=missing_fields, socketId=${client.id}, pin=${payload?.pin ?? 'null'})`,
      );
      return { success: false, message: 'Pin and answer are required' };
    }

    const game = await this.gameService.getGame(payload.pin);

    if (!game) {
      this.logger.warn(
        `player:answer rejected (reason=game_not_found, pin=${payload.pin}, socketId=${client.id})`,
      );
      return { success: false, message: 'Game not found' };
    }

    if (game.status !== GameStatus.ACTIVE) {
      this.logger.warn(
        `player:answer rejected (reason=invalid_status, pin=${payload.pin}, socketId=${client.id}, status=${game.status})`,
      );
      return { success: false, message: 'The game is not active' };
    }

    const playerId = await this.redis.hget(
      `game:${payload.pin}:sockets`,
      client.id,
    );

    if (!playerId) {
      this.logger.warn(
        `player:answer rejected (reason=socket_not_mapped, pin=${payload.pin}, socketId=${client.id})`,
      );
      return { success: false, message: 'Player not found' };
    }

    const playerNickname = await this.redis.hget(
      `game:${payload.pin}:players`,
      playerId,
    );
    if (!playerNickname) {
      this.logger.warn(
        `player:answer rejected (reason=player_missing, pin=${payload.pin}, socketId=${client.id}, playerId=${playerId})`,
      );
      return { success: false, message: 'Player not found' };
    }

    const isAnswered = await this.redis.hget(
      `game:${payload.pin}:answered:${game.currentQuestionIndex}`,
      playerId,
    );

    if (isAnswered) {
      this.logger.warn(
        `player:answer rejected (reason=already_answered, pin=${payload.pin}, playerId=${playerId}, qIndex=${game.currentQuestionIndex})`,
      );
      return {
        success: false,
        message: 'The player has already answered the question',
      };
    }

    const currentQuestion = game.questions[game.currentQuestionIndex];

    const isValidOption = currentQuestion.options.some(
      (option) => option.id === payload.answerId,
    );

    if (!isValidOption) {
      this.logger.warn(
        `player:answer rejected (reason=invalid_option, pin=${payload.pin}, playerId=${playerId}, qIndex=${game.currentQuestionIndex}, answerId=${payload.answerId})`,
      );
      return { success: false, message: 'Invalid answer option' };
    }

    const correctAnswerId = currentQuestion.options.find(
      (option) => option.isCorrect,
    )?.id;

    const isCorrect = correctAnswerId === payload.answerId;

    const score = calculateScore(
      new Date().getTime(),
      new Date(game.currentQuestionStartedAt!).getTime(),
      currentQuestion.timeLimitInSeconds ?? QUESTION_END_TIME_LIMIT_IN_SECONDS,
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

    this.logger.debug(
      `player answered (pin=${payload.pin}, playerId=${playerId}, qIndex=${game.currentQuestionIndex}, correct=${isCorrect}, score=${score})`,
    );
    const answeredCount = await this.redis.hlen(
      `game:${payload.pin}:answered:${game.currentQuestionIndex}`,
    );
    const playerCount = await this.redis.hlen(`game:${payload.pin}:players`);

    if (answeredCount === playerCount) {
      this.logger.log(
        `all players answered; ending question early (pin=${payload.pin}, qIndex=${game.currentQuestionIndex}, answered=${answeredCount})`,
      );
      await this.gameQueue.remove(`end-question-${payload.pin}`);
      await this.gameQueue.add(
        'end-question',
        { pin: payload.pin },
        {
          jobId: `end-question-${payload.pin}`,
          removeOnComplete: true,
        },
      );
    }

    return { success: true, message: 'The answer is received' };
  }
}
