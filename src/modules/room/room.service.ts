import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room } from './entities/room.entity';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async findAll() {
    const rooms = await this.roomRepository.find({
      where: {
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });
    return rooms;
  }

  async createRoom(createRoomDto: CreateRoomDto) {
    let roomCode = this.generateRoomCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const existingRoom = await this.roomRepository.findOne({
        where: { roomCode },
      });
      if (!existingRoom) {
        isUnique = true;
      } else {
        roomCode = this.generateRoomCode();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new BadRequestException('Room code is not unique');
    }

    const room = this.roomRepository.create({
      roomCode,
      name: createRoomDto.name,
    });

    const savedRoom = await this.roomRepository.save(room);

    return savedRoom;
  }

  private generateRoomCode(length: number = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }
}
