# AskDao reading proxy rollback

Quotas in `/var/lib/askdao` (including `quota.json` and `ip-salt`) are not part of a code rollback. Leave that directory in place.

The installer copies the previous program to `/opt/askdao-api/server.js.bak-YYYYMMDDHHMMSS` and the previous nginx site file to `/opt/nginx27/conf.d/fzjzq.conf.bak-askdao-YYYYMMDDHHMMSS` when either file changes.

```bash
sudo systemctl stop askdao-api 2>/dev/null || true
sudo cp -a /opt/askdao-api/server.js.bak-YYYYMMDDHHMMSS /opt/askdao-api/server.js
sudo docker rm -f askdao-api
sudo docker run -d --name askdao-api --restart unless-stopped \
  --network host \
  -e HOST=127.0.0.1 -e PORT=8787 \
  -e ASKDAO_ENV_FILE=/etc/askdao.env \
  -e ASKDAO_STATE_DIR=/var/lib/askdao \
  -e ASKDAO_LOG_FILE=/var/log/askdao/reading.log \
  -v /etc/askdao.env:/etc/askdao.env:ro \
  -v /var/lib/askdao:/var/lib/askdao \
  -v /var/log/askdao:/var/log/askdao \
  -v /opt/askdao-api/server.js:/app/server.js:ro \
  node:20-alpine node /app/server.js
sudo cp -a /opt/nginx27/conf.d/fzjzq.conf.bak-askdao-YYYYMMDDHHMMSS /opt/nginx27/conf.d/fzjzq.conf
sudo docker exec nginx27 nginx -t && sudo docker exec nginx27 nginx -s reload
```

If `nginx27` is not on the host network, use the same `--network` value the previous container had (`docker inspect askdao-api` before removing it) instead of `--network host`. Do not delete `/var/lib/askdao`.
