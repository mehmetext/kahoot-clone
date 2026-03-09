import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { RoomCreatedListener } from './listeners/room-created.listener';

@Module({
  imports: [],
  controllers: [],
  providers: [RoomCreatedListener, GameService],
  exports: [],
})
export class GameModule {}
