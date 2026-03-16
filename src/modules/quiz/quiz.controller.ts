import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ApiOkResponseGeneric } from 'src/shared/decorators/api-ok-response-generic.decorator';
import { UserResponseDto } from '../auth/dtos/user-response.dto';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { UpdateQuestionOptionsDto } from './dtos/update-question-option.dto';
import { QuestionResponseDto } from './dtos/question-response.dto';
import { QuizResponseDto } from './dtos/quiz-response.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';
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
    return this.quizService.createQuiz(createQuizDto, req.user.id);
  }

  @Get()
  @ApiOkResponseGeneric(QuizResponseDto, { isArray: true })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async findAll(
    @Req() req: Request & { user: UserResponseDto },
  ): Promise<QuizResponseDto[]> {
    const quizzes = await this.quizService.findAllQuizzes(req.user.id);
    return quizzes;
  }

  @Get(':id')
  @ApiOkResponseGeneric(QuizResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async findById(@Param('id') id: string): Promise<QuizResponseDto> {
    const quiz = await this.quizService.findQuizById(id);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  @Put(':id')
  @ApiOkResponseGeneric(QuizResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() updateQuizDto: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    const quiz = await this.quizService.updateQuiz(id, updateQuizDto);
    return quiz;
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async delete(@Param('id') id: string): Promise<void> {
    await this.quizService.deleteQuiz(id);
  }

  @Post(':id/questions')
  @ApiOkResponseGeneric(QuestionResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async createQuestion(
    @Param('id') id: string,
    @Body() createQuestionDto: CreateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.quizService.createQuestion(id, createQuestionDto);
  }

  @Put(':id/questions/:questionId')
  @ApiOkResponseGeneric(QuestionResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.quizService.updateQuestion(questionId, updateQuestionDto);
  }

  @Put(':id/questions/:questionId/options')
  @ApiOkResponseGeneric(QuestionResponseDto)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async updateQuestionOptions(
    @Param('questionId') questionId: string,
    @Body() updateQuestionOptionsDto: UpdateQuestionOptionsDto,
  ): Promise<QuestionResponseDto | null> {
    return this.quizService.updateQuestionOptions(
      questionId,
      updateQuestionOptionsDto,
    );
  }

  @Delete(':id/questions/:questionId')
  @ApiNoContentResponse()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async deleteQuestion(@Param('questionId') questionId: string): Promise<void> {
    await this.quizService.deleteQuestion(questionId);
  }
}
