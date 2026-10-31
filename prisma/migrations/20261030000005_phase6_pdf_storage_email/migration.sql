-- AlterTable
ALTER TABLE "reports" ADD COLUMN "pdfKey" TEXT,
ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3),
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailStatus" TEXT;

