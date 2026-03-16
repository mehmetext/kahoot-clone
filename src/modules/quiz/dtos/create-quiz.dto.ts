import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The name of the quiz',
    example: 'Quiz 1',
  })
  name: string;
}
