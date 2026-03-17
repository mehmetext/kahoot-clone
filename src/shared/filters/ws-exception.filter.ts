import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException, Error)
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();

    const error =
      exception instanceof WsException
        ? exception.getError()
        : { message: 'Internal server error' };

    const errorMessage =
      typeof error === 'string'
        ? error
        : (error as { message: string }).message;

    this.logger.error(
      `WebSocket Error on client ${client.id}: ${errorMessage}`,
    );

    client.emit('exception', {
      success: false,
      message: errorMessage,
    });
  }
}
