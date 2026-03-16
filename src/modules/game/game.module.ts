import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameProcessor } from './game.processor';
import { GameService } from './game.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'game' })],
  controllers: [GameController],
  providers: [GameService, GameProcessor],
})
export class GameModule {}
