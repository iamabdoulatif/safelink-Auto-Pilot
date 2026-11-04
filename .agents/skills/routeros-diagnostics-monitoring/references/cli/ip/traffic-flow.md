# /ip/traffic-flow

> Source: https://manual.mikrotik.com/docs/cli-reference/ip/traffic-flow

Type: Settings Directory

Traffic-Flow (NetFlow/IPFIX-compatible) configuration. Turn it on with `enabled=yes` and add export destinations under [`target`](traffic-flow/target.md). Flows pass only through the CPU path of the router, so HW-offloaded traffic cannot be exported. See the [Traffic Flow](../../guides/diagnostics-monitoring-and-troubleshooting/traffic-flow.md) guide.

**Arguments**

- `enabled` (bool): Enable or disable the Traffic-Flow service
- `interfaces` (multi { array-id, interface-or-list: alt { interface: iface_enum { local:0, all:0xFFFFFFFF } , interface-list: enum } }): Comma-separated interface names (or `all`) whose forwarded traffic is accounted
- `cache-entries` (enum (1k | 2k | 4k | 8k | 16k | 32k | 64k | 128k | 256k | 512k | 1M | 2M | 4M | 8M | 16M | 32M) { 1k:0x400, 2k:0x800, 4k:0x1000, 8k:0x2000, 16k:0x4000, 32k:0x8000, 64k:0x10000, 128k:0x20000, 256k:0x40000, 512k:0x80000, 1M:0x100000, 2M:0x200000, 4M:0x400000, 8M:0x800000, 16M:0x1000000, 32M:0x2000000 }): Number of flow records held in memory at once (the default value depends on the device memory: 256k on larger boards, down to 4k on the smallest)
- `active-flow-timeout` (time): Maximum lifetime of a flow, even when packets keep matching it; the flow is expired and exported after this time. Default: 30m
- `inactive-flow-timeout` (time): A flow that sees no packet for this long is expired and exported; the next packet starts a new flow. If the timeout is too small, it can create many flows and overflow the buffer. Default: 15s
- `packet-sampling` (bool): Enable packet sampling: packets are accounted only per `sampling-interval` and `sampling-space`
- `sampling-interval` (num): Number of consecutive packets that are sampled in each sampling cycle
- `sampling-space` (num): Number of consecutive packets that are omitted in each sampling cycle

## Commands

### /ip/traffic-flow/monitor

Type: Command

Show the current flow-cache counters (live-updating output; stops after `duration`).

**Read-only arguments**

- `finished-flows` (num): Number of flows that expired and were exported
- `active-flows` (num): Number of flows in the cache right now
- `unmanaged-packets` (num): Packets that did not fit into any tracked flow
- `unmanaged-bytes` (num): Bytes of the unmanaged packets
