-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "text" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "date" TEXT,
    "time" TEXT,
    "address" TEXT,
    "price" TEXT,
    "people" TEXT,
    "comment" TEXT,
    "tariff" TEXT,
    "clientContact" TEXT,
    "totalCost" DOUBLE PRECISION,
    "remainingPayment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHost" (
    "orderId" INTEGER NOT NULL,
    "hostId" INTEGER NOT NULL,

    CONSTRAINT "OrderHost_pkey" PRIMARY KEY ("orderId","hostId")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Без имени',
    "telegramId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Host_telegramId_key" ON "Host"("telegramId");

-- AddForeignKey
ALTER TABLE "OrderHost" ADD CONSTRAINT "OrderHost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHost" ADD CONSTRAINT "OrderHost_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;
