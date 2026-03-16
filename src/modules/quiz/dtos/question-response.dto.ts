import { ApiProperty } from '@nestjs/swagger';

export class QuestionOptionResponseDto {
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

export class QuestionResponseDto {
  @ApiProperty({
    description: 'The id of the question',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The title of the question',
    example: 'What is the capital of France?',
  })
  title: string;

  @ApiProperty({
    description: 'The options of the question',
    type: [QuestionOptionResponseDto],
  })
  options: QuestionOptionResponseDto[];

  @ApiProperty({
    description: 'The order of the question',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'The time limit in seconds of the question',
    example: 30,
    nullable: true,
  })
  timeLimitInSeconds: number | null;

  @ApiProperty({
    description: 'The created at of the question',
    example: '2026-03-16T16:45:10.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The updated at of the question',
    example: '2026-03-16T16:45:10.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'The deleted at of the question',
    example: '2026-03-16T16:45:10.000Z',
    nullable: true,
  })
  deletedAt: Date | null;
}
