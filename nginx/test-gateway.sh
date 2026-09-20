#!/usr/bin/env bash
#
# Isolated Nginx gateway verification for the /api/v1/ POS backend proxy.
#
# Runs the real nginx/default.conf inside a temporary Docker container with the
# two production LAN upstreams (192.168.1.35 and 192.168.1.89) substituted by a
# local stub backend container. No connection is ever made to a real LAN host.
#
# Usage: ./nginx/test-gateway.sh [path-to-app-dist]
set -euo pipefail

cd "$(dirname "$0")/.."

NET=nginx-gw-test-$$
STUB_IMAGE=python:3.12-alpine
NGINX_IMAGE=nginxinc/nginx-unprivileged:alpine
WORK=$(mktemp -d)
trap 'docker rm -f gw-nginx-$$ gw-stub-$$ >/dev/null 2>&1; docker network rm $NET >/dev/null 2>&1; rm -rf "$WORK"' EXIT

echo "==> Preparing test configuration (LAN IPs substituted with stub hostname)"
sed -e 's/192\.168\.1\.35/stub/' -e 's/192\.168\.1\.89/stub/' \
	nginx/default.conf > "$WORK/default.conf"
grep -q "proxy_pass http://stub:18080;" "$WORK/default.conf" || {
	echo "FAIL: upstream substitution missing"; exit 1; }
# The production upstream must be the bare host:port form (no trailing slash,
# so the original /api/v1/ prefix is preserved).
grep -q "proxy_pass http://192.168.1.35:18080;" nginx/default.conf || {
	echo "FAIL: production default.conf must proxy to http://192.168.1.35:18080 (no path rewrite)"; exit 1; }
grep -q "proxy_pass http://192.168.1.35:18080/;" nginx/default.conf && {
	echo "FAIL: trailing slash would strip the /api/v1/ prefix"; exit 1; }
if grep -q "192.168.1.34" nginx/default.conf; then
	echo "FAIL: OCR host must never be proxied"; exit 1
fi

cat > "$WORK/nginx.conf" <<'EOF'
worker_processes 1;
error_log /dev/stderr;
pid /tmp/nginx.pid;
events { worker_connections 64; }
http {
	access_log /dev/stdout;
	include /etc/nginx/mime.types;
	default_type application/octet-stream;
	server_tokens off;
	client_body_temp_path /tmp/client_temp;
	proxy_temp_path /tmp/proxy_temp;
	fastcgi_temp_path /tmp/fastcgi_temp;
	uwsgi_temp_path /tmp/uwsgi_temp;
	scgi_temp_path /tmp/scgi_temp;
	include /test/default.conf;
}
EOF

cat > "$WORK/stub.py" <<'EOF'
import hashlib, os, random, socketserver, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BINARY = bytes(random.Random(42).randbytes(65536)) * 2  # 128 KiB deterministic blob
with open("/tmp/stub-binary.bin", "wb") as f:
	f.write(BINARY)

class Handler(BaseHTTPRequestHandler):
	def log_message(self, *a): pass
	def _respond(self, code=200, body=b"ok\n", ctype="text/plain"):
		self.send_response(code)
		self.send_header("Content-Type", ctype)
		self.send_header("Content-Length", str(len(body)))
		self.end_headers()
		self.wfile.write(body)
	def do_GET(self):
		if self.path.endswith("/binary"):
			self._respond(200, BINARY, "application/octet-stream"); return
		self._respond(200, f"STUB GET {self.path}\n".encode())
	def do_POST(self):
		length = int(self.headers.get("Content-Length", 0))
		body = self.rfile.read(length)
		with open("/tmp/stub-last-request.txt", "w") as f:
			f.write(f"{self.command} {self.path}\n")
			for k, v in self.headers.items():
				if k.lower() in ("authorization", "cookie"): v = "<redacted>"
				f.write(f"{k}: {v}\n")
			f.write(f"BODY_BYTES={len(body)}\n")
		self._respond(200, f"STUB POST {self.path} bytes={len(body)}\n".encode())

def serve(port):
	ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()

threading.Thread(target=serve, args=(18080,), daemon=True).start()
threading.Thread(target=serve, args=(5000,), daemon=True).start()
serve(80)  # 'app' upstream; also blocks
EOF

echo "==> Starting stub backend and nginx containers"
docker network create "$NET" >/dev/null
docker run -d --name gw-stub-$$ --network "$NET" \
	--network-alias stub --network-alias app \
	-v "$WORK/stub.py:/stub.py" "$STUB_IMAGE" python /stub.py >/dev/null
# Wait until the stub answers before validating/routing.
for _ in $(seq 1 30); do
	docker exec gw-stub-$$ python -c "import socket;s=socket.create_connection(('127.0.0.1',18080),1)" >/dev/null 2>&1 && break
	sleep 1
done
docker run -d --name gw-nginx-$$ --network "$NET" -p 127.0.0.1:18099:8080 \
	-v "$WORK/nginx.conf:/etc/nginx/nginx.conf:ro" \
	-v "$WORK/default.conf:/test/default.conf:ro" \
	"$NGINX_IMAGE" >/dev/null
sleep 2

fail() { echo "FAIL: $1"; exit 1; }
BASE=http://127.0.0.1:18099

echo "==> 1. nginx -t validates the configuration"
docker exec gw-nginx-$$ nginx -t 2>&1 | grep -q "syntax is ok" || fail "nginx -t"
docker exec gw-nginx-$$ nginx -t 2>&1 | grep -q "test is successful" || fail "nginx -t"
echo "    OK"

echo "==> 2. / serves the Astro app (stubbed app upstream)"
result=$(curl -sS --retry 10 --retry-connrefused --retry-delay 1 "$BASE/" 2>&1)
echo "$result" | grep -q "STUB GET /" || fail "static route not proxied to app upstream: $result"
echo "    OK"

echo "==> 3. /api/v1/auth/me reaches the stub with path unchanged"
result=$(curl -sS "$BASE/api/v1/auth/me")
echo "$result" | grep -q "STUB GET /api/v1/auth/me" || fail "path not preserved: $result"
echo "    OK"

echo "==> 4. /api/voice configuration remains present and unchanged in behavior"
grep -q "location /api/voice" nginx/default.conf || fail "/api/voice location missing"
grep -q "proxy_pass http://192.168.1.89:5000/voice;" nginx/default.conf || fail "/api/voice proxy_pass changed"
grep -q "proxy_read_timeout 300" nginx/default.conf || fail "/api/voice timeouts changed"
result=$(curl -sS "$BASE/api/voice")
echo "$result" | grep -q "STUB GET /voice" || fail "/api/voice behavior changed: $result"
echo "    OK"

echo "==> 5. Upload larger than the default 1 MiB limit reaches the backend"
head -c 2097152 /dev/urandom > "$WORK/big.bin"
result=$(curl -sS -X POST --data-binary "@$WORK/big.bin" \
	-H "Content-Type: application/zip" "$BASE/api/v1/pos-records")
echo "$result" | grep -q "bytes=2097152" || fail "large upload did not reach backend: $result"
echo "    OK"

echo "==> 6. A synthetic binary response passes through byte-for-byte"
docker exec gw-stub-$$ python -c "import hashlib;print(hashlib.sha256(open('/stub.py','rb').read()).hexdigest())" >/dev/null
local_sum=$(sha256sum "$WORK/big.bin" | cut -d' ' -f1)
# Compare the sha256 of the bytes that curl receives through nginx against the
# sha256 computed inside the stub container itself (proving a byte-for-byte
# pass through nginx without relying on the local Python version).
remote_sum=$(curl -sS "$BASE/api/v1/binary" | sha256sum | cut -d' ' -f1)
expected_sum=$(docker exec gw-stub-$$ python -c "import hashlib;print(hashlib.sha256(open('/tmp/stub-binary.bin','rb').read()).hexdigest())")
[ "$remote_sum" = "$expected_sum" ] || fail "binary passthrough mismatch ($remote_sum != $expected_sum)"
echo "    OK"

echo "==> 7. Forwarded headers and HTTPS scheme reach the backend"
docker exec gw-stub-$$ cat /tmp/stub-last-request.txt | grep -qi "X-Forwarded-Proto: https" \
	|| fail "X-Forwarded-Proto https missing"
docker exec gw-stub-$$ cat /tmp/stub-last-request.txt | grep -qi "X-Forwarded-Port: 443" \
	|| fail "X-Forwarded-Port missing"
echo "    OK"

echo "==> 8. No LAN connection was attempted (stub-only network)"
# The stub container's network has no route to the LAN: nginx only ever talked
# to the 'stub' alias, as proven by the requests logged above. Additionally
# assert the test config contains no production LAN address.
grep -q "192.168.1.35" "$WORK/default.conf" && fail "LAN address leaked into test config"
grep -q "192.168.1.34" "$WORK/default.conf" && fail "OCR address leaked into test config"
echo "    OK"

if [ -d app/dist ]; then
	echo "==> 9. Built frontend bundle check"
	if grep -rqE "192\.168\.1\.(34|35)" app/dist/pos 2>/dev/null; then
		fail "built frontend contains a LAN address"
	fi
	echo "    OK (no LAN address in app/dist/pos)"
else
	echo "==> 9. Skipping built bundle check (app/dist not present; run 'npm run build')"
fi

echo
echo "All Nginx gateway tests passed."
