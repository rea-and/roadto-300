# RoadTo-300

A colorful 90-day tracker to reach **300 total points**.

Tracks daily progress for:
- gym/workout sessions
- daily strain quota
- carb-free meals
- supplements (taken / not taken)

Scoring model:
- 4 categories, each weighted at 25%
- max **5 points/day**
- challenge target: **300 points in 90 days**

Data is persisted in the backend JSON store at `data/state.json` through `GET/PUT /api/state`.
The frontend still keeps a local browser backup only as a fallback.

## Run Locally

```bash
cd /Users/andrea/Projects/roadto-300
node server.js
```

Open: `http://127.0.0.1:9000`

## Production Deploy (Ubuntu + Apache2 Existing Server)

Target URL: `https://carlevato.net/roadto300`

These steps assume Apache2 is already installed and `carlevato.net` is already hosted on this machine.

### 1) Copy app files to the server

```bash
sudo mkdir -p /var/www/roadto300
sudo cp -r /Users/andrea/Projects/roadto-300/* /var/www/roadto300/
```

### 2) Run the Node backend service

Create a simple systemd service so `/api/state` can persist to disk:

```ini
# /etc/systemd/system/roadto300.service
[Unit]
Description=RoadTo-300 backend
After=network.target

[Service]
WorkingDirectory=/var/www/roadto300
ExecStart=/usr/bin/node /var/www/roadto300/server.js
Restart=always
User=www-data
Environment=PORT=9000
Environment=HOST=127.0.0.1

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roadto300
```

### 3) Add subpath mapping to your existing `carlevato.net` VirtualHost

Edit your existing vhost file (commonly `/etc/apache2/sites-available/carlevato.net.conf`) and add inside the `VirtualHost` block:

```apache
Alias /roadto300 /var/www/roadto300

<Directory /var/www/roadto300>
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
    DirectoryIndex index.html
</Directory>
```

If you also have an HTTPS vhost (recommended), add the same `Alias` and `Directory` block in the `*:443` VirtualHost too.

Proxy API traffic to the Node service inside the same `VirtualHost` block:

```apache
ProxyPass /roadto300/api http://127.0.0.1:9000/api
ProxyPassReverse /roadto300/api http://127.0.0.1:9000/api
```

Ensure required modules are enabled:

```bash
sudo a2enmod proxy proxy_http
```

### 4) Reload Apache

```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

## Production Operations

### Start

```bash
sudo systemctl start apache2
```

### Stop

```bash
sudo systemctl stop apache2
```

### Restart

```bash
sudo systemctl restart apache2
```

### Reload (no full restart)

```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

### Status

```bash
sudo systemctl status apache2
```

### Enable at boot

```bash
sudo systemctl enable apache2
```

### Disable at boot

```bash
sudo systemctl disable apache2
```

## Updating Production After Code Changes

```bash
sudo cp -r /Users/andrea/Projects/roadto-300/* /var/www/roadto300/
sudo systemctl restart roadto300
sudo apachectl configtest
sudo systemctl reload apache2
```

## Optional: UFW Firewall

```bash
sudo ufw allow 'Apache Full'
sudo ufw status
```
