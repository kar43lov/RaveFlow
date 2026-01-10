# Деплой Rave Visualizer

Инструкция по развертыванию приложения на удалённом сервере.

## Быстрый деплой (одной командой)

### Использование deploy.sh

```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запуск деплоя
./deploy.sh user@your-server.com 8080
```

**Параметры:**
- `user@your-server.com` — SSH адрес сервера
- `8080` — порт для приложения

**Что делает скрипт:**
1. Собирает проект (`npm run build`)
2. Создаёт директорию `/var/www/rave-visualizer` на сервере
3. Загружает файлы через rsync
4. Настраивает Nginx
5. Открывает порт в файрволе

---

## Ручной деплой (пошагово)

### 1. Сборка проекта

```bash
npm run build
```

После сборки появится папка `dist/` с готовыми файлами.

### 2. Загрузка на сервер

**Вариант A: через SCP**
```bash
scp -r dist/* user@your-server:/var/www/rave-visualizer/
```

**Вариант B: через rsync (рекомендуется)**
```bash
rsync -avz --delete dist/ user@your-server:/var/www/rave-visualizer/
```

**Вариант C: архивом**
```bash
# Локально
tar -czf rave.tar.gz -C dist .
scp rave.tar.gz user@your-server:~

# На сервере
ssh user@your-server
mkdir -p /var/www/rave-visualizer
tar -xzf ~/rave.tar.gz -C /var/www/rave-visualizer
```

### 3. Настройка Nginx

```bash
sudo nano /etc/nginx/sites-available/rave-visualizer
```

**Конфиг для HTTP (порт 8080):**
```nginx
server {
    listen 8080;
    server_name your-domain.com;

    root /var/www/rave-visualizer;
    index index.html;

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Активация:**
```bash
sudo ln -s /etc/nginx/sites-available/rave-visualizer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Открытие порта в файрволе

```bash
# UFW (Ubuntu)
sudo ufw allow 8080/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 5. Проверка

```bash
curl -I http://localhost:8080
```

---

## HTTPS с Let's Encrypt

**⚠️ Важно:** Для работы микрофона (`getUserMedia`) требуется HTTPS. Без него аудио-реактивность работать не будет (кроме localhost).

### Установка Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### Получение сертификата

```bash
sudo certbot --nginx -d your-domain.com
```

### Конфиг Nginx с HTTPS

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/rave-visualizer;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Автообновление сертификата

```bash
# Проверка автообновления
sudo certbot renew --dry-run

# Certbot автоматически добавляет cron задачу
```

---

## Альтернатива: Node.js serve

Если не хотите настраивать Nginx:

```bash
# Установка
npm install -g serve

# Запуск на порту 8080
serve -s /var/www/rave-visualizer -l 8080

# Запуск в фоне через PM2
npm install -g pm2
pm2 start "serve -s /var/www/rave-visualizer -l 8080" --name rave
pm2 save
pm2 startup
```

---

## Обновление приложения

После изменений в коде:

```bash
# Локально: пересобрать и задеплоить
./deploy.sh user@your-server.com 8080
```

Или вручную:
```bash
npm run build
rsync -avz --delete dist/ user@your-server:/var/www/rave-visualizer/
```

---

## Устранение проблем

### Приложение не открывается
```bash
# Проверить Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверить порт
sudo netstat -tlnp | grep 8080
```

### Белый/чёрный экран
- Откройте DevTools (F12) → Console
- Проверьте ошибки WebGL
- Убедитесь что браузер поддерживает WebGL

### Микрофон не работает
- Нужен HTTPS (см. раздел выше)
- Проверьте разрешения в браузере
- В Chrome: Settings → Privacy → Site Settings → Microphone

### Ошибки CORS
Добавьте в Nginx:
```nginx
add_header Access-Control-Allow-Origin *;
```
