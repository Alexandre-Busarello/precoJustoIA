-- CreateTable
CREATE TABLE "backtest_transactions" (
    "id" TEXT NOT NULL,
    "backtest_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "ticker" TEXT NOT NULL,
    "contribution" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(10,4) NOT NULL,
    "sharesAdded" DECIMAL(15,6) NOT NULL,
    "totalShares" DECIMAL(15,6) NOT NULL,
    "totalInvested" DECIMAL(15,2) NOT NULL,
    "total_contribution" DECIMAL(12,2) NOT NULL,
    "portfolio_value" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "backtest_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backtest_transactions_backtest_id_month_idx" ON "backtest_transactions"("backtest_id", "month");

-- AddForeignKey
ALTER TABLE "backtest_transactions" ADD CONSTRAINT "backtest_transactions_backtest_id_fkey" FOREIGN KEY ("backtest_id") REFERENCES "backtest_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
