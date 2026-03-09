import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { QuestionService } from './question.service';

@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get()
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 5 })
  async getRandomQuestions(@Query('limit') limit: number = 5) {
    const questions = await this.questionService.getRandomQuestions(limit);

    const safeQuestions = questions.map((question) => {
      return {
        id: question.id,
        text: question.text,
        options: question.options,
        timeLimit: question.timeLimit,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        deletedAt: question.deletedAt,
      };
    });

    return safeQuestions;
  }
}
