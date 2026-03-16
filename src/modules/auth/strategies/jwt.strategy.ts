import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import Redis from 'ioredis';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from 'src/generated/prisma/enums';
import { UserResponseDto } from '../dtos/user-response.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }): Promise<UserResponseDto> {
    const userFromRedis = await this.redis.hgetall(`user:${payload.sub}`);

    if (!userFromRedis || Object.keys(userFromRedis).length === 0) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: userFromRedis.id,
      email: userFromRedis.email,
      role: userFromRedis.role as UserRole,
    };
  }
}
