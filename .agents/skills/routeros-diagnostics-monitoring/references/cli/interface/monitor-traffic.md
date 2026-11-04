# /interface/monitor-traffic

> Source: https://manual.mikrotik.com/docs/cli-reference/interface/monitor-traffic

Type: Command

Real-time per-interface throughput (rates per second). Multiple interfaces print side-by-side columns; the table refreshes continuously. Use `duration` to bound it.

**Arguments**

- `interface` (multi { array-id, interface: iface_enum }): Interfaces to watch (or `aggregate` for the combined view)

**Read-only arguments**

- `name` (string): Interface name
- `rx-packets-per-second` (num): Received packets per second
- `rx-bits-per-second` (num): Received bits per second
- `fp-rx-packets-per-second` (num): Fast Path received packets per second
- `fp-rx-bits-per-second` (num): Fast Path received bits per second
- `rx-drops-per-second` (num): Receive drops per second
- `rx-errors-per-second` (num): Receive errors per second
- `tx-packets-per-second` (num): Transmitted packets per second
- `tx-bits-per-second` (num): Transmitted bits per second
- `fp-tx-packets-per-second` (num): Fast Path transmitted packets per second
- `fp-tx-bits-per-second` (num): Fast Path transmitted bits per second
- `tx-drops-per-second` (num): Transmit drops per second
- `tx-queue-drops-per-second` (num): Interface queue drops per second
- `tx-errors-per-second` (num): Transmit errors per second
