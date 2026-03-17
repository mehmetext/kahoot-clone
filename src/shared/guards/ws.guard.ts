import { InjectRedis } from '@nestjs-modules/ioredis';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Socket } from 'socket.io';
import { UserRole } from 'src/generated/prisma/enums';
import { UserResponseDto } from 'src/modules/auth/dtos/user-response.dto';

@Injectable()
export class WsGuard implements CanActivate {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const decoded = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const userFromRedis = await this.redis.hgetall(`user:${decoded.sub}`);

      if (!userFromRedis || Object.keys(userFromRedis).length === 0) {
        throw new WsException('Unauthorized');
      }

      (client.data as { user: UserResponseDto }).user = {
        id: userFromRedis.id,
        email: userFromRedis.email,
        role: userFromRedis.role as UserRole,
      };

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException('Unauthorized');
    }
  }
}
