-- CreateTable
CREATE TABLE IF NOT EXISTS "radar_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tickers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "radar_configs_user_id_key" ON "radar_configs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radar_configs_user_id_idx" ON "radar_configs"("user_id");

-- AddForeignKey
ALTER TABLE "radar_configs" ADD CONSTRAINT "radar_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

