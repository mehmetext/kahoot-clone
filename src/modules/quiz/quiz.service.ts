import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { QuestionOptionResponseDto } from './dtos/question-response.dto';
import { UpdateQuestionOptionsDto } from './dtos/update-question-option.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';
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
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        },
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
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        },
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

  async createQuestion(quizId: string, createQuestionDto: CreateQuestionDto) {
    const question = await this.prisma.question.create({
      data: {
        quizId,
        title: createQuestionDto.title,
        options: createQuestionDto.options.map((o) => ({
          id: randomUUID(),
          option: o.option,
          isCorrect: o.isCorrect,
        })),
        order: createQuestionDto.order,
        timeLimitInSeconds: createQuestionDto.timeLimitInSeconds,
      },
    });

    return {
      ...question,
      options: question.options as unknown as QuestionOptionResponseDto[],
    };
  }

  async findQuestionById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return null;
    }

    return question;
  }

  async updateQuestion(id: string, updateQuestionDto: UpdateQuestionDto) {
    const question = await this.prisma.question.update({
      where: { id },
      data: updateQuestionDto,
    });

    return {
      ...question,
      options: question.options as unknown as QuestionOptionResponseDto[],
    };
  }

  async updateQuestionOptions(
    id: string,
    updateQuestionOptionsDto: UpdateQuestionOptionsDto,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return null;
    }

    const existingOptions =
      (question.options as unknown as QuestionOptionResponseDto[]) ?? [];

    const resultOptions: QuestionOptionResponseDto[] =
      updateQuestionOptionsDto.options.map((incomingOption) => {
        const existing: QuestionOptionResponseDto | undefined =
          incomingOption.id !== undefined
            ? existingOptions.find((option) => option.id === incomingOption.id)
            : undefined;

        if (existing) {
          return {
            ...existing,
            option: incomingOption.option,
            isCorrect: incomingOption.isCorrect,
          };
        }

        return {
          id: randomUUID(),
          option: incomingOption.option,
          isCorrect: incomingOption.isCorrect,
        };
      });

    const updatedQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        options: resultOptions as unknown as object[],
      },
    });

    return {
      ...updatedQuestion,
      options:
        updatedQuestion.options as unknown as QuestionOptionResponseDto[],
    };
  }

  async deleteQuestion(id: string) {
    await this.prisma.question.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
