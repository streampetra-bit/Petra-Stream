# Deployment Notes (DigitalOcean + MediaMTX)

## 1) Media server (DigitalOcean)
Use a DO droplet with a public IP and open ports:
- RTMP: `1935`
- HLS: `8888` (or proxy via Nginx on 443)

### MediaMTX quick setup (systemd)
1) Install and unpack MediaMTX:
```bash
sudo mkdir -p /opt/mediamtx
cd /opt/mediamtx
sudo wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_linux_amd64.tar.gz
sudo tar -xzf mediamtx_linux_amd64.tar.gz
```

2) Create `/opt/mediamtx/mediamtx.yml` (edit placeholders):
```yaml
rtmp: yes
hls: yes
hlsAddress: :8888

# Ask backend to authorize publishing. Leave MEDIA_AUTH_TOKEN empty in backend
# if you are using this direct call from MediaMTX.
authHTTPAddress: http://<backend-host>:4000/api/streams/ingest/auth

# Notify backend when stream starts/stops
runOnReady: >
  /bin/sh -c "curl -s -X POST http://<backend-host>:4000/api/streams/ingest/publish
  -H 'Content-Type: application/json'
  -d '{\"path\":\"${MTX_PATH}\"}'"
runOnNotReady: >
  /bin/sh -c "curl -s -X POST http://<backend-host>:4000/api/streams/ingest/unpublish
  -H 'Content-Type: application/json'
  -d '{\"path\":\"${MTX_PATH}\"}'"
```

If you want a shared secret, set `MEDIA_AUTH_TOKEN` in the backend and add:
`-H 'x-media-token: <token>'` to the `curl` commands above.

3) Create a systemd service `/etc/systemd/system/mediamtx.service`:
```ini
[Unit]
Description=MediaMTX
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
```

4) Start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
```

Default endpoints:
- RTMP ingest: `rtmp://<host>/live`
- HLS playback: `http://<host>:8888/live/<streamKey>/index.m3u8`

### Optional: ingest auth hook
MediaMTX can call your backend for publish authorization. Add this to `mediamtx.yml`:

```yaml
authHTTPAddress: http://<backend-host>:4000/api/streams/ingest/auth
```

The backend will validate the stream key extracted from the publish path:
`live/<streamKey>`. If you set `MEDIA_AUTH_TOKEN`, send it as a header
from your auth proxy or keep it empty for development.

### Stream lifecycle hooks
To auto-mark streams live/offline based on MediaMTX status, add:

```yaml
runOnReady: >
  /bin/sh -c "curl -s -X POST http://<backend-host>:4000/api/streams/ingest/publish
  -H 'Content-Type: application/json'
  -d '{\"path\":\"${MTX_PATH}\"}'"
runOnNotReady: >
  /bin/sh -c "curl -s -X POST http://<backend-host>:4000/api/streams/ingest/unpublish
  -H 'Content-Type: application/json'
  -d '{\"path\":\"${MTX_PATH}\"}'"
```

If you set `MEDIA_AUTH_TOKEN`, add header:
`-H 'x-media-token: <token>'`.

## 2) Backend (NestJS)
Required envs (see `backend/.env.example`):
- `MEDIA_RTMP_URL="rtmp://165.227.224.72/live"`
- `MEDIA_HLS_BASE_URL="http://165.227.224.72:8888/live"`
- `MEDIA_AUTH_TOKEN=""` (optional)
- `JWT_SECRET="change-me"` (required for wallet auth)
- `JWT_EXPIRES_IN="7d"`
- `DATABASE_URL`, `MONGO_URL`, `SOMNIA_HTTP`, `REGISTRY_ADDRESS`, `VAULT_ADDRESS`

## 3) Frontend (Vite)
Set envs (see `frontend/.env.example`):
- `VITE_INGEST_URL="rtmp://165.227.224.72/live"`
- `VITE_HLS_BASE_URL="http://165.227.224.72:8888/live"`

## 4) Reverse proxy + HTTPS (recommended)
For production, proxy HLS through Nginx and serve on HTTPS:
- `https://stream.yourdomain.com/live/<streamKey>/index.m3u8`
- Update `MEDIA_HLS_BASE_URL` and `VITE_HLS_BASE_URL` accordingly.

Example Nginx config (`/etc/nginx/sites-available/stream.conf`):
```nginx
server {
  listen 80;
  server_name stream.yourdomain.com;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl http2;
  server_name stream.yourdomain.com;
  ssl_certificate /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem;

  location /live/ {
    proxy_pass http://127.0.0.1:8888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
    add_header Cache-Control no-cache;
    add_header Access-Control-Allow-Origin *;
  }
}
```

Then reload Nginx and point your envs to:
- `MEDIA_HLS_BASE_URL="https://stream.yourdomain.com/live"`
- `VITE_HLS_BASE_URL="https://stream.yourdomain.com/live"`

If you proxy HLS, you can block port 8888 externally and only expose 80/443.

## 5) OBS settings
In OBS:
- Server: `rtmp://<host>/live`
- Stream key: from the creator dashboard.

The creator dashboard auto-generates a playback URL using the HLS base.
