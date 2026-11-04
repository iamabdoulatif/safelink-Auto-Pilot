# /tool/bandwidth-server

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/bandwidth-server

Type: Settings Directory

Settings of the bandwidth test server, which answers tests that other RouterOS devices start with [`/tool/bandwidth-test`](bandwidth-test.md) and [`/tool/speed-test`](speed-test.md). The server listens on TCP port 2000 (the `btest` entry in `/ip/service`) and sends and receives the test data on UDP ports from `allocate-udp-ports-from` upward. Running tests are listed in [`session`](bandwidth-server/session.md). It works only when the `bandwidth-test` device mode is on (see [Device mode](https://manual.mikrotik.com/docs/system-information-and-utilities/device-mode)). See [Bandwidth test](../../guides/diagnostics-monitoring-and-troubleshooting/bandwidth-test.md).

**Arguments**

- `enabled` (bool): Whether the server answers tests. Default: yes.
- `authenticate` (bool): Whether clients must log in with a user whose group has the `test` and `winbox` policies (see [`/user/group`](https://manual.mikrotik.com/docs/cli-reference/user/group)). With `no`, anyone who reaches TCP port 2000 can run tests that load the router and its links; do not turn it off on a router reachable from the internet. Default: yes.
- `allocate-udp-ports-from` (num): Beginning of UDP port range. The server and the client take the UDP ports for test data from this port upward, for example 2192 on the server and 2448 to 2467 for a client's 20 streams; firewalls must allow UDP to these ports in both directions. Range `1000..64000`. Default: 2000.
- `max-sessions` (num): Maximal simultaneous test count. Tests are counted, not their connections. When this many tests run, a new test gets `can not connect`. A single test cannot use more connections than this value either: with `max-sessions=1`, only a test with `connection-count=1` runs. Range `1..1000`. Default: 100.
- `allowed-addresses4` (object { address: ipPrefix }): IPv4 addresses or prefixes of the clients allowed to run tests. Empty allows every client. A client outside the list gets `can not connect`. Use this list to limit clients: a user's own `address` setting does not limit bandwidth test logins. Default: empty.
- `allowed-addresses6` (object { address: ip6Prefix }): IPv6 addresses or prefixes of the clients allowed to run tests, the same as `allowed-addresses4`. Default: empty.
