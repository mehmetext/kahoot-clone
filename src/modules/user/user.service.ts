import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: createUserDto.password,
        role: UserRole.USER,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    return user;
  }
}
