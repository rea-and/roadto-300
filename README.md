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

Data is client-side and stored in browser `localStorage`.

## Run Locally

```bash
cd /Users/andrea/Projects/trainiq
python3 -m http.server 9000
```

Open: `http://127.0.0.1:9000`

## Production Deploy (Ubuntu + Apache2 Existing Server)

Target URL: `https://carlevato.net/roadto300`

These steps assume Apache2 is already installed and `carlevato.net` is already hosted on this machine.

### 1) Create web root and copy app files

```bash
sudo mkdir -p /var/www/roadto300
sudo cp /Users/andrea/Projects/trainiq/index.html /var/www/roadto300/
sudo cp /Users/andrea/Projects/trainiq/styles.css /var/www/roadto300/
sudo cp /Users/andrea/Projects/trainiq/app.js /var/www/roadto300/
```

### 2) Add subpath mapping to your existing `carlevato.net` VirtualHost

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

### 3) Reload Apache

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
sudo cp /Users/andrea/Projects/trainiq/index.html /var/www/roadto300/
sudo cp /Users/andrea/Projects/trainiq/styles.css /var/www/roadto300/
sudo cp /Users/andrea/Projects/trainiq/app.js /var/www/roadto300/
sudo apachectl configtest
sudo systemctl reload apache2
```

## Optional: UFW Firewall

```bash
sudo ufw allow 'Apache Full'
sudo ufw status
```
