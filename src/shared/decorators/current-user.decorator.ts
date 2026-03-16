import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserResponseDto } from 'src/modules/auth/dtos/user-response.dto';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: UserResponseDto }>();

    return request.user;
  },
);
