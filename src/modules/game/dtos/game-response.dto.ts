import { ApiProperty } from '@nestjs/swagger';
import { GameStatus } from '../enums/game-status.enum';

export class GameResponseDto {
  @ApiProperty({
    description: 'The pin of the game',
    example: '123456',
  })
  pin: string;

  @ApiProperty({
    description: 'The quiz id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  quizId: string;

  @ApiProperty({
    description: 'The host id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  hostId: string;

  @ApiProperty({
    description: 'The status of the game',
    example: 'WAITING',
  })
  status: GameStatus;

  @ApiProperty({
    description: 'The current question index of the game',
    example: 0,
  })
  currentQuestionIndex: number;

  @ApiProperty({
    description: 'The started at of the game',
    example: '2026-03-16T16:45:10.000Z',
  })
  startedAt: Date | null;
}
