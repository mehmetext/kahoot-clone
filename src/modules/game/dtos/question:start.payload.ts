export class QuestionStartPayload {
  text: string;
  answers: { id: string; text: string }[];
  timeLimitInSeconds: number;
  currentQuestionIndex: number;
  totalQuestionCount: number;
}
