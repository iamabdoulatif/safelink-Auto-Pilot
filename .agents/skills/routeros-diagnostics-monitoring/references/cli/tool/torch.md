# /tool/torch

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/torch

Type: Command

Shows the traffic that passes one interface right now, grouped into flows by addresses, protocol, ports and DSCP, with the rate of each flow in both directions. Torch sees packets before the firewall, and turns IP fast path off while it runs. It runs until stopped with Ctrl-C or until `duration` ends. For examples and how to read the output, see [Torch](../../guides/diagnostics-monitoring-and-troubleshooting/torch.md).

**Arguments**

- `interface` (iface_enum): Interface to watch. The name can be given without `interface=`, for example `/tool/torch bridge`.
- `src-address` (super { ! , src-address: ipPrefix }): Show only flows whose `src-address` is in this IPv4 prefix. `src-address` of a flow is the address on the far side of the interface, whose traffic the interface receives. Default: any.
- `dst-address` (super { ! , dst-address: ipPrefix }): Show only flows whose `dst-address`, the other end of the flow, is in this IPv4 prefix. Default: any.
- `src-address6` (super { ! , src-address6: ip6Prefix }): IPv6 prefix for `src-address`, the far side of the interface. Default: any.
- `dst-address6` (super { ! , dst-address6: ip6Prefix }): IPv6 prefix for `dst-address`, the other end of the flow. Default: any.
- `mac-protocol` (enum: any): Show only flows of this MAC protocol, for example `ip`. Default: any.
- `ip-protocol` (enum: any): Show only flows of this IP protocol, for example `tcp`. Default: any.
- `port` (enum: any): Show only flows with this port as `src-port` or `dst-port`, one port or `any`. The filter applies to flows that have ports: flows without ports, such as ICMP, still appear. Default: any.
- `vlan-id` (alt { number: num [ .. 4095] , enum: enum (any) { any:0xffff } }): Show only frames with this VLAN ID, `0..4095`, or `any`. Tagged frames on the parent interface get a `VLAN-ID` column also without this filter. Default: any.
- `dscp` (num): Show only flows with this DSCP value, `0..63`, for example `46` for Expedited Forwarding. Default: any.
- `cpu` (num): With `any`, adds a `CPU` column: one row for each CPU that handled packets of a flow.

**Read-only arguments**

- `cpu` (num): CPU that handled the packets of the row. Shown with `cpu=any`.
- `vlan-id` (num): VLAN ID of the flow. Shown for tagged frames on the parent interface; on the VLAN interface itself the frames are untagged and the column does not appear.
- `mac-protocol` (enum): MAC protocol of the flow, for example `ip`.
- `ip-protocol` (enum): IP protocol of the flow, for example `tcp`, `udp` or `icmp`.
- `dscp` (num): DSCP value of the flow.
- `src-address` (alt { ip: ipAddr , ipv6: ip6Addr }): Address on the far side of the interface: the side whose traffic the interface receives, also when the router started the conversation.
- `src-port` (enum): Port on the `src-address` side, for TCP and UDP flows, shown with its service name.
- `dst-address` (alt { ip: ipAddr , ipv6: ip6Addr }): The other end of the flow.
- `dst-port` (enum): Port on the `dst-address` side, for TCP and UDP flows, shown with its service name, such as `2000 (btserv)`.
- `tx` (num): Rate of the traffic the interface sends towards `src-address`, in bits per second.
- `rx` (num): Rate of the traffic the interface receives from `src-address`, in bits per second.
- `tx-packets` (num): Packets per second the interface sends towards `src-address`.
- `rx-packets` (num): Packets per second the interface receives from `src-address`.
