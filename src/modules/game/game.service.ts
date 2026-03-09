import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { Question } from '../question/entities/question.entity';
import { RoomStatus } from '../room/entities/room.entity';

@Injectable()
export class GameService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async initRoom(roomCode: string, name: string, questions: Question[]) {
    const roomKey = `room:${roomCode}`;

    await this.redis.hset(roomKey, {
      status: RoomStatus.WAITING,
      name: name,
      currentQuestionIndex: 0,
      questions: JSON.stringify(questions),
    });

    await this.redis.expire(roomKey, 60 * 60 * 24); // 24 hours
  }

  async addPlayer(roomCode: string, playerName: string, socketId: string) {
    const playersKey = `room:${roomCode}:players`;
    const leaderboardKey = `room:${roomCode}:leaderboard`;

    await this.redis.hset(playersKey, {
      [socketId]: playerName,
    });

    await this.redis.zadd(leaderboardKey, 0, playerName);
  }

  async removePlayer(roomCode: string, socketId: string) {
    const playersKey = `room:${roomCode}:players`;
    const leaderboardKey = `room:${roomCode}:leaderboard`;

    const nickname = await this.redis.hget(playersKey, socketId);

    if (nickname) {
      await this.redis.hdel(playersKey, socketId);
      await this.redis.zrem(leaderboardKey, nickname);
    }

    return nickname;
  }

  async getLeaderboard(roomCode: string) {
    const leaderboardKey = `room:${roomCode}:leaderboard`;

    const results = await this.redis.zrevrange(
      leaderboardKey,
      0,
      -1,
      'WITHSCORES',
    );

    const leaderboard: { nickname: string; score: number }[] = [];

    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        nickname: results[i],
        score: parseInt(results[i + 1], 10),
      });
    }

    return leaderboard;
  }

  async incrementScore(roomCode: string, nickname: string, points: number) {
    const leaderboardKey = `room:${roomCode}:leaderboard`;
    await this.redis.zincrby(leaderboardKey, points, nickname);
  }

  async getCurrentQuestion(roomCode: string) {
    const roomKey = `room:${roomCode}`;
    const roomData = await this.redis.hmget(
      roomKey,
      'currentQuestionIndex',
      'questions',
    );

    if (!roomData[0] || !roomData[1]) {
      throw new NotFoundException('Room not found');
    }

    const currentIndex = parseInt(roomData[0], 10);

    const questions = roomData[1]
      ? (JSON.parse(roomData[1]) as Question[])
      : ([] as Question[]);

    return {
      question: questions[currentIndex],
      currentIndex,
      totalQuestions: questions.length,
    };
  }

  async nextQuestion(roomCode: string) {
    const roomKey = `room:${roomCode}`;
    await this.redis.hincrby(roomKey, 'currentQuestionIndex', 1);
  }
}
