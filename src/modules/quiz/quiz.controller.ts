import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { QuizResponseDto } from './dtos/quiz-response.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
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
}
