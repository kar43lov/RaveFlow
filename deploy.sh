#!/bin/bash
# Скрипт для деплоя Rave Visualizer на сервер
# Использование: ./deploy.sh [user@server] [port]
# Пример: ./deploy.sh root@192.168.1.100 8080

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация (измените под свои нужды)
SERVER="${1:-user@your-server.com}"
PORT="${2:-8080}"
REMOTE_DIR="/var/www/rave-visualizer"
LOCAL_DIST="dist"

echo -e "${BLUE}🚀 Деплой Rave Visualizer${NC}"
echo -e "${BLUE}   Сервер: ${SERVER}${NC}"
echo -e "${BLUE}   Порт: ${PORT}${NC}"
echo -e "${BLUE}   Директория: ${REMOTE_DIR}${NC}"
echo ""

# Шаг 1: Сборка проекта
echo -e "${YELLOW}📦 Шаг 1: Сборка проекта...${NC}"
npm run build

if [ ! -d "$LOCAL_DIST" ]; then
    echo -e "${RED}❌ Ошибка: папка dist не создана${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Сборка завершена${NC}"
echo ""

# Шаг 2: Создание директории на сервере
echo -e "${YELLOW}📁 Шаг 2: Подготовка сервера...${NC}"
ssh $SERVER "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami):\$(whoami) $REMOTE_DIR"
echo -e "${GREEN}✓ Директория готова${NC}"
echo ""

# Шаг 3: Загрузка файлов
echo -e "${YELLOW}📤 Шаг 3: Загрузка файлов...${NC}"
rsync -avz --delete $LOCAL_DIST/ $SERVER:$REMOTE_DIR/
echo -e "${GREEN}✓ Файлы загружены${NC}"
echo ""

# Шаг 4: Настройка Nginx
echo -e "${YELLOW}⚙️  Шаг 4: Настройка Nginx...${NC}"

NGINX_CONFIG="server {
    listen $PORT;
    server_name _;

    root $REMOTE_DIR;
    index index.html;

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    # Кэширование статики
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }
}"

ssh $SERVER "echo '$NGINX_CONFIG' | sudo tee /etc/nginx/sites-available/rave-visualizer > /dev/null"
ssh $SERVER "sudo ln -sf /etc/nginx/sites-available/rave-visualizer /etc/nginx/sites-enabled/"
ssh $SERVER "sudo nginx -t && sudo systemctl reload nginx"
echo -e "${GREEN}✓ Nginx настроен${NC}"
echo ""

# Шаг 5: Открытие порта в файрволе
echo -e "${YELLOW}🔥 Шаг 5: Настройка файрвола...${NC}"
ssh $SERVER "sudo ufw allow $PORT/tcp 2>/dev/null || sudo iptables -A INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null || true"
echo -e "${GREEN}✓ Порт $PORT открыт${NC}"
echo ""

# Готово
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Деплой завершён успешно!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "🌐 Приложение доступно:"
echo -e "   ${BLUE}http://$SERVER:$PORT${NC}"
echo ""
echo -e "${YELLOW}⚠️  Для работы микрофона нужен HTTPS!${NC}"
echo -e "   Настройте SSL сертификат через Let's Encrypt"
echo ""
