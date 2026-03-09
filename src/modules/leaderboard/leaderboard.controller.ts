import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  async getTopPlayers() {
    return this.leaderboardService.getTopPlayers();
  }

  @Post('add-score')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        score: { type: 'number' },
      },
    },
  })
  async addScore(@Body() body: { username: string; score: number }) {
    return this.leaderboardService.addScore(body.username, body.score);
  }
}
