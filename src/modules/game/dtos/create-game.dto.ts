import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    description: 'The quiz id of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  quizId: string;
}
