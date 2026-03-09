import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LeaderboardService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async addScore(username: string, score: number) {
    await this.redis.zadd('global_leaderboard', score, username);

    return { message: `${username} için skor eklendi/güncellendi: ${score}` };
  }

  async getTopPlayers() {
    const rawData = await this.redis.zrange(
      'global_leaderboard',
      0,
      -1,
      'REV',
      'WITHSCORES',
    );

    console.log(rawData);

    const leaderboard: { username: string; score: number }[] = [];

    for (let i = 0; i < rawData.length; i += 2) {
      const username = rawData[i];
      const score = rawData[i + 1];

      leaderboard.push({
        username,
        score: parseInt(score),
      });
    }

    return leaderboard;
  }

  async getPlayerRank(username: string) {
    const rank = await this.redis.zrevrank('global_leaderboard', username);

    if (!rank) {
      throw new NotFoundException(`${username} bulunamadı`);
    }

    const score = await this.redis.zscore('global_leaderboard', username);

    return {
      username,
      rank: rank + 1,
      score: score ? parseInt(score) : null,
    };
  }
}
