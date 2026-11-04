# /tool/sniffer/protocol

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/protocol

Type: Directory

Packets and bytes of the last capture per MAC protocol, IP protocol and port, with each row's share of all captured bytes. A packet counts in every row it belongs to: for a TCP packet, the `ip` row, the `ip`/`tcp` row and a row for each of its ports. See [Packet sniffer](../../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Read-only arguments**

- `protocol` (enum): MAC (L2) protocol, for example `ip`, `arp`, `ipv6` or `802.2`.
- `ip-protocol` (enum: ip): IP protocol, for example `icmp`, `tcp` or `udp`. Empty on the row that counts a whole MAC protocol.
- `port` (enum): Port, with its service name where known, for example `80 (http)`. Empty on the rows that count a whole protocol.
- `packets` (num): Number of captured packets in this row.
- `bytes` (num): Number of captured bytes in this row.
- `share` (num): Share of this row's bytes in all captured bytes, in percent.
