#!/bin/bash

# Script para executar migration SQL de forma segura
# Garante que não há perda de dados

echo "🔍 Verificando conexão com o banco de dados..."

# Verificar se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erro: DATABASE_URL não está definida"
    echo "Por favor, defina a variável DATABASE_URL no arquivo .env"
    exit 1
fi

echo "✅ DATABASE_URL encontrada"
echo ""
echo "📋 Executando migration: add_email_and_unsubscribe_token_to_asset_subscriptions"
echo ""

# Executar migration SQL
psql "$DATABASE_URL" -f prisma/migrations/add_email_and_unsubscribe_token_to_asset_subscriptions.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration executada com sucesso!"
    echo ""
    echo "📊 Próximos passos:"
    echo "1. Execute: npx prisma generate"
    echo "2. Verifique se tudo está funcionando corretamente"
else
    echo ""
    echo "❌ Erro ao executar migration"
    echo "Verifique os logs acima para mais detalhes"
    exit 1
fi

