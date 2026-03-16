import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'ExactlyOneCorrectOption', async: false })
class ExactlyOneCorrectOptionConstraint implements ValidatorConstraintInterface {
  validate(options: UpdateQuestionOptionDto[]): boolean {
    if (!Array.isArray(options) || options.length === 0) return false;
    const correctCount = options.filter((o) => o?.isCorrect === true).length;
    return correctCount === 1;
  }

  defaultMessage(): string {
    return 'There must be exactly one correct option';
  }
}

export class UpdateQuestionOptionDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'The id of the option (optional for new options)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    nullable: true,
  })
  id?: string;

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

export class UpdateQuestionOptionsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpdateQuestionOptionDto)
  @Validate(ExactlyOneCorrectOptionConstraint)
  @ApiProperty({
    description: 'The options of the question',
    type: [UpdateQuestionOptionDto],
  })
  options: UpdateQuestionOptionDto[];
}
