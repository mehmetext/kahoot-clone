import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponseGeneric } from 'src/common/decorators/api-created-response-generic.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomService } from './room.service';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  findAll() {
    return this.roomService.findAll();
  }

  @Post()
  @ApiCreatedResponseGeneric(RoomResponseDto)
  createRoom(@Body() createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    return this.roomService.createRoom(createRoomDto);
  }
}
