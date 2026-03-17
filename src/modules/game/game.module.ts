import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameProcessor } from './game.processor';
import { GameService } from './game.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'game' }), JwtModule],
  controllers: [GameController],
  providers: [GameService, GameProcessor, GameGateway],
})
export class GameModule {}
