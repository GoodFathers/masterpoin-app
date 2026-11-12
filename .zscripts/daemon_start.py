#!/usr/bin/env python3
"""
Daemonisasi dev server IndiGoo — pola double-fork yang terbukti selamat
dari reaper sandbox antar sesi bash tool (meniru mekanisme agent-browser:
fork -> setsid -> fork -> exec, PPID 1).

Pemakaian: python3 .zscripts/daemon_start.py
Log: /tmp/next-daemon.log (dan tee ke dev.log via bun run dev)
"""
import os
import sys
import time

PROJECT = "/home/z/my-project"
LOG = "/tmp/next-daemon.log"


def log(msg: str) -> None:
    with open(LOG, "a") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")


def fork_and_exit_parent() -> "int":
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    return pid


def main() -> None:
    log("daemon_start: mulai (fork 1)")
    fork_and_exit_parent()
    os.setsid()
    log("daemon_start: setsid OK (fork 2)")
    fork_and_exit_parent()

    os.chdir(PROJECT)
    # Lepas fd standar, arahkan ke log
    sys.stdout.flush()
    sys.stderr.flush()
    log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, 0)

    log("daemon_start: exec bun run dev")
    os.execvp("bun", ["bun", "run", "dev"])


if __name__ == "__main__":
    main()
