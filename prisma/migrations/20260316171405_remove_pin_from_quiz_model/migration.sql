/*
  Warnings:

  - You are about to drop the column `pin` on the `quizzes` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "quizzes_pin_key";

-- AlterTable
ALTER TABLE "quizzes" DROP COLUMN "pin";
