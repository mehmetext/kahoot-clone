import { ApiProperty } from '@nestjs/swagger';
import { RoomStatus } from '../entities/room.entity';

export class RoomResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Room 1', nullable: true })
  name?: string;

  @ApiProperty({ example: 'ABC123' })
  roomCode: string;

  @ApiProperty({ example: 'WAITING' })
  status: RoomStatus;

  @ApiProperty({ example: '2026-03-09T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-09T12:00:00.000Z' })
  updatedAt: Date;
}
