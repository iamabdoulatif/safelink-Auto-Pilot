# /ip/traffic-flow/target

> Source: https://manual.mikrotik.com/docs/cli-reference/ip/traffic-flow/target

Type: Directory

Export targets: the collector hosts (for example a NetFlow analyzer host) that receive traffic-flow data over UDP.

**Flags**

- `X`: disabled

**Arguments**

- `src-address` (alt { ip: ipAddr , ipv6: ip6Addr }): Source address of the export packets. 0.0.0.0 means auto-detect: the router uses the source of the outgoing interface
- `dst-address` (alt { ip: ipAddr , ipv6: ip6Addr }; mandatory): IP address of the host that receives the flow data
- `port` (num): UDP port to send flows to. Default: 2055
- `version` (enum: 1 | 5 | 9 | ipfix): NetFlow format of the export packets: `1`, `5`, `9` or `ipfix`
- `v9-template-refresh` (num): Number of export packets after which the FlowSet template is resent (version 9 and IPFIX only). Default: 20
- `v9-template-timeout` (time): Send the FlowSet template after this interval if it has not been sent by then (version 9 and IPFIX only)
