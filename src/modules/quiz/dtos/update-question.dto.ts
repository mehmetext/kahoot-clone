import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The title of the question',
    example: 'What is the capital of France?',
  })
  title: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The order of the question',
    example: 1,
  })
  order: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    description: 'The time limit in seconds of the question',
    example: 30,
    nullable: true,
  })
  timeLimitInSeconds?: number;
}
