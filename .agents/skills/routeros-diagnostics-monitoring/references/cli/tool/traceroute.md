# /tool/traceroute

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traceroute

Type: Command

Traces the path to a host: sends probes with a growing TTL and lists the routers that answer, with loss and round-trip statistics for each hop. The trace repeats every second until you stop it, until `count` rounds are done or until `duration` ends. For examples and how to read the results, see [Traceroute](../../guides/diagnostics-monitoring-and-troubleshooting/traceroute.md).

**Arguments**

- `address` (address (flags=46viD)): IP or IPv6 address, or DNS name, of the destination. A name is resolved by the router's DNS resolver. See [address flags](https://manual.mikrotik.com/docs/cli-reference#address-flags).
- `port` (num): Destination UDP port of the probes with `protocol=udp`. Every probe uses the same port. Default: 33434.
- `size` (num): Size of each probe as a whole IP packet, in bytes, including the IP header. Default: 28, which is an IPv4 probe without payload.
- `dscp` (num): DSCP value set in the IP header of the probes.
- `do-not-fragment` (switch): Sets the Don't Fragment flag in the IP header of the probes. With a large `size`, the router with a smaller link on the path answers with `fragmentation needed from <address>`.
- `use-dns` (bool): Show the host names of the hops instead of their addresses. The names are looked up with reverse DNS queries through the router's DNS resolver; a hop without a reverse DNS record keeps its address. Default: no.
- `count` (num): Number of rounds to run. Without `count`, the trace repeats every second until you stop it. Default: unlimited.
- `max-hops` (num): Highest TTL to try: when the destination does not answer, the round ends after this many hops. Default: 30.
- `protocol` (enum: icmp | udp): Type of the probes.
  - `icmp` (default) - ICMP echo requests. The destination answers with an echo reply.
  - `udp` - UDP datagrams to `port`. The destination answers with an ICMP port unreachable message.
- `src-address` (alt { ipv6-address: ip6Addr , ip-address: ipAddr }): Source address of the probes. Routing rules that match the source address apply to the probes. Default: the `pref-src` of the route, otherwise the address of the outgoing interface.
- `timeout` (time): How long each probe waits for its answer before the next probe is sent. Default: 1s.
- `vrf` (enum): VRF whose routing table the probes use. Only VRFs are accepted; a routing table created for policy routing is refused. Default: main.
- `interface` (iface_enum): Interface to send the probes out of. When no route through the interface covers the destination, the router treats the destination as directly connected there and sends ARP requests for it.

**Read-only arguments**

- `address` (object { address: alt { name: string , address: ip6Addr } }): Address of the router that answered for this hop, or its host name with `use-dns=yes`. Empty when no probe to the hop got an answer.
- `loss` (num): Percentage of the probes to this hop that got no answer.
- `sent` (num): Number of probes sent to this hop.
- `last` (num): Round-trip time of the last answer from this hop. The printed table shows `timeout` when the last probe got no answer.
- `avg` (num): Average round-trip time of the answers from this hop.
- `best` (num): Shortest round-trip time of the answers from this hop.
- `worst` (num): Longest round-trip time of the answers from this hop.
- `std-dev` (num): Standard deviation of the round-trip times of this hop: how much they vary from round to round.
- `status` (string): Error the hop answered with instead of time exceeded, for example `network unreachable from 203.0.113.1` (no route, or a firewall `reject` with the default message), `host unreachable from 203.0.113.1`, `packet filtered from 203.0.113.1` (a firewall rejects the probe as administratively prohibited) or `fragmentation needed from 203.0.113.6` (with `do-not-fragment`, the probe is larger than the next link's MTU). The round ends at such a hop. Empty when the hop answers normally.
- `error` (string)
