import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerResult } from '../question/entities/player-result.entity';
import { Room } from './entities/room.entity';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room, PlayerResult])],
  controllers: [RoomController],
  providers: [RoomService],
})
export class RoomModule {}
