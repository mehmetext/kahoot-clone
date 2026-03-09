import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response';

@Injectable()
export class BaseResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | undefined
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | undefined> {
    return next.handle().pipe(
      map((data: T) => {
        if (data === undefined) {
          return;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
