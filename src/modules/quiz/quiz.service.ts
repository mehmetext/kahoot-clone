import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/modules/prisma/prisma.service';
import { CreateQuizDto } from './dtos/create-quiz.dto';

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
}
