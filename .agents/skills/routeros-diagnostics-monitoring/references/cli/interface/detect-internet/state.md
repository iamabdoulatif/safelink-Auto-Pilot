# /interface/detect-internet/state

> Source: https://manual.mikrotik.com/docs/cli-reference/interface/detect-internet/state

Type: Directory

Read-only state of each interface that Detect Internet watches (the interfaces of `detect-interface-list` in [`/interface/detect-internet`](../detect-internet.md)). See [Detect Internet](../../../guides/diagnostics-monitoring-and-troubleshooting/detect-internet.md).

**Read-only arguments**

- `name` (iface_enum): The watched interface.
- `state` (enum: no-link | unknown | lan | wan | internet | slave): State of the interface:
  - `no-link` - The interface has no link.
  - `unknown` - The router is checking the interface, for about 6 seconds.
  - `lan` - The start state of layer 2 interfaces, and the state after a link change. An interface that stays `lan` for an hour is locked until its next link change.
  - `wan` - The router's active route to 8.8.8.8 goes through the interface. Layer 3 tunnels become `wan` when their link comes up. A `wan` interface goes back to `lan` only after a link change.
  - `internet` - A `wan` interface through which the router reaches `cloud.mikrotik.com` on UDP port 30000.
  - `slave` - The interface is a port of a bridge or another interface.
- `state-change-time` (date): When the interface got its current state.
- `cloud-rtt` (time): Round-trip time of the last cloud check through the interface. Empty when the interface is not `internet`.
