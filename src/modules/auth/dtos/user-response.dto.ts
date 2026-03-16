import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/generated/prisma/enums';

export class UserResponseDto {
  @ApiProperty({
    description: 'The id of the user',
    example: '1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'test@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The role of the user',
    example: 'USER',
  })
  role: UserRole;
}
