-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "leaderboard" JSONB[],
    "hostId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
