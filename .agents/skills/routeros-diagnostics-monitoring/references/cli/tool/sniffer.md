# /tool/sniffer

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer

Type: Settings Directory

Settings of the packet sniffer: which packets it captures (the `filter-*` settings), where it keeps them (memory and a file) and whether it streams them to a TZSP receiver. [`start`](sniffer.md) and [`quick`](sniffer.md) without filter arguments use the saved filters. With filter arguments, they use only the filters given, for that run; the saved filters do not apply and do not change. See [Packet sniffer](../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Arguments**

- `only-headers` (bool): Store and save only the packet headers, not the payload. The packet list still shows the original packet size. Default: no.
- `memory-limit` (num): Memory for the captured packets, in KiB (10..4294967295). What does not fit is handled as `memory-scroll` says. Default: 100KiB.
- `memory-scroll` (bool): What happens when `memory-limit` is reached: `yes` replaces the oldest packets with new ones, so the memory holds the latest packets; `no` keeps the first packets and stores no more. Default: yes.
- `file-name` (file): File that the captured packets are written to while the sniffer runs, in pcapng format. Each start overwrites the file. A path on another disk, such as `usb1/capture.pcap`, writes the file there. Empty (default) keeps the packets only in memory; write them to a file later with [`save`](sniffer.md).
- `file-limit` (num): Size limit of `file-name`, in KiB (10..4294967295). When the file reaches the limit, the sniffer stops writing to it but keeps running. Default: 1000KiB.
- `streaming-enabled` (bool): Send every captured packet to `streaming-server` as TZSP (version 1, Ethernet encapsulation, the whole frame) over UDP, for example to Wireshark. Default: no.
- `streaming-server` (composite { ip: ipAddr , port: [ enum ()] }): Receiver of the TZSP stream: an address, or `address:port`. Without a port, 37008 is used. Default: 0.0.0.0:37008.
- `max-packet-size` (num): Maximum packet size, in bytes (2048..65536). Default: 2048.
- `filter-stream` (bool): With `yes`, the sniffer does not capture the packets it streams to `streaming-server`, and it does not capture ICMP packets to and from the `streaming-server` address either, also while streaming is off. Set `yes` when the interface towards the stream receiver is sniffed: with `no`, the stream packets are captured and streamed again, in a loop. Default: no.
- `filter-interface` (object { interface: iface_enum }): Interfaces to sniff. Empty (default) sniffs all interfaces; a packet to or from the router through a bridge then shows once on the bridge and once on the bridge port.
- `filter-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 MAC addresses, or MAC addresses with a mask; a frame matches when its source or destination MAC address matches. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-src-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 source MAC addresses, or MAC addresses with a mask. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-dst-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 destination MAC addresses, or MAC addresses with a mask. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-mac-protocol` (object { mac-protocol-element: super { ! , protocol: alt { mac-protocol: enum () , protocol-number: num [ .. 65535] } } }): Up to 16 MAC (L2) protocols, by EtherType number (0..65535) or name: `802.2` (0x0004), `arp` (0x0806), `capsman` (0x88BB), `dot1x` (0x888E), `homeplug-av` (0x88E1), `ip` (0x0800), `ipv6` (0x86DD), `ipx` (0x8137), `lacp` (0x8809), `lldp` (0x88CC), `loop-protect` (0x9003), `macsec` (0x88E5), `mpls-multicast` (0x8848), `mpls-unicast` (0x8847), `mvrp` (0x88F5), `packing-compr`, `packing-simple`, `pppoe` (0x8864), `pppoe-discovery` (0x8863), `rarp` (0x8035), `romon` (0x88BF), `service-vlan` (0x88A8), `vlan` (0x8100). A VLAN-tagged frame matches the protocol inside the tag, not `vlan`; select VLANs with `filter-vlan`. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 IPv4 addresses or prefixes; a packet matches when its source or destination address matches. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-src-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 source IPv4 addresses or prefixes. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-dst-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 destination IPv4 addresses or prefixes. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 IPv6 prefixes; a packet matches when its source or destination address matches. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-src-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 source IPv6 prefixes. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-dst-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 destination IPv6 prefixes. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-ip-protocol` (object { ip-protocol-element: super { ! , ip-protocol: enum () } }): Up to 16 IP or IPv6 protocols, by number or name: `dccp`, `ddp`, `egp`, `encap`, `etherip`, `ggp`, `gre`, `hmp`, `icmp`, `icmpv6`, `idpr-cmtp`, `igmp`, `ipencap`, `ipip`, `ipsec-ah`, `ipsec-esp`, `ipv6-encap`, `ipv6-frag`, `ipv6-nonxt`, `ipv6-opts`, `ipv6-route`, `iso-tp4`, `l2tp`, `ospf`, `pim`, `pup`, `rdp`, `rspf`, `rsvp`, `sctp`, `st`, `tcp`, `udp`, `udp-lite`, `vmtp`, `vrrp`, `xns-idp`, `xtp`. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-port` (object { port-element: super { ! , port: enum () } }): Up to 16 ports, by number or by name such as `ssh`, `dns`, `bootps` (67) or `bootpc` (68); a packet matches when its source or destination port matches. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-src-port` (object { port-element: super { ! , port: enum () } }): Up to 16 source ports, by number or name. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-dst-port` (object { port-element: super { ! , port: enum () } }): Up to 16 destination ports, by number or name. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-vlan` (object { cpu-element: super { ! , vlan: num [ .. 4095] } }): Up to 16 VLAN IDs (0..4095). It matches tagged frames on the interface that carries them, such as the trunk port; the IP and MAC filters match the packet inside the tag. On the VLAN interface itself, packets are untagged and do not match. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-cpu` (object { cpu-element: super { ! , cpu: num } }): CPU cores that processed the packet. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-size` (object { size-element: super { ! , size-range: range [0 .. 65535] } }): Packet sizes or size ranges in bytes (0..65535), for example `1000-1500`. Prefix an entry with `!` to negate it. Empty (default) means no filter.
- `filter-direction` (enum: any | tx | rx): Directions to capture.
  - `any` (default) - Received and sent packets.
  - `rx` - Received packets. They are captured before the firewall, so packets that a firewall rule drops are still captured.
  - `tx` - Sent packets, captured after the firewall.
- `filter-operator-between-entries` (enum: or | and): How the entries of one filter are combined. Different filters always combine: a packet has to match every filter that is set.
  - `or` (default) - A packet matches a filter when it matches any of the filter's entries.
  - `and` - A packet matches a filter only when it matches all of the filter's entries, for example both addresses of `filter-ip-address=192.168.88.10/32,192.168.88.1/32`.
- `quick-rows` (num): Number of packets that [`quick`](sniffer.md) shows when its `rows` argument is not given. Default: 20.
- `quick-show-frame` (bool): Whether [`quick`](sniffer.md) shows the frame content when its `show-frame` argument is not given. Default: no.

**Read-only arguments**

- `running` (bool): `yes` while the sniffer is running.

## Commands

### /tool/sniffer/quick

Type: Command

Shows the matching packets live, until you stop it with <kbd>Q</kbd> or for the time given in `duration`. The filter arguments are the `filter-*` settings of [`/tool/sniffer`](sniffer.md) without the `filter-` prefix, and `vlan-id` for `filter-vlan`. Without filter arguments, the saved filters apply; with filter arguments, only the filters given apply, and the saved settings do not change. `quick` cannot run while the sniffer runs (`already running`). `proplist` selects the columns, for example `proplist=interface,time,dir,src-address,dst-address,protocol,size`. See [Packet sniffer](../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Arguments**

- `rows` (num): Maximum number of packets displayed in the output. Default: the `quick-rows` setting (20).
- `show-frame` (bool): Whether to show the raw frame content in the output. Default: the `quick-show-frame` setting (no).
- `interface` (object { interface: iface_enum }): Interface or list of interfaces to capture traffic on. A bridged packet shows once on the bridge and once on the bridge port when both are included.
- `mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Filter: capture only frames with a matching MAC address or MAC address with mask.
- `src-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Filter: capture only frames with a matching source MAC address or MAC address with mask.
- `dst-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Filter: capture only frames with a matching destination MAC address or MAC address with mask.
- `mac-protocol` (object { mac-protocol-element: super { ! , protocol: alt { mac-protocol: enum () , protocol-number: num [ .. 65535] } } }): Filter: capture only frames with a matching MAC (L2) protocol.
- `ip-protocol` (object { ip-protocol-element: super { ! , ip-protocol: enum () } }): Filter: capture only packets with a matching IP protocol.
- `ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Filter: capture only packets with a matching IP address or subnet.
- `src-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Filter: capture only packets with a matching source IP address or subnet.
- `dst-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Filter: capture only packets with a matching destination IP address or subnet.
- `ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Filter: capture only packets with a matching IPv6 address or prefix.
- `src-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Filter: capture only packets with a matching source IPv6 address or prefix.
- `dst-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Filter: capture only packets with a matching destination IPv6 address or prefix.
- `port` (object { port-element: super { ! , port: enum () } }): Filter: capture only packets with a matching source or destination port.
- `src-port` (object { port-element: super { ! , port: enum () } }): Filter: capture only packets with a matching source port.
- `dst-port` (object { port-element: super { ! , port: enum () } }): Filter: capture only packets with a matching destination port.
- `vlan-id` (object { vlan-element: super { ! , vlan: num [ .. 4095] } }): Filter: capture only frames with a matching VLAN ID.
- `direction` (enum: any | tx | rx): Filter: directions to capture.
  - `any` (default) - Received and sent packets.
  - `rx` - Received packets. They are captured before the firewall, so packets that a firewall rule drops are still captured.
  - `tx` - Sent packets, captured after the firewall.
- `operator-between-entries` (enum: or | and): How the entries of one filter are combined.
  - `or` (default) - A packet matches a filter when it matches any of the filter's entries.
  - `and` - A packet matches a filter only when it matches all of the filter's entries.
- `cpu` (object { cpu-element: super { ! , cpu: num } }): Filter: capture only packets processed by the given CPU core.
- `size` (object { size-element: super { ! , size-range: range [0 .. 65535] } }): Filter: capture only packets with a matching size or size range in bytes.

**Read-only arguments**

- `interface` (iface_enum): Interface on which the packet was captured.
- `time` (num): Time offset of the packet relative to the start of the capture, in seconds with microsecond precision.
- `num` (num): Packet sequence number, starting from 0 for the first captured packet.
- `dir` (enum: <- | ->): Direction of the packet, `<-` received, `->` sent.
- `src-mac` (macAddr): Source MAC address of the frame, shown only for interfaces that have a MAC address, for example Ethernet, WiFi, EoIP, VXLAN or VLAN.
- `dst-mac` (macAddr): Destination MAC address of the frame, shown only for interfaces that have a MAC address, for example Ethernet, WiFi, EoIP, VXLAN or VLAN.
- `vlan` (composite { id: num [ .. 4095] , priority: num [ .. 7] }): VLAN tag of the frame, displayed as `id:priority`.
- `src-address` (composite { address: alt { ip: ipAddr , ipv6: ip6Addr , descr: string } , port: enum () }): Source IP address and source port of the packet, displayed as `address:port`.
- `dst-address` (composite { address: alt { ip: ipAddr , ipv6: ip6Addr } , port: enum () }): Destination IP address and destination port of the packet, displayed as `address:port`.
- `protocol` (composite { mac-protocol: enum () , ip-protocol: enum (ip) }): MAC (L2) protocol of the frame and its IP protocol, for example `ip:icmp`.
- `size` (num): Total frame size in bytes, including the L2 header.
- `cpu` (num): CPU core on which the packet was processed.
- `fp` (bool): Whether the packet was processed in the fast path.
- `raw` (string): Raw frame content in hexadecimal format, shown when the `show-frame` parameter is enabled.
- `dscp` (num): DSCP (Differentiated Services Code Point) field of the IP header.
- `ecn` (num): ECN (Explicit Congestion Notification) field of the IP header.
- `fragment-offset` (num): Fragment offset field of the IP header.
- `identification` (num): Identification field of the IP header.
- `ip-header-size` (num): Size of the IP header in bytes.
- `ip-packet-size` (num): Size of the IP packet in bytes.
- `tcp-flags` (super { tcp-flags: multi { array-id, flag: enum (fin | syn | rst | psh | ack | urg | ece | cwr) } }): TCP flags of the packet: `fin`, `syn`, `rst`, `psh`, `ack`, `urg`, `ece` or `cwr`.
- `ttl` (num): Time to live field of the IP header.

### /tool/sniffer/save

Type: Command

Writes the packets in memory to a file. Since RouterOS 7.20 the file is always in pcapng format, also with a `.pcap` extension; it carries the interface name, the direction and nanosecond timestamps of each packet. See [Packet sniffer](../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Arguments**

- `file-name` (file): Name of the file to write, for example `capture.pcap`.

### /tool/sniffer/start

Type: Command

Starts the sniffer with the settings in [`/tool/sniffer`](sniffer.md). The filter arguments are the `filter-*` settings without the `filter-` prefix (`interface`, `ip-address`, `port`, `ip-protocol`), and `vlan-id` for `filter-vlan`. With filter arguments, the run uses only the filters given; the saved filters do not apply and do not change. While the sniffer runs, the router turns off IPv4 fast path, and with it FastTrack. The captured packets stay in memory after [`stop`](sniffer.md), for [`packet`](sniffer/packet.md), [`protocol`](sniffer/protocol.md), [`host`](sniffer/host.md) and [`connection`](sniffer/connection.md), for 10 minutes or until the next start. See [Packet sniffer](../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Arguments**

- `interface` (object { interface: iface_enum }): Interfaces to sniff in this run.
- `mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 MAC addresses, or MAC addresses with a mask; a frame matches when its source or destination MAC address matches. Prefix an entry with `!` to negate it.
- `src-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 source MAC addresses, or MAC addresses with a mask. Prefix an entry with `!` to negate it.
- `dst-mac-address` (object { mac-address-element: super { ! , mac-address-with-mask: composite { mac: macAddr , mask: [ macAddr] } } }): Up to 16 destination MAC addresses, or MAC addresses with a mask. Prefix an entry with `!` to negate it.
- `mac-protocol` (object { mac-protocol-element: super { ! , protocol: alt { mac-protocol: enum () , protocol-number: num [ .. 65535] } } }): Up to 16 MAC (L2) protocols, by name or number (0..65535), for example `ip`, `arp`, `ipv6` or `802.2`. Prefix an entry with `!` to negate it.
- `ip-protocol` (object { ip-protocol-element: super { ! , ip-protocol: enum () } }): Up to 16 IP or IPv6 protocols, by name or number, for example `icmp`, `tcp` or `udp`. Prefix an entry with `!` to negate it.
- `ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 IPv4 addresses or prefixes; a packet matches when its source or destination address matches. Prefix an entry with `!` to negate it.
- `src-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 source IPv4 addresses or prefixes. Prefix an entry with `!` to negate it.
- `dst-ip-address` (object { ip-address-element: super { ! , ip-address-with-mask: composite { ip: ipAddr , mask: [ num [ .. 32]] } } }): Up to 16 destination IPv4 addresses or prefixes. Prefix an entry with `!` to negate it.
- `ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 IPv6 prefixes; a packet matches when its source or destination address matches. Prefix an entry with `!` to negate it.
- `src-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 source IPv6 prefixes. Prefix an entry with `!` to negate it.
- `dst-ipv6-address` (object { ipv6-address-element: super { ! , ipv6-prefix: ip6Prefix } }): Up to 16 destination IPv6 prefixes. Prefix an entry with `!` to negate it.
- `port` (object { port-element: super { ! , port: enum () } }): Up to 16 ports, by number or by name such as `ssh` or `telnet`; a packet matches when its source or destination port matches. Prefix an entry with `!` to negate it.
- `src-port` (object { port-element: super { ! , port: enum () } }): Up to 16 source ports, by number or name. Prefix an entry with `!` to negate it.
- `dst-port` (object { port-element: super { ! , port: enum () } }): Up to 16 destination ports, by number or name. Prefix an entry with `!` to negate it.
- `vlan-id` (object { vlan-element: super { ! , vlan: num [ .. 4095] } }): Up to 16 VLAN IDs (0..4095). Prefix an entry with `!` to negate it.
- `direction` (enum: any | tx | rx): Directions to capture in this run.
  - `any` (default) - Received and sent packets.
  - `rx` - Received packets. They are captured before the firewall, so packets that a firewall rule drops are still captured.
  - `tx` - Sent packets, captured after the firewall.
- `operator-between-entries` (enum: or | and): How the entries of one filter are combined in this run.
  - `or` (default) - A packet matches a filter when it matches any of the filter's entries.
  - `and` - A packet matches a filter only when it matches all of the filter's entries.
- `cpu` (object { cpu-element: super { ! , cpu: num } }): CPU cores that processed the packet. Prefix an entry with `!` to negate it.
- `size` (object { size-element: super { ! , size-range: range [0 .. 65535] } }): Packet sizes or size ranges in bytes (0..65535), for example `1000-1500`. Prefix an entry with `!` to negate it.

### /tool/sniffer/stop

Type: Command

Stops the sniffer. The captured packets stay in memory for 10 minutes, or until the next [`start`](sniffer.md): list them in [`packet`](sniffer/packet.md), [`protocol`](sniffer/protocol.md), [`host`](sniffer/host.md) and [`connection`](sniffer/connection.md), or write them to a file with [`save`](sniffer.md).
