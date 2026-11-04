# /tool/graphing/interface

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/graphing/interface

Type: Directory

Rules that choose which interfaces are graphed and which clients can see their traffic graphs on the router's `/graphs/` web page (`/graphs/iface/<interface>/`). Nothing is graphed until you add a rule. You can add several rules for one interface, each with its own `allow-address`; a client sees the graph when any of them allows its address. An interface rule does not open the resource or queue graphs. The graphs show `In` for traffic received on the interface and `Out` for traffic sent, in bits per second. See [Graphing](../../../guides/diagnostics-monitoring-and-troubleshooting/graphing.md).

**Flags**

- `X` (disabled): Disabled rule: its graphs are not shown.

**Arguments**

- `interface` (iface_enum): The interface to graph. `all` graphs every interface, also disabled interfaces, the loopback interface `lo` and dynamic interfaces such as PPPoE users while they exist. A rule for one dynamic interface loses it when the interface is created again, for example when a PPPoE user reconnects (the rule then shows an ID such as `*F00000`); graph a static PPPoE server binding instead. The interface of an existing rule cannot be changed (`Can't change interface, please create new config`): remove the rule and add a new one. Default: all.
- `allow-address` (alt { ip-prefix: ipPrefix , ipv6-prefix: ip6Prefix }): The IPv4 or IPv6 prefix of the clients that can see this interface's graphs on the router's `/graphs/` web page. The pages need no login. A change applies immediately. To allow several prefixes, add a rule for each. Default: 0.0.0.0/0 (every IPv4 address).
- `store-on-disk` (bool): - `yes` (default) - Keep the collected data in the system storage: the graphs survive a reboot. The data is written every [`store-every`](../graphing.md).
  - `no` - Keep the data in RAM only: the graphs start empty after a reboot.
