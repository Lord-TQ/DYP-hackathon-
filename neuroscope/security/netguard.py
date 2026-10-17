"""Network guard: while enabled, any attempt to open a connection or resolve a host name raises
NetworkBlockedError and is recorded and logged.

It patches the Python-level socket API (socket.socket.connect/connect_ex/sendto/sendmsg,
socket.create_connection, getaddrinfo, gethostbyname[_ex], gethostbyaddr, getnameinfo). urllib,
http.client, requests, httpx and aiohttp all go through these. It cannot see C extensions that open
sockets in native code without calling Python's socket module, nor other processes.
"""
import contextlib
import logging
import socket
import threading
import traceback

log = logging.getLogger("neuroscope.security.netguard")


class NetworkBlockedError(RuntimeError):
    pass


_lock = threading.Lock()
_originals = {}
attempts = []          # list of (operation, short target description, caller "file:line")


def _caller() -> str:
    for frame in reversed(traceback.extract_stack()[:-2]):
        if "netguard" not in frame.filename:
            return f"{frame.filename.replace(chr(92), '/').rsplit('/', 1)[-1]}:{frame.lineno}"
    return "?"


def _blocked(op: str):
    def handler(*args, **kwargs):
        target = ""
        for a in args:
            if isinstance(a, (tuple, str, bytes)) and not isinstance(a, socket.socket):
                target = str(a)[:60]
                break
        where = _caller()
        attempts.append((op, target, where))
        log.error("BLOCKED network attempt: %s %s from %s", op, target, where)
        raise NetworkBlockedError(f"Network access is disabled by the NeuroScope network guard ({op}).")
    return handler


_PATCHES = {
    (socket.socket, "connect"): "socket.connect",
    (socket.socket, "connect_ex"): "socket.connect_ex",
    (socket.socket, "sendto"): "socket.sendto",
    (socket.socket, "sendmsg"): "socket.sendmsg",
    (socket, "create_connection"): "socket.create_connection",
    (socket, "getaddrinfo"): "socket.getaddrinfo",
    (socket, "gethostbyname"): "socket.gethostbyname",
    (socket, "gethostbyname_ex"): "socket.gethostbyname_ex",
    (socket, "gethostbyaddr"): "socket.gethostbyaddr",
    (socket, "getnameinfo"): "socket.getnameinfo",
}


def is_enabled() -> bool:
    return bool(_originals)


def enable():
    """Block all network access in this process (idempotent)."""
    with _lock:
        if _originals:
            return
        for (owner, attr), op in _PATCHES.items():
            if hasattr(owner, attr):
                _originals[(owner, attr)] = getattr(owner, attr)
                setattr(owner, attr, _blocked(op))
    log.info("network guard enabled")


def disable():
    with _lock:
        for (owner, attr), orig in _originals.items():
            setattr(owner, attr, orig)
        _originals.clear()


@contextlib.contextmanager
def network_guard():
    """Context manager: block the network inside the block; yields the list of new attempts."""
    was = is_enabled()
    start = len(attempts)
    enable()
    seen = []
    try:
        yield seen
    finally:
        seen.extend(attempts[start:])
        if not was:
            disable()
