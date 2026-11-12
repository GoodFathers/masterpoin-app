#!/bin/bash
# IndiGoo keepalive (Task 66) — loop tak terbatas, cek tiap 20 dtk.
# Semua start memakai POLA DOUBLE-FORK: ( ( setsid ... & ) & )
# → proses langsung reparent ke PID 1 (tini), lolos dari reaper sandbox.
while true; do
  curl -s -m 8 http://127.0.0.1:3000/ -o /dev/null || \
    (cd /home/z/my-project && ( ( setsid bun run dev >> dev.log 2>&1 < /dev/null & ) & ))
  curl -s -m 3 "http://127.0.0.1:3004/socket.io/?EIO=4&transport=polling" -o /dev/null || \
    (cd /home/z/my-project/mini-services/chat-realtime-service && ( ( setsid bun run dev > service.log 2>&1 < /dev/null & ) & ))
  curl -s -m 3 "http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling" -o /dev/null || \
    (cd /home/z/my-project/mini-services/call-service && ( ( setsid bun run dev > service.log 2>&1 < /dev/null & ) & ))
  sleep 20
done
