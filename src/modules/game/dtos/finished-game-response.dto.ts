import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardItemResponseDto } from './leaderboard-item.dto';

export class FinishedGameResponseDto {
  @ApiProperty({
    description: 'The id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The pin of the game',
    example: '123456',
  })
  pin: string;

  @ApiProperty({
    description: 'The host id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  hostId: string;

  @ApiProperty({
    description: 'The quiz id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  quizId: string;

  @ApiProperty({
    description: 'The leaderboard of the game',
    type: [LeaderboardItemResponseDto],
  })
  leaderboard: LeaderboardItemResponseDto[];
}
