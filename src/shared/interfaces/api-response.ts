import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T> {
  @ApiProperty({
    description: 'Whether the request was successful',
    example: true,
  })
  success: boolean;

  data: T;
}
