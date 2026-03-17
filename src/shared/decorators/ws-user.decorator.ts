import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserResponseDto } from 'src/modules/auth/dtos/user-response.dto';

export const WsUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const client: Socket = ctx.switchToWs().getClient<Socket>();

    const user = (client.data as { user: UserResponseDto }).user;

    if (!user) {
      throw new WsException('Unauthorized');
    }

    return user;
  },
);
