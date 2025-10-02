#!/bin/bash

# SCRIPT DE MIGRAÇÃO COMPLETA DO SISTEMA DE CACHE
# Este script completa a migração de safeQuery e operações de escrita

echo "🚀 Iniciando migração completa do sistema de cache..."

# Função para substituir safeQuery por safeQueryWithParams nos imports
echo "📦 Atualizando imports..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/safeQuery,/safeQueryWithParams,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/{ safeQuery }/{ safeQueryWithParams }/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/safeQuery }/safeQueryWithParams }/g'

# Adicionar safeWrite aos imports onde há operações de escrita
echo "✍️ Adicionando safeWrite aos imports necessários..."
find src -name "*.ts" -o -name "*.tsx" -exec grep -l "\.create\|\.update\|\.delete\|\.upsert" {} \; | \
while read file; do
    if grep -q "from '@/lib/prisma-wrapper'" "$file"; then
        if ! grep -q "safeWrite" "$file"; then
            sed -i 's/} from '\''@\/lib\/prisma-wrapper'\''/, safeWrite } from '\''@\/lib\/prisma-wrapper'\''/g' "$file"
        fi
    fi
done

echo "🔍 Arquivos que ainda precisam de migração manual:"

# Listar arquivos que ainda usam safeQuery (não migrados)
echo "📋 safeQuery não migrados:"
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "await safeQuery(" | head -10

# Listar arquivos com operações de escrita não migradas
echo "📋 Operações de escrita não migradas:"
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "prisma\.\w*\.\(create\|update\|delete\|upsert\)" | head -10

echo ""
echo "✅ Migração automática concluída!"
echo "⚠️  IMPORTANTE: Revise manualmente os arquivos listados acima"
echo "💡 Execute 'npm run build' para verificar erros de TypeScript"
