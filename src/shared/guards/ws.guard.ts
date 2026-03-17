import { InjectRedis } from '@nestjs-modules/ioredis';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Socket } from 'socket.io';
import { UserRole } from 'src/generated/prisma/enums';
import { UserResponseDto } from 'src/modules/auth/dtos/user-response.dto';

@Injectable()
export class WsGuard implements CanActivate {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth.token as string;

    if (!token) {
      throw new WsException('Unauthorized');
    }

    const userFromRedis = await this.redis.hgetall(`user:${token}`);

    if (!userFromRedis || Object.keys(userFromRedis).length === 0) {
      throw new WsException('Unauthorized');
    }

    (client.data as { user: UserResponseDto }).user = {
      id: userFromRedis.id,
      email: userFromRedis.email,
      role: userFromRedis.role as UserRole,
    };

    return true;
  }
}
