# /tool/sniffer/packet

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/packet

Type: Directory

The packets that the last run of [`start`](../sniffer.md) captured, kept in memory for 10 minutes after the sniffer stops, or until the next start. `time` counts seconds from the start of the capture, shown with microseconds. See [Packet sniffer](../../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Read-only arguments**

- `time` (num): Time offset of the packet relative to the start of the capture, in seconds with microsecond precision.
- `num` (num): Packet sequence number, starting from 0 for the first captured packet.
- `direction` (enum: rx | tx): Direction of the packet relative to the router, `rx` received, `tx` sent.
- `src-mac` (macAddr): Source MAC address of the frame, shown only for interfaces that have a MAC address, for example Ethernet, WiFi, EoIP, VXLAN or VLAN.
- `dst-mac` (macAddr): Destination MAC address of the frame, shown only for interfaces that have a MAC address, for example Ethernet, WiFi, EoIP, VXLAN or VLAN.
- `vlan` (object { vlan: composite { id: num , prio: [ num] } }): VLAN tag of the frame, displayed as `id:priority`.
- `interface` (iface_enum): Interface on which the packet was captured.
- `src-address` (composite { address: alt { ip: ipAddr , ipv6: ip6Addr } , port: enum () }): Source IP address and source port of the packet, displayed as `address:port`.
- `dst-address` (composite { address: alt { ip: ipAddr , ipv6: ip6Addr } , port: enum () }): Destination IP address and destination port of the packet, displayed as `address:port`.
- `protocol` (enum): MAC (L2) protocol of the frame, for example `ip`, `arp` or `ipv6`.
- `ip-protocol` (enum: ip): IP protocol of the packet, for example `icmp`, `tcp` or `udp`.
- `size` (num): Total frame size in bytes, including the L2 header.
- `cpu` (num): CPU core on which the packet was processed.
- `ip-packet-size` (num): Size of the IP packet in bytes.
- `ip-header-size` (num): Size of the IP header in bytes.
- `dscp` (num): DSCP (Differentiated Services Code Point) field of the IP header.
- `ecn` (num): ECN (Explicit Congestion Notification) field of the IP header.
- `identification` (num): Identification field of the IP header.
- `fragment-offset` (num): Fragment offset field of the IP header.
- `ttl` (num): Time to live field of the IP header.
- `tcp-flags` (multi { array-id, flag: enum (fin | syn | rst | psh | ack | urg | ece | cwr) }): TCP flags of the packet: `fin`, `syn`, `rst`, `psh`, `ack`, `urg`, `ece` or `cwr`.
- `data` (string): Content of the captured packet in hexadecimal format.
