import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'ExactlyOneCorrectOption', async: false })
class ExactlyOneCorrectOptionConstraint implements ValidatorConstraintInterface {
  validate(options: CreateQuestionOptionDto[] | undefined | null): boolean {
    if (!Array.isArray(options) || options.length === 0) return false;
    const correctCount = options.filter((o) => o?.isCorrect === true).length;
    return correctCount === 1;
  }

  defaultMessage(): string {
    return 'There must be exactly one correct option';
  }
}

export class CreateQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The option',
    example: 'Paris',
  })
  option: string;

  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The is correct of the option',
    example: true,
  })
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The title of the question',
    example: 'What is the capital of France?',
  })
  title: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  @Validate(ExactlyOneCorrectOptionConstraint)
  @ApiProperty({
    description: 'The options of the question',
    type: [CreateQuestionOptionDto],
  })
  options: CreateQuestionOptionDto[];

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The order of the question',
    example: 1,
  })
  order: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    description: 'The time limit in seconds of the question',
    example: 30,
    nullable: true,
  })
  timeLimitInSeconds?: number;
}
