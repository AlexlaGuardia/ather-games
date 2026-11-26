#!/usr/bin/env python3
"""devfwd: forward a lane's dev port onto the ONE shared dev server (2026-11-26, serb).

    python3 tools/devfwd.py <listen_port> <target_port>

Raw TCP, so HMR websockets pass through untouched. ~15 MB, against ~2 GB for a `next dev` of
its own: that difference is the whole point. Every lane edits the same working tree, so N dev
servers compiled the same code N times, and on the 8 GB box four of them was an OOM shed
(four sheds on 11-26). See tools/devwin.sh.
"""
import asyncio
import sys


async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle(client_r, client_w, target):
    try:
        up_r, up_w = await asyncio.open_connection("127.0.0.1", target)
    except OSError:
        client_w.close()  # shared server down or still compiling: refuse like a closed port
        return
    await asyncio.gather(pipe(client_r, up_w), pipe(up_r, client_w))


async def main(listen, target):
    server = await asyncio.start_server(lambda r, w: handle(r, w, target), "127.0.0.1", listen)
    print(f">> devfwd :{listen} -> shared dev server :{target}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: devfwd.py <listen_port> <target_port>")
    try:
        asyncio.run(main(int(sys.argv[1]), int(sys.argv[2])))
    except KeyboardInterrupt:
        pass
