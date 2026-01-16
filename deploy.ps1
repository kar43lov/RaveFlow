param(
    [Parameter(Mandatory=$true, HelpMessage="SSH address (user@server)")]
    [string]$Server,

    [Parameter(Mandatory=$true, HelpMessage="Domain name (e.g., example.com)")]
    [string]$Domain
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== RaveFlow Deploy ===" -ForegroundColor Magenta
Write-Host "Server: $Server" -ForegroundColor White
Write-Host "Domain: $Domain" -ForegroundColor White
Write-Host ""

# Step 1: Build
Write-Host "[1/4] Building project..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Build successful!" -ForegroundColor Green

# Step 2: Create directory on server
Write-Host ""
Write-Host "[2/4] Preparing server..." -ForegroundColor Cyan
ssh $Server "sudo mkdir -p /var/www/rave-visualizer && sudo chown `$USER:`$USER /var/www/rave-visualizer"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to prepare server!" -ForegroundColor Red
    exit 1
}

# Step 3: Upload files
Write-Host ""
Write-Host "[3/4] Uploading files..." -ForegroundColor Cyan
scp -r dist/* "${Server}:/var/www/rave-visualizer/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Files uploaded!" -ForegroundColor Green

# Step 4: Configure Nginx
Write-Host ""
Write-Host "[4/4] Configuring Nginx..." -ForegroundColor Cyan

$nginxConfig = @"
server {
    listen 80;
    server_name $Domain;

    root /var/www/rave-visualizer;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \`$uri \`$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
"@

ssh $Server @"
echo '$nginxConfig' | sudo tee /etc/nginx/sites-available/rave-visualizer > /dev/null
sudo ln -sf /etc/nginx/sites-available/rave-visualizer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true
"@

if ($LASTEXITCODE -ne 0) {
    Write-Host "Nginx configuration failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Nginx configured!" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "App available at: http://$Domain" -ForegroundColor Cyan
Write-Host ""
Write-Host "For HTTPS (required for microphone), run on server:" -ForegroundColor Yellow
Write-Host "  sudo apt install certbot python3-certbot-nginx -y" -ForegroundColor White
Write-Host "  sudo certbot --nginx -d $Domain" -ForegroundColor White
Write-Host ""