#!/bin/bash

# 🔍 Monitor de Cache Redis - Script de Linha de Comando
# 
# Uso:
#   ./scripts/monitor-cache.sh status
#   ./scripts/monitor-cache.sh watch
#   ./scripts/monitor-cache.sh clear
#   ./scripts/monitor-cache.sh reconnect

set -e

# Configuração
BASE_URL="${CACHE_MONITOR_URL:-http://localhost:3000}"
COOKIE_FILE="${HOME}/.analisador-acoes-session"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Verificar se tem cookie de sessão
check_session() {
    if [ ! -f "$COOKIE_FILE" ]; then
        print_error "Cookie de sessão não encontrado em $COOKIE_FILE"
        print_info "Faça login primeiro e salve o cookie"
        print_info "Exemplo: curl -c $COOKIE_FILE -X POST ... /api/auth/login"
        exit 1
    fi
}

# Obter status do cache
get_status() {
    check_session
    curl -s -b "$COOKIE_FILE" "${BASE_URL}/api/admin/cache-status"
}

# Exibir status formatado
show_status() {
    local response=$(get_status)
    
    if echo "$response" | grep -q "error"; then
        print_error "Erro ao obter status:"
        echo "$response" | jq -r '.error // .details // "Erro desconhecido"'
        exit 1
    fi
    
    print_header "📊 STATUS DO CACHE REDIS"
    
    # Status geral
    local redis_status=$(echo "$response" | jq -r '.redis.status')
    local health=$(echo "$response" | jq -r '.health.overall')
    local can_serve=$(echo "$response" | jq -r '.health.canServRequests')
    
    echo ""
    echo -e "Status Redis:    $(format_status $redis_status)"
    echo -e "Saúde Geral:     $(format_health $health)"
    echo -e "Pode Servir:     $(format_bool $can_serve)"
    
    # Detalhes da conexão
    print_header "🔌 CONEXÃO"
    
    local connected=$(echo "$response" | jq -r '.redis.connected')
    local disabled=$(echo "$response" | jq -r '.redis.disabled')
    local idle_time=$(echo "$response" | jq -r '.connection.idleTimeSeconds')
    local keys_redis=$(echo "$response" | jq -r '.redis.keysInRedis // "N/A"')
    
    echo ""
    echo "Conectado:       $(format_bool $connected)"
    echo "Desabilitado:    $(format_bool $disabled)"
    echo "Tempo Ocioso:    ${idle_time}s"
    echo "Chaves Redis:    $keys_redis"
    
    # Cache em memória
    print_header "💾 CACHE EM MEMÓRIA"
    
    local keys_memory=$(echo "$response" | jq -r '.memory.keysInMemory')
    local size=$(echo "$response" | jq -r '.memory.approximateSize')
    local using_fallback=$(echo "$response" | jq -r '.health.usingFallback')
    
    echo ""
    echo "Chaves:          $keys_memory"
    echo "Tamanho:         $size"
    echo "Usando Fallback: $(format_bool $using_fallback)"
    
    # Performance
    print_header "⚡ PERFORMANCE"
    
    local conn_timeout=$(echo "$response" | jq -r '.performance.connectionTimeout')
    local cmd_timeout=$(echo "$response" | jq -r '.performance.commandTimeout')
    local disconnect_after=$(echo "$response" | jq -r '.connection.disconnectAfterOperation')
    
    echo ""
    echo "Timeout Conexão: ${conn_timeout}ms"
    echo "Timeout Comando: ${cmd_timeout}ms"
    echo "Disconnect After Op: $(format_bool $disconnect_after)"
    
    # Recomendações
    local recommendations=$(echo "$response" | jq -r '.recommendations[]' 2>/dev/null)
    if [ -n "$recommendations" ]; then
        print_header "💡 RECOMENDAÇÕES"
        echo ""
        echo "$recommendations" | while read -r line; do
            echo "  $line"
        done
    fi
    
    # Último erro
    local last_error=$(echo "$response" | jq -r '.redis.lastCriticalError // empty')
    if [ -n "$last_error" ]; then
        echo ""
        print_warning "Último erro crítico: $last_error"
    fi
    
    echo ""
}

# Formatar status
format_status() {
    case "$1" in
        "connected")
            echo -e "${GREEN}CONECTADO${NC}"
            ;;
        "disconnected")
            echo -e "${YELLOW}DESCONECTADO${NC}"
            ;;
        "disabled")
            echo -e "${RED}DESABILITADO${NC}"
            ;;
        "error")
            echo -e "${RED}ERRO${NC}"
            ;;
        *)
            echo "$1"
            ;;
    esac
}

format_health() {
    case "$1" in
        "healthy")
            echo -e "${GREEN}SAUDÁVEL${NC}"
            ;;
        "degraded")
            echo -e "${YELLOW}DEGRADADO${NC}"
            ;;
        *)
            echo "$1"
            ;;
    esac
}

format_bool() {
    case "$1" in
        "true")
            echo -e "${GREEN}Sim${NC}"
            ;;
        "false")
            echo -e "${YELLOW}Não${NC}"
            ;;
        *)
            echo "$1"
            ;;
    esac
}

# Watch mode (atualização contínua)
watch_status() {
    print_info "Monitorando cache (Ctrl+C para sair)..."
    echo ""
    
    while true; do
        clear
        show_status
        echo ""
        print_info "Próxima atualização em 5s..."
        sleep 5
    done
}

# Executar ação
execute_action() {
    local action=$1
    local prefix=$2
    
    check_session
    
    local payload="{\"action\":\"$action\""
    if [ -n "$prefix" ]; then
        payload="$payload,\"prefix\":\"$prefix\""
    fi
    payload="$payload}"
    
    print_info "Executando ação: $action"
    
    local response=$(curl -s -b "$COOKIE_FILE" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${BASE_URL}/api/admin/cache-status")
    
    if echo "$response" | grep -q "error"; then
        print_error "Erro ao executar ação:"
        echo "$response" | jq -r '.error // .details // "Erro desconhecido"'
        exit 1
    fi
    
    local message=$(echo "$response" | jq -r '.message')
    print_success "$message"
}

# Menu principal
case "${1:-status}" in
    status)
        show_status
        ;;
    watch)
        watch_status
        ;;
    clear)
        if [ -n "$2" ]; then
            execute_action "clear" "$2"
        else
            execute_action "clear"
        fi
        ;;
    reconnect)
        execute_action "reconnect"
        ;;
    json)
        get_status | jq '.'
        ;;
    help|--help|-h)
        echo "Uso: $0 [comando] [opções]"
        echo ""
        echo "Comandos:"
        echo "  status          Exibir status atual do cache (padrão)"
        echo "  watch           Monitorar em tempo real (atualiza a cada 5s)"
        echo "  clear [prefix]  Limpar cache (opcionalmente por prefixo)"
        echo "  reconnect       Reinicializar conexão Redis"
        echo "  json            Exibir resposta JSON bruta"
        echo "  help            Exibir esta ajuda"
        echo ""
        echo "Variáveis de ambiente:"
        echo "  CACHE_MONITOR_URL  URL base da aplicação (padrão: http://localhost:3000)"
        echo ""
        echo "Exemplos:"
        echo "  $0 status"
        echo "  $0 watch"
        echo "  $0 clear"
        echo "  $0 clear companies"
        echo "  CACHE_MONITOR_URL=https://meu-app.com $0 status"
        ;;
    *)
        print_error "Comando desconhecido: $1"
        echo "Use '$0 help' para ver comandos disponíveis"
        exit 1
        ;;
esac

