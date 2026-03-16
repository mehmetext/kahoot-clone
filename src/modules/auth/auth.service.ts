import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import ms from 'ms';
import { CreateUserDto } from '../user/dtos/create-user.dto';
import { UserService } from '../user/user.service';
import { LoginResponseDto } from './dtos/login-response.dto';
import { UserResponseDto } from './dtos/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.findByEmail(email, {
      includePassword: true,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async login(user: UserResponseDto): Promise<LoginResponseDto> {
    const isDevelopment =
      this.configService.getOrThrow<string>('NODE_ENV') === 'development';

    const accessTokenExpiresIn = isDevelopment
      ? '15d'
      : this.configService.getOrThrow<ms.StringValue>('JWT_EXPIRES_IN');

    const accessToken = this.jwtService.sign(
      { userId: user.id },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessTokenExpiresIn,
      },
    );

    const refreshToken = randomUUID();

    const redisPipeline = this.redis.pipeline();

    redisPipeline.set(
      `refresh-token:${refreshToken}`,
      user.id,
      'EX',
      60 * 60 * 24 * 7,
    ); // 7 days
    redisPipeline.hset(`user:${user.id}`, {
      id: user.id,
      email: user.email,
      role: user.role,
    });
    redisPipeline.expire(
      `user:${user.id}`,
      isDevelopment ? 60 * 60 * 24 * 15 : 60 * 15, // 15 days in development, 15 minutes in production
    );
    await redisPipeline.exec();

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);

    return this.login(user);
  }
}
