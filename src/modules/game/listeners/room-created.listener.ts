import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Question } from 'src/modules/question/entities/question.entity';
import { GameService } from '../game.service';

interface RoomCreatedEvent {
  roomCode: string;
  name: string;
  questions: Question[];
}

@Injectable()
export class RoomCreatedListener {
  constructor(private readonly gameService: GameService) {}

  @OnEvent('room.created')
  async handleRoomCreatedEvent(event: RoomCreatedEvent) {
    console.log('Room created event received', event.roomCode);

    await this.gameService.initRoom(
      event.roomCode,
      event.name,
      event.questions,
    );

    console.log('Room initialized', event.roomCode);
  }
}
