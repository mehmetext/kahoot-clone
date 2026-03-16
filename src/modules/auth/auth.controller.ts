import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { CreateUserDto } from '../user/dtos/create-user.dto';
import { AuthService } from './auth.service';
import { LoginResponseDto } from './dtos/login-response.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { UserResponseDto } from './dtos/user-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  @ApiBody({ type: LoginDto })
  @ApiOkResponseGeneric(LoginResponseDto)
  login(@CurrentUser() user: UserResponseDto): Promise<LoginResponseDto> {
    return this.authService.login(user);
  }

  @Post('register')
  @ApiOkResponseGeneric(LoginResponseDto)
  register(@Body() createUserDto: CreateUserDto): Promise<LoginResponseDto> {
    return this.authService.register(createUserDto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponseGeneric(UserResponseDto)
  me(@CurrentUser() user: UserResponseDto): UserResponseDto {
    return user;
  }

  @Post('refresh-token')
  @ApiOkResponseGeneric(LoginResponseDto)
  refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<LoginResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
