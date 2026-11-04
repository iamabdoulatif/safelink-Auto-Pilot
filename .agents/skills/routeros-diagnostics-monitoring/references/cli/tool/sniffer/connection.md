# /tool/sniffer/connection

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/connection

Type: Directory

The TCP connections seen in the last capture. See [Packet sniffer](../../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Flags**

- `A` (active): Active connection.

**Read-only arguments**

- `src-address` (composite { address: ipAddr , port: enum () }): Address and port of the side that opened the connection, with the service name where known.
- `dst-address` (composite { address: ipAddr , port: enum () }): Address and port of the other side, with the service name where known, for example `192.168.88.36:80 (http)`.
- `bytes` (composite { in: num , out: num }): Captured bytes sent by the source and by the destination, shown as source/destination.
- `resends` (composite { in: num , out: num }): Retransmissions seen from the source and from the destination (source/destination).
- `mss` (composite { in: num , out: num }): TCP maximum segment size announced by the source and by the destination (source/destination).
