-- CreateTable
CREATE TABLE "Host" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "name" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Host_telegramId_key" ON "Host"("telegramId");
