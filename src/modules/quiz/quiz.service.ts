import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { QuestionOptionResponseDto } from './dtos/question-response.dto';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createQuizDto: CreateQuizDto, userId: string) {
    const quiz = this.prisma.quiz.create({
      data: {
        name: createQuizDto.name,
        userId,
      },
    });

    return quiz;
  }

  async findAll(userId: string) {
    const quizzes = await this.prisma.quiz.findMany({
      where: { userId },
      include: {
        questions: true,
      },
    });

    return quizzes.map((q) => ({
      ...q,
      questions: q.questions.map((q) => ({
        ...q,
        options: q.options as unknown as QuestionOptionResponseDto[],
      })),
    }));
  }
}
