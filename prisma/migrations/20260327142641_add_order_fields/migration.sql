-- AlterTable
ALTER TABLE "Order" ADD COLUMN "clientContact" TEXT;
ALTER TABLE "Order" ADD COLUMN "remainingPayment" REAL;
ALTER TABLE "Order" ADD COLUMN "tariff" TEXT;
ALTER TABLE "Order" ADD COLUMN "totalCost" REAL;
