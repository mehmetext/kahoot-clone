import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardItemResponseDto {
  @ApiProperty({
    description: 'The player id of the leaderboard item',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  playerId: string;

  @ApiProperty({
    description: 'The score of the leaderboard item',
    example: 100,
  })
  score: number;

  @ApiProperty({
    description: 'The nickname of the leaderboard item',
    example: 'John Doe',
    nullable: true,
  })
  nickname: string | null;
}
