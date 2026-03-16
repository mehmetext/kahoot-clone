import { ApiProperty } from '@nestjs/swagger';

export class QuizResponseDto {
  @ApiProperty({
    description: 'The id of the quiz',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The user id of the quiz',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'The name of the quiz',
    example: 'Quiz 1',
  })
  name: string;

  @ApiProperty({
    description: 'The created at of the quiz',
    example: '2026-03-16T16:45:10.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The updated at of the quiz',
    example: '2026-03-16T16:45:10.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'The deleted at of the quiz',
    example: '2026-03-16T16:45:10.000Z',
    nullable: true,
  })
  deletedAt: Date | null;

  /* @ApiProperty({
    description: 'The questions of the quiz',
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Question 1',
      },
    ],
  })
  questions: QuestionResponseDto[]; */
}
