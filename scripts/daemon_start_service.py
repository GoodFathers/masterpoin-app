#!/usr/bin/env python3
"""Daemon launcher untuk mini-service IndiGoo (call :3003 / chat :3004).

Double-fork (fork -> setsid -> fork -> exec) agar proses menjadi anak PID 1
dan TETAP HIDUP setelah sesi tool-call ditutup — pola nohup/setsid biasa
dibersihkan oleh sandbox saat sesi berakhir.

Pemakaian:
    python3 scripts/daemon_start_service.py call   # mini-services/call-service (3003)
    python3 scripts/daemon_start_service.py chat   # mini-services/chat-realtime-service (3004)
"""

import os
import sys

BASE = "/home/z/my-project"
SERVICES = {
    "call": (
        f"{BASE}/mini-services/call-service",
        "/tmp/daemon-call.log",
    ),
    "chat": (
        f"{BASE}/mini-services/chat-realtime-service",
        "/tmp/daemon-chat.log",
    ),
}


def daemonize(cwd: str, logfile: str) -> None:
    # Fork 1 — lepas dari sesi induk
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    # Fork 2 — pastikan bukan leader sesi, tidak bisa membuka terminal lagi
    if os.fork() > 0:
        os._exit(0)

    sys.stdout.flush()
    sys.stderr.flush()
    fd = os.open(logfile, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, 0)
    os.chdir(cwd)


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in SERVICES:
        print(__doc__)
        sys.exit(2)
    cwd, logfile = SERVICES[sys.argv[1]]
    daemonize(cwd, logfile)
    os.execvp("bun", ["bun", "run", "dev"])


if __name__ == "__main__":
    main()
