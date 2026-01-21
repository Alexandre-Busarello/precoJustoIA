-- AlterEnum
ALTER TYPE "WebhookProvider" ADD VALUE 'KIWIFY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "kiwify_id" TEXT;
ALTER TABLE "users" ADD COLUMN "kiwify_order_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_kiwify_id_key" ON "users"("kiwify_id");

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'KIWIFY_WELCOME';

