import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { QuestionOptionResponseDto } from './dtos/question-response.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuiz(createQuizDto: CreateQuizDto, userId: string) {
    const quiz = this.prisma.quiz.create({
      data: {
        name: createQuizDto.name,
        userId,
      },
    });

    return quiz;
  }

  async findAllQuizzes(userId: string) {
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

  async findQuizById(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });

    if (!quiz) {
      return null;
    }

    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({
        ...q,
        options: q.options as unknown as QuestionOptionResponseDto[],
      })),
    };
  }

  async updateQuiz(id: string, updateQuizDto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.update({
      where: { id },
      data: updateQuizDto,
    });

    return quiz;
  }

  async deleteQuiz(id: string) {
    await this.prisma.quiz.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
