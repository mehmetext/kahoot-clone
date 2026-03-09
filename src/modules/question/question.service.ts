import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';

@Injectable()
export class QuestionService implements OnModuleInit {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  async onModuleInit() {
    const count = await this.questionRepository.count();
    if (count === 0) {
      await this.seedQuestions();
      console.log('🌱 Örnek sorular veritabanına eklendi.');
    }
  }

  async getRandomQuestions(limit: number = 5): Promise<Question[]> {
    return this.questionRepository
      .createQueryBuilder('question')
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async seedQuestions() {
    const dummyQuestions = [
      {
        text: "NestJS varsayılan olarak hangi HTTP sunucu framework'ünü kullanır?",
        options: [
          { key: 'A', text: 'Fastify' },
          { key: 'B', text: 'Express' },
          { key: 'C', text: 'Koa' },
          { key: 'D', text: 'Hapi' },
        ],
        correctAnswer: 'B',
        timeLimit: 10,
      },
      {
        text: 'Mikroservis mimarisinde asenkron iletişim için hangisi sıklıkla tercih edilir?',
        options: [
          { key: 'A', text: 'REST API' },
          { key: 'B', text: 'GraphQL' },
          { key: 'C', text: 'RabbitMQ' },
          { key: 'D', text: 'SOAP' },
        ],
        correctAnswer: 'C',
        timeLimit: 15,
      },
      {
        text: "Redis'te veriler RAM'de tutulduğu için hangi veri tabanı türüne girer?",
        options: [
          { key: 'A', text: 'Relational' },
          { key: 'B', text: 'In-Memory' },
          { key: 'C', text: 'Graph' },
          { key: 'D', text: 'Document' },
        ],
        correctAnswer: 'B',
        timeLimit: 10,
      },
    ];

    const questionsToSave = this.questionRepository.create(dummyQuestions);
    await this.questionRepository.save(questionsToSave);
  }
}
