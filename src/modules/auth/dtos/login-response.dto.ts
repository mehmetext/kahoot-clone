import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'The access token of the user',
    example: '1234567890',
  })
  accessToken: string;

  @ApiProperty({
    description: 'The refresh token of the user',
    example: '1234567890',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'The user of the user',
  })
  user: UserResponseDto;
}
