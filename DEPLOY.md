# Deploy

Instructions for deploying the app to a remote Ubuntu server from Windows or Linux.

## Quick Deploy (Windows)

### Using deploy.ps1

```powershell
.\deploy.ps1 -Server "user@your-server-ip" -Domain "your-domain.com"
```

**What the script does:**
1. Builds the project locally (`npm run build`)
2. Connects to the server via SSH
3. Creates `/var/www/rave-visualizer` directory
4. Uploads built files via SCP
5. Configures Nginx

**Prerequisites:**
- Node.js installed locally
- SSH access to the server
- Nginx installed on the server (`sudo apt install nginx`)

### Using Git Bash / WSL

```bash
./deploy.sh user@your-server-ip 8080
```

---

## Manual Deploy (Windows)

### 1. Build

```powershell
npm run build
```

### 2. Upload to server

```powershell
scp -r dist/* user@your-server:/var/www/rave-visualizer/
```

### 3. Configure server (via SSH)

```powershell
ssh user@your-server
```

On the server:

```bash
# Install Nginx
sudo apt update && sudo apt install nginx -y

# Create config
sudo nano /etc/nginx/sites-available/rave-visualizer
```

Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/rave-visualizer;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and restart:
```bash
sudo ln -sf /etc/nginx/sites-available/rave-visualizer /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

---

## HTTPS (Let's Encrypt)

**Required for microphone access** — browsers block `getUserMedia` on non-HTTPS origins.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

Certificate auto-renews via systemd timer.

---

## Update App

After code changes:

```powershell
.\deploy.ps1 -Server "user@your-server-ip" -Domain "your-domain.com"
```

Or manually:
```powershell
npm run build
scp -r dist/* user@your-server:/var/www/rave-visualizer/
```

---

## Troubleshooting

### Site not loading
- Check Nginx: `sudo nginx -t && sudo systemctl status nginx`
- Check firewall: open ports 80/443 in your hosting provider's security group

### Microphone not working
- HTTPS required (see above)
- Check browser permissions

### Black screen
- Open DevTools (F12) → Console
- Check for WebGL errors