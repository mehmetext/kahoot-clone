import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: 'Room 1' })
  name?: string;
}
