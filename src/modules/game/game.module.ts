import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameProcessor } from './game.processor';
import { GameService } from './game.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'game' })],
  controllers: [GameController],
  providers: [GameService, GameProcessor, GameGateway],
})
export class GameModule {}
