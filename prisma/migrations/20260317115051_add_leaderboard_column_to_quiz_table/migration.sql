-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "leaderboard" JSONB[] DEFAULT ARRAY[]::JSONB[];
