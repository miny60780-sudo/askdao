#!/bin/bash
# AskDao reading proxy installer for the fzjzq.com host (container nginx27).
#
# The admin creates the key file first. This script never searches for a key
# anywhere else, and it does not print the file.
#
#   printf '%s\n' 'DEEPSEEK_API_KEY=your-key-here' | sudo tee /etc/askdao.env >/dev/null
#   sudo chmod 600 /etc/askdao.env
#
# Then:
#   curl -fsSL https://raw.githubusercontent.com/miny60780-sudo/askdao/main/server/install.sh | sudo bash
#
# Optional lines in /etc/askdao.env (not required):
#   DEEPSEEK_API_BASE=https://api.deepseek.com
#   DEEPSEEK_MODEL=deepseek-chat
#   ASKDAO_NODE_IMAGE=node:20-alpine
#
# Re-running is safe: the container is recreated, and the nginx location block
# is replaced in place instead of duplicated. /var/lib/askdao (quotas) is kept.
# The smoke test rejects a no-Origin call and an off-topic call. It does not
# call the model. Optional quota lines in /etc/askdao.env:
#   ASKDAO_IP_DAILY=5
#   ASKDAO_GLOBAL_HOURLY=20
#   ASKDAO_DAILY_REQUESTS=80
#   ASKDAO_DAILY_TOKENS=80000
# ASKDAO_DAILY_TOKENS counts tokens, not money. Multiply by the provider's
# current price per token if you want a currency ceiling.

if [ -z "${BASH_VERSION:-}" ]; then
  echo "FAIL: run with bash: curl -fsSL <install.sh> | sudo bash" >&2
  exit 1
fi

set -euo pipefail

CONF=/opt/nginx27/conf.d/fzjzq.conf
ENV_FILE=/etc/askdao.env
PORT=8787
NAME=askdao-api
RAW_BASE="${ASKDAO_RAW_BASE:-https://raw.githubusercontent.com/miny60780-sudo/askdao/main}"
ALLOWED_ORIGIN="https://miny60780-sudo.github.io"

TMPS=()
cleanup() {
  local f
  if [[ ${#TMPS[@]} -gt 0 ]]; then
    for f in "${TMPS[@]}"; do
      rm -f "$f"
    done
  fi
}
trap cleanup EXIT

tmp() {
  local f
  f=$(mktemp)
  TMPS+=("$f")
  printf '%s\n' "$f"
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# True when key=value is present and the value is non-empty. Does not print it.
env_has_nonempty() {
  local key="$1" file="$2"
  awk -v key="$key" '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    {
      line = $0
      sub(/\r$/, "", line)
      if (line ~ /^[ \t]*#/ || line ~ /^[ \t]*$/) next
      sub(/^[ \t]+/, "", line)
      sub(/^export[ \t]+/, "", line)
      eq = index(line, "=")
      if (eq <= 0) next
      k = trim(substr(line, 1, eq - 1))
      if (k != key) next
      v = trim(substr(line, eq + 1))
      if ((v ~ /^".*"$/) || (v ~ /^'\''.*'\''$/)) v = substr(v, 2, length(v) - 2)
      if (length(v) > 0) found = 1
    }
    END { exit found ? 0 : 1 }
  ' "$file"
}

# Prints one non-secret optional value. Never call this for DEEPSEEK_API_KEY.
env_optional() {
  local key="$1" file="$2"
  awk -v key="$key" '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    {
      line = $0
      sub(/\r$/, "", line)
      if (line ~ /^[ \t]*#/ || line ~ /^[ \t]*$/) next
      sub(/^[ \t]+/, "", line)
      sub(/^export[ \t]+/, "", line)
      eq = index(line, "=")
      if (eq <= 0) next
      k = trim(substr(line, 1, eq - 1))
      if (k != key) next
      v = trim(substr(line, eq + 1))
      if ((v ~ /^".*"$/) || (v ~ /^'\''.*'\''$/)) v = substr(v, 2, length(v) - 2)
      print v
      found = 1
      exit
    }
    END { exit found ? 0 : 1 }
  ' "$file"
}

# NET_MODE and NET_LINES are inputs. Sets PLAN_* or returns 1 with PLAN_ERROR.
plan_network() {
  local port="$1"
  local line name gw
  local -a custom=()
  local gw_bridge=""

  PLAN_KIND=""
  PLAN_UPSTREAM=""
  PLAN_RESOLVER=0
  PLAN_LISTEN_HOST=""
  PLAN_DOCKER_ARGS=()
  PLAN_EXTRA_NETS=()
  PLAN_ERROR=""

  if [[ "$NET_MODE" == "host" ]]; then
    PLAN_KIND=host
    PLAN_UPSTREAM="127.0.0.1:${port}"
    PLAN_RESOLVER=0
    PLAN_LISTEN_HOST=127.0.0.1
    PLAN_DOCKER_ARGS=(--network host)
    return 0
  fi

  if [[ "$NET_MODE" == container:* ]]; then
    PLAN_KIND=container-netns
    PLAN_UPSTREAM="127.0.0.1:${port}"
    PLAN_RESOLVER=0
    PLAN_LISTEN_HOST=127.0.0.1
    PLAN_DOCKER_ARGS=(--network "container:nginx27")
    return 0
  fi

  if [[ ${#NET_LINES[@]} -gt 0 ]]; then
    for line in "${NET_LINES[@]}"; do
      line=${line//$'\r'/}
      [[ -z "${line//[[:space:]]/}" ]] && continue
      name=${line%% *}
      if [[ "$line" == *" "* ]]; then
        gw=${line#* }
      else
        gw=""
      fi
      gw=${gw//[[:space:]]/}
      if [[ "$gw" == "<no value>" || "$gw" == "<no" ]]; then
        gw=""
      fi
      if [[ "$name" == "bridge" ]]; then
        gw_bridge=$gw
      elif [[ "$name" != "host" && "$name" != "none" ]]; then
        if [[ ! "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
          PLAN_ERROR="nginx27 network name is not safe to pass to docker: ${name}"
          return 1
        fi
        custom+=("$name")
      fi
    done
  fi

  # Bridge and user-defined networks cannot connect to the host's 127.0.0.1.
  # Share nginx27's namespace so the proxy binds loopback and is not published.
  if [[ ${#custom[@]} -gt 0 || "$NET_MODE" == "bridge" || "$NET_MODE" == "default" || -n "$gw_bridge" ]]; then
    PLAN_KIND=container-netns
    PLAN_UPSTREAM="127.0.0.1:${port}"
    PLAN_RESOLVER=0
    PLAN_LISTEN_HOST=127.0.0.1
    PLAN_DOCKER_ARGS=(--network "container:nginx27")
    return 0
  fi

  PLAN_ERROR="unrecognized nginx27 network mode: ${NET_MODE:-empty}"
  return 1
}

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" != "$want" ]]; then
    fail "self-test ${label}: got [${got}] want [${want}]"
  fi
}

self_test() {
  local joined

  NET_MODE=host
  NET_LINES=("host ")
  plan_network 8787 || fail "self-test host plan: $PLAN_ERROR"
  assert_eq "$PLAN_KIND" host "host kind"
  assert_eq "$PLAN_UPSTREAM" "127.0.0.1:8787" "host upstream"
  assert_eq "$PLAN_RESOLVER" 0 "host resolver"
  assert_eq "$PLAN_LISTEN_HOST" "127.0.0.1" "host listen"
  assert_eq "${PLAN_DOCKER_ARGS[*]}" "--network host" "host docker"

  NET_MODE=container:abc123
  NET_LINES=()
  plan_network 8787 || fail "self-test netns plan: $PLAN_ERROR"
  assert_eq "$PLAN_KIND" container-netns "netns kind"
  assert_eq "$PLAN_UPSTREAM" "127.0.0.1:8787" "netns upstream"
  assert_eq "${PLAN_DOCKER_ARGS[*]}" "--network container:nginx27" "netns docker"

  NET_MODE=bridge
  NET_LINES=("bridge 172.17.0.1")
  plan_network 8787 || fail "self-test bridge plan: $PLAN_ERROR"
  assert_eq "$PLAN_KIND" container-netns "bridge kind"
  assert_eq "$PLAN_UPSTREAM" "127.0.0.1:8787" "bridge upstream"
  assert_eq "$PLAN_LISTEN_HOST" "127.0.0.1" "bridge listen"
  assert_eq "${PLAN_DOCKER_ARGS[*]}" "--network container:nginx27" "bridge docker"

  NET_MODE=web
  NET_LINES=("bridge 172.17.0.1" "web 172.19.0.1" "edge 172.20.0.1")
  plan_network 8787 || fail "self-test user network plan: $PLAN_ERROR"
  assert_eq "$PLAN_KIND" container-netns "user kind"
  assert_eq "$PLAN_UPSTREAM" "127.0.0.1:8787" "user upstream"
  assert_eq "$PLAN_RESOLVER" 0 "user resolver"
  assert_eq "${PLAN_DOCKER_ARGS[*]}" "--network container:nginx27" "user docker"
  joined="${PLAN_EXTRA_NETS[*]:-}"
  assert_eq "$joined" "" "user extra"

  NET_MODE=bridge
  NET_LINES=("bridge ")
  plan_network 8787 || fail "self-test bridge without gateway: $PLAN_ERROR"
  assert_eq "$PLAN_UPSTREAM" "127.0.0.1:8787" "bridge without gateway"

  NET_MODE=none
  NET_LINES=("none ")
  if plan_network 8787; then
    fail "self-test expected none to fail"
  fi

  NET_MODE=web
  NET_LINES=("weird/net 172.18.0.1")
  if plan_network 8787; then
    fail "self-test expected unsafe network name to fail"
  fi

  local envf
  envf=$(mktemp)
  printf '%s\n' '# comment' 'export DEEPSEEK_API_KEY="sk-test"' 'ASKDAO_NODE_IMAGE=node:20-alpine' >"$envf"
  env_has_nonempty DEEPSEEK_API_KEY "$envf" || fail "self-test missed quoted key"
  local image
  image=$(env_optional ASKDAO_NODE_IMAGE "$envf")
  assert_eq "$image" "node:20-alpine" "optional image"
  printf '%s\n' 'DEEPSEEK_API_KEY=' >"$envf"
  if env_has_nonempty DEEPSEEK_API_KEY "$envf"; then
    fail "self-test treated an empty key as present"
  fi
  rm -f "$envf"

  echo "install.sh network self-test passed"
}

if [[ "${1:-}" == "--self-test" ]]; then
  self_test
  exit 0
fi

[[ "$(id -u)" -eq 0 ]] || fail "run as root: curl -fsSL ${RAW_BASE}/server/install.sh | sudo bash"

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v cmp >/dev/null 2>&1 || fail "cmp is not installed"
docker info >/dev/null 2>&1 || fail "docker is installed but the daemon is not reachable"

if [[ -L "$ENV_FILE" ]]; then
  fail "$ENV_FILE is a symlink. Replace it with a regular file that contains DEEPSEEK_API_KEY. This installer does not follow symlinks or look for a key anywhere else."
fi
if [[ ! -f "$ENV_FILE" ]]; then
  fail "$ENV_FILE does not exist. Create it first; this installer does not look for a key anywhere else. Example: printf '%s\\n' 'DEEPSEEK_API_KEY=your-key-here' | sudo tee $ENV_FILE >/dev/null && sudo chmod 600 $ENV_FILE"
fi
if ! env_has_nonempty DEEPSEEK_API_KEY "$ENV_FILE"; then
  fail "$ENV_FILE has no non-empty DEEPSEEK_API_KEY. Add that one line and rerun. This installer does not look for a key anywhere else."
fi
chmod 600 "$ENV_FILE" || fail "could not chmod 600 $ENV_FILE"

if [[ ! -f "$CONF" ]]; then
  fail "$CONF does not exist, so nginx27's site config cannot be updated"
fi
if [[ ! -w "$CONF" ]]; then
  fail "$CONF is not writable"
fi

running=$(docker inspect -f '{{.State.Running}}' nginx27 2>"$(tmp)" || true)
if [[ "$running" != "true" ]]; then
  fail "container nginx27 is not running"
fi

inspect_err=$(tmp)
if ! NET_MODE=$(docker inspect -f '{{.HostConfig.NetworkMode}}' nginx27 2>"$inspect_err"); then
  fail "cannot inspect nginx27 ($(tr '\n' ' ' < "$inspect_err"))"
fi
NET_MODE=${NET_MODE//$'\r'/}
NET_MODE=${NET_MODE#"${NET_MODE%%[![:space:]]*}"}
NET_MODE=${NET_MODE%"${NET_MODE##*[![:space:]]}"}

netfile=$(tmp)
if ! docker inspect -f '{{range $n, $net := .NetworkSettings.Networks}}{{$n}} {{$net.Gateway}}{{"\n"}}{{end}}' nginx27 >"$netfile" 2>"$inspect_err"; then
  fail "cannot read nginx27 networks ($(tr '\n' ' ' < "$inspect_err"))"
fi
NET_LINES=()
mapfile -t NET_LINES < "$netfile"

echo "nginx27 NetworkMode: $NET_MODE"
if [[ ${#NET_LINES[@]} -gt 0 ]]; then
  echo "nginx27 networks:"
  printf '  %s\n' "${NET_LINES[@]}"
fi

plan_network "$PORT" || fail "$PLAN_ERROR"
echo "proxy plan: $PLAN_KIND upstream $PLAN_UPSTREAM resolver=$PLAN_RESOLVER listen=$PLAN_LISTEN_HOST"
[[ "$PLAN_UPSTREAM" =~ ^[A-Za-z0-9.-]+:[0-9]+$ ]] || fail "refusing unsafe upstream address"
[[ "$PLAN_KIND" =~ ^[a-z0-9-]+$ ]] || fail "refusing unsafe network kind"

NODE_IMAGE="${ASKDAO_NODE_IMAGE:-}"
if [[ -z "$NODE_IMAGE" ]]; then
  NODE_IMAGE=$(env_optional ASKDAO_NODE_IMAGE "$ENV_FILE" || true)
fi
if [[ -z "$NODE_IMAGE" ]]; then
  NODE_IMAGE=node:20-alpine
fi
[[ "$NODE_IMAGE" =~ ^[A-Za-z0-9._:/-]+$ ]] || fail "ASKDAO_NODE_IMAGE contains characters this installer will not pass to docker"
echo "node image: ${NODE_IMAGE%%@*}"

if ! docker image inspect "$NODE_IMAGE" >/dev/null 2>&1; then
  echo "pulling $NODE_IMAGE"
  if ! docker pull "$NODE_IMAGE"; then
    if [[ "$NODE_IMAGE" == "node:20-alpine" ]]; then
      mirror="docker.m.daocloud.io/library/node:20-alpine"
      echo "Docker Hub pull failed; trying $mirror"
      if docker pull "$mirror"; then
        docker tag "$mirror" node:20-alpine
        NODE_IMAGE=node:20-alpine
      else
        fail "could not pull node:20-alpine. On a host that cannot reach a registry, load a Node 20 image and set ASKDAO_NODE_IMAGE to its name in $ENV_FILE, then rerun."
      fi
    else
      fail "could not pull $NODE_IMAGE"
    fi
  fi
fi

mkdir -p /opt/askdao-api
src=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  if [[ -f "$script_dir/server.js" ]]; then
    src="$script_dir/server.js"
  fi
fi
if [[ -f /opt/askdao-api/server.js ]]; then
  server_backup="/opt/askdao-api/server.js.bak-$(date +%Y%m%d%H%M%S)"
  cp -a /opt/askdao-api/server.js "$server_backup"
  echo "backed up previous server.js to $server_backup"
fi
mkdir -p /var/lib/askdao /var/log/askdao
chmod 700 /var/lib/askdao /var/log/askdao
if [[ -n "$src" ]]; then
  cp "$src" /opt/askdao-api/server.js
  echo "installed server.js from $src"
else
  url="$RAW_BASE/server/server.js"
  echo "downloading $url"
  downloaded=$(tmp)
  curl -fsSL "$url" -o "$downloaded" || fail "could not download $url"
  grep -q 'DEEPSEEK_API_KEY' "$downloaded" || fail "downloaded file does not look like the AskDao proxy ($url)"
  cp "$downloaded" /opt/askdao-api/server.js
fi
chmod 644 /opt/askdao-api/server.js

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop askdao-api >/dev/null 2>&1 || true
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker rm -f "$NAME" >/dev/null
fi

echo "starting $NAME"
docker_cmd=(docker run -d --name "$NAME")
if [[ "$PLAN_KIND" != "container-netns" ]]; then
  docker_cmd+=(--restart unless-stopped)
fi
docker_cmd+=(
  -e "HOST=127.0.0.1" \
  -e "PORT=$PORT" \
  -e "ASKDAO_ENV_FILE=/etc/askdao.env" \
  -e "ASKDAO_STATE_DIR=/var/lib/askdao" \
  -e "ASKDAO_LOG_FILE=/var/log/askdao/reading.log" \
  -e "NODE_ENV=production" \
  -v "$ENV_FILE:/etc/askdao.env:ro" \
  -v "/var/lib/askdao:/var/lib/askdao" \
  -v "/var/log/askdao:/var/log/askdao" \
  -v "/opt/askdao-api/server.js:/app/server.js:ro" \
  "${PLAN_DOCKER_ARGS[@]}" \
  "$NODE_IMAGE" \
  node /app/server.js
)
if ! "${docker_cmd[@]}" >/dev/null; then
  fail "docker run $NAME failed"
fi
if [[ "$PLAN_KIND" == "container-netns" ]] && command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/askdao-api.service <<'UNIT'
[Unit]
Description=AskDao reading proxy
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=2
ExecStartPre=/bin/bash -c 'for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do docker inspect -f "{{.State.Running}}" nginx27 2>/dev/null | grep -q true && exit 0; sleep 1; done; exit 1'
ExecStart=/usr/bin/docker start -a askdao-api
ExecStop=/usr/bin/docker stop -t 15 askdao-api

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable askdao-api >/dev/null 2>&1 || true
  echo "enabled askdao-api.service so the loopback proxy restarts with nginx27"
fi

if [[ ${#PLAN_EXTRA_NETS[@]} -gt 0 ]]; then
  for net in "${PLAN_EXTRA_NETS[@]}"; do
    docker network connect "$net" "$NAME" || fail "could not attach $NAME to network $net"
  done
fi

healthy=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if docker exec "$NAME" node -e "fetch('http://127.0.0.1:${PORT}/askdao-api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 0.4
done
if [[ "$healthy" -ne 1 ]]; then
  echo "proxy logs:" >&2
  docker logs --tail 50 "$NAME" >&2 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  fail "askdao-api did not become healthy on 127.0.0.1:${PORT} inside the container. Nginx was not changed."
fi
if ! docker exec "$NAME" node -e "fetch('http://127.0.0.1:${PORT}/askdao-api/reading',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://miny60780-sudo.github.io'},body:JSON.stringify({hexagram:1,lines:[7,7,7,7,7,7],question:'Write a python script to scrape the web',lang:'en'})}).then(r=>process.exit(r.status===400?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  echo "proxy logs:" >&2
  docker logs --tail 50 "$NAME" >&2 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  fail "new proxy did not reject an off-topic reading locally. Nginx was not changed."
fi
echo "proxy container is healthy and rejects off-topic readings before the model"

render_nginx() {
  local upstream="$1" resolver="$2" kind="$3" outfile="$4" err
  err=$(tmp)
  if ! docker run --rm \
    -v "/opt/askdao-api/server.js:/app/server.js:ro" \
    -v "$CONF:/conf/fzjzq.conf:ro" \
    "$NODE_IMAGE" \
    node /app/server.js --patch-nginx /conf/fzjzq.conf "$upstream" "$resolver" "$kind" \
    >"$outfile" 2>"$err"; then
    RENDER_ERR=$(tr '\n' ' ' < "$err")
    return 1
  fi
  if [[ ! -s "$outfile" ]] || ! grep -q '# BEGIN askdao-api' "$outfile" || ! grep -q 'location /askdao-api/' "$outfile"; then
    RENDER_ERR="patcher output was empty or missing location /askdao-api/"
    return 1
  fi
  return 0
}

write_nginx() {
  local outfile="$1"
  if cmp -s "$CONF" "$outfile"; then
    echo "nginx config already contains this askdao-api block"
    return 0
  fi
  if [[ -z "$backup" ]]; then
    backup="${CONF}.bak-askdao-$(date +%Y%m%d%H%M%S)"
    cp -a "$CONF" "$backup" || fail "could not back up $CONF"
    echo "backed up $CONF to $backup"
  fi
  cat "$outfile" > "$CONF"
  changed=1
  echo "updated $CONF"
}

restore_nginx() {
  if [[ "$changed" -eq 1 && -n "$backup" ]]; then
    cat "$backup" > "$CONF"
    echo "restored $CONF from $backup" >&2
  fi
}

newconf=$(tmp)
backup=""
changed=0
RENDER_ERR=""
render_nginx "$PLAN_UPSTREAM" "$PLAN_RESOLVER" "$PLAN_KIND" "$newconf" || fail "could not render the nginx location (${RENDER_ERR})"
write_nginx "$newconf"

tlog=$(tmp)
if ! docker exec nginx27 nginx -t >"$tlog" 2>&1; then
  if [[ "$PLAN_RESOLVER" -eq 1 ]]; then
    net_name="${PLAN_DOCKER_ARGS[1]:-}"
    container_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"${net_name}\").IPAddress}}" "$NAME" 2>/dev/null || true)
    if [[ "$container_ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
      echo "nginx -t rejected DNS upstream ${PLAN_UPSTREAM}; trying ${container_ip}:${PORT}"
      ipconf=$(tmp)
      if render_nginx "${container_ip}:${PORT}" 0 container-ip "$ipconf"; then
        write_nginx "$ipconf"
        if docker exec nginx27 nginx -t >"$tlog" 2>&1; then
          PLAN_UPSTREAM="${container_ip}:${PORT}"
          PLAN_RESOLVER=0
          PLAN_KIND=container-ip
        fi
      fi
    fi
  fi
fi
if ! docker exec nginx27 nginx -t >"$tlog" 2>&1; then
  restore_nginx
  fail "nginx -t failed: $(tr '\n' ' ' < "$tlog")"
fi
echo "nginx -t passed"

dump=$(tmp)
docker exec nginx27 nginx -T >"$dump" 2>>"$tlog" || true
if ! grep -q '# BEGIN askdao-api' "$dump"; then
  restore_nginx
  docker exec nginx27 nginx -s reload >/dev/null 2>&1 || true
  mounts=$(docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' nginx27 2>/dev/null || true)
  fail "nginx -t passed but nginx27 did not load the askdao-api block from $CONF. The live config may be a different file. Mounts: $(echo "$mounts" | tr '\n' ' ')"
fi

if [[ "$changed" -eq 1 ]]; then
  if ! docker exec nginx27 nginx -s reload >"$tlog" 2>&1; then
    cat "$backup" > "$CONF"
    docker exec nginx27 nginx -s reload >/dev/null 2>&1 || true
    echo "restored $CONF from $backup" >&2
    fail "nginx reload failed: $(tr '\n' ' ' < "$tlog")"
  fi
  echo "nginx reloaded"
  sleep 0.5
else
  echo "nginx config unchanged; left the running workers as they are"
fi

# Returns 0 when curl gets an HTTP status. Connection failures return 1 and append CONNECT_NOTE.
CONNECT_NOTE=""
consider() {
  local note="$1"
  shift
  local hdr body errf code rc
  hdr=$(tmp)
  body=$(tmp)
  errf=$(tmp)
  set +e
  code=$(curl -sS -m 25 -D "$hdr" -o "$body" -w '%{http_code}' "$@" 2>"$errf")
  rc=$?
  set -e
  if [[ $rc -ne 0 || "$code" == "000" || -z "$code" ]]; then
    CONNECT_NOTE+="${note}: $(head -c 220 "$errf" | tr '\n' ' '); "
    return 1
  fi
  if [[ "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
    CONNECT_NOTE+="${note}: HTTP ${code} redirect; "
    return 1
  fi
  LAST_CODE=$code
  LAST_HDR=$hdr
  LAST_BODY=$body
  LAST_NOTE=$note
  return 0
}

ours() {
  if cors_ok; then
    return 0
  fi
  if grep -Eiq '^content-type:[[:space:]]*application/json' "$LAST_HDR"; then
    return 0
  fi
  return 1
}

hit() {
  local method="$1" path="$2" data="$3" skip_origin="${4:-}"
  local -a base=()
  if [[ "$skip_origin" != "no-origin" ]]; then
    base+=(-H "Origin: ${ALLOWED_ORIGIN}")
  fi
  CONNECT_NOTE=""
  FALLBACK=0
  if [[ "$method" == "OPTIONS" ]]; then
    base+=(-X OPTIONS -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type")
  else
    base+=(-X POST -H "Content-Type: application/json" --data-binary "$data")
  fi

  attempt() {
    local note="$1"
    shift
    if ! consider "$note" "${base[@]}" "$@"; then
      return 1
    fi
    if ours; then
      return 0
    fi
    if [[ "$FALLBACK" -eq 0 ]]; then
      FALLBACK=1
      FB_CODE=$LAST_CODE
      FB_HDR=$LAST_HDR
      FB_BODY=$LAST_BODY
      FB_NOTE=$LAST_NOTE
    fi
    CONNECT_NOTE+="${note}: HTTP ${LAST_CODE} was not the askdao proxy; "
    return 1
  }

  if attempt "https://www.fzjzq.com${path} via 127.0.0.1:443" --resolve "www.fzjzq.com:443:127.0.0.1" "https://www.fzjzq.com${path}"; then
    return 0
  fi
  if attempt "http://127.0.0.1${path}" -H "Host: www.fzjzq.com" "http://127.0.0.1${path}"; then
    return 0
  fi
  if attempt "https://www.fzjzq.com${path}" "https://www.fzjzq.com${path}"; then
    return 0
  fi
  if [[ "$FALLBACK" -eq 1 ]]; then
    LAST_CODE=$FB_CODE
    LAST_HDR=$FB_HDR
    LAST_BODY=$FB_BODY
    LAST_NOTE=$FB_NOTE
    return 0
  fi
  return 1
}

cors_ok() {
  grep -Eiq "^access-control-allow-origin:[[:space:]]*${ALLOWED_ORIGIN}[[:space:]]*\r?$" "$LAST_HDR"
}

json_field() {
  local file="$1" key="$2"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys
j=json.load(open(sys.argv[1], encoding="utf-8"))
v=j.get(sys.argv[2], "")
if v is None: v=""
sys.stdout.write(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False))' "$file" "$key"
    return
  fi
  docker run --rm -v "$file:/body.json:ro" "$NODE_IMAGE" \
    node -e 'const j=require("/body.json"); const v=j[process.argv[1]]; process.stdout.write(v==null?"":String(v))' "$key"
}

if ! hit OPTIONS /askdao-api/reading ""; then
  fail "could not reach /askdao-api/reading through nginx (${CONNECT_NOTE:-no route}). Upstream is ${PLAN_UPSTREAM}."
fi
if [[ "$LAST_CODE" != "204" && "$LAST_CODE" != "200" ]]; then
  fail "OPTIONS /askdao-api/reading via ${LAST_NOTE} returned HTTP ${LAST_CODE}, so the browser preflight would fail. Upstream is ${PLAN_UPSTREAM}."
fi
if ! cors_ok; then
  fail "OPTIONS /askdao-api/reading via ${LAST_NOTE} returned HTTP ${LAST_CODE} without Access-Control-Allow-Origin: ${ALLOWED_ORIGIN}. A server-level nginx rule may be answering the preflight before location /askdao-api/. The browser on GitHub Pages would still fail."
fi
echo "preflight OK via ${LAST_NOTE} (HTTP ${LAST_CODE})"

plain='{"hexagram":1,"lines":[7,7,7,7,7,7],"question":"Should I change careers?","lang":"en"}'
offtopic='{"hexagram":1,"lines":[7,7,7,7,7,7],"question":"Write a python script to scrape the web","lang":"en"}'
if ! hit POST /askdao-api/reading "$plain" no-origin; then
  fail "no-Origin probe did not reach nginx (${CONNECT_NOTE:-no route}). Upstream is ${PLAN_UPSTREAM}."
fi
if [[ "$LAST_CODE" != "403" ]]; then
  fail "POST without Origin via ${LAST_NOTE} returned HTTP ${LAST_CODE}, expected 403 with no model call. Upstream is ${PLAN_UPSTREAM}."
fi
echo "no-Origin probe rejected via ${LAST_NOTE} (HTTP ${LAST_CODE})"
if ! hit POST /askdao-api/reading "$offtopic"; then
  fail "off-topic probe did not reach nginx (${CONNECT_NOTE:-no route}). Upstream is ${PLAN_UPSTREAM}."
fi
if [[ "$LAST_CODE" != "400" ]]; then
  snippet=$(head -c 240 "$LAST_BODY" | tr '\n' ' ')
  fail "off-topic probe via ${LAST_NOTE} returned HTTP ${LAST_CODE} (${snippet}), expected 400 with no model call."
fi
if ! cors_ok; then
  fail "off-topic rejection had no Access-Control-Allow-Origin, so the GitHub Pages page could not read the error."
fi
echo "off-topic probe rejected via ${LAST_NOTE} (HTTP ${LAST_CODE})"
echo "smoke test did not call the model"
echo "OK"
