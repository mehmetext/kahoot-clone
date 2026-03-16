import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
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

  async findByEmail(
    email: string,
    { includePassword = false }: { includePassword?: boolean } = {},
  ) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        password: includePassword ? true : undefined,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }
}
