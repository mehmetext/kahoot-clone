import { ApiProperty } from '@nestjs/swagger';
import { GameStatus } from '../enums/game-status.enum';

export class GameQuestionOptionResponseDto {
  @ApiProperty({
    description: 'The id of the option',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The option',
    example: 'Paris',
  })
  option: string;

  @ApiProperty({
    description: 'The is correct of the option',
    example: true,
  })
  isCorrect: boolean;
}

export class GameQuestionResponseDto {
  @ApiProperty({
    description: 'The id of the question',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The title of the question',
    example: 'Question 1',
  })
  title: string;

  @ApiProperty({
    description: 'The options of the question',
    type: [GameQuestionOptionResponseDto],
  })
  options: GameQuestionOptionResponseDto[];

  @ApiProperty({
    description: 'The time limit in seconds of the question',
    example: 30,
    nullable: true,
  })
  timeLimitInSeconds: number | null;

  @ApiProperty({
    description: 'The order of the question',
    example: 1,
  })
  order: number;
}

export class GameResponseDto {
  @ApiProperty({
    description: 'The pin of the game',
    example: '123456',
  })
  pin: string;

  @ApiProperty({
    description: 'The name of the game',
    example: 'Game 1',
  })
  name: string;

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
    example: GameStatus.WAITING,
    enum: GameStatus,
  })
  status: GameStatus;

  @ApiProperty({
    description: 'The question count of the game',
    example: 10,
  })
  questionCount: number;

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

  @ApiProperty({
    description: 'The questions of the game',
    type: [GameQuestionResponseDto],
  })
  questions: GameQuestionResponseDto[];
}
