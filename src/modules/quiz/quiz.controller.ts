import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { QuizResponseDto } from './dtos/quiz-response.dto';
import { QuizService } from './quiz.service';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @ApiOkResponseGeneric(QuizResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  create(
    @Body() createQuizDto: CreateQuizDto,
    @Req() req: Request & { user: UserResponseDto },
  ): Promise<QuizResponseDto> {
    return this.quizService.create(createQuizDto, req.user.id);
  }

  @Get()
  @ApiOkResponseGeneric(QuizResponseDto, { isArray: true })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async findAll(
    @Req() req: Request & { user: UserResponseDto },
  ): Promise<QuizResponseDto[]> {
    const quizzes = await this.quizService.findAll(req.user.id);
    return quizzes;
  }

  @Get(':id')
  @ApiOkResponseGeneric(QuizResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async findById(@Param('id') id: string): Promise<QuizResponseDto> {
    const quiz = await this.quizService.findById(id);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }
}
