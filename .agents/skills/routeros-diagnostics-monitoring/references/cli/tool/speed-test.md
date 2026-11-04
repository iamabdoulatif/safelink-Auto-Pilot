# /tool/speed-test

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/speed-test

Type: Command

Measures the link to another MikroTik router in one run: ping round-trip time, jitter and loss, then TCP and UDP throughput in both directions, through the bandwidth test server of the remote router (`/tool/bandwidth-server`). The test runs five parts of `test-duration` each, with a pause of about a second between them, and shows the CPU load of the routers next to the throughput results. The remote router needs the server enabled, a user in a group with the `test` and `winbox` policies, and a firewall that accepts TCP port 2000 and the server's UDP ports. Needs the `bandwidth-test` device-mode feature. For examples, see [Speed Test](../../guides/diagnostics-monitoring-and-troubleshooting/speed-test.md).

**Arguments**

- `address` (address (flags=46viD)): IPv4 or IPv6 address of the remote router, which runs the bandwidth test server. Use its address on the path you want to measure, for example its tunnel address to test a VPN.
- `connection-count` (num): Number of TCP connections the TCP parts of the test use, `1..255`. The session list of the remote server shows it as `tcp-connection-count`. Default: 20, or the number of CPU cores of the router that runs the test when it has more than 20 (for example 64 on a 64-core router).
- `test-duration` (time): Length of each of the five parts of the test, at least 5 seconds. The router pauses for about a second between the parts, so the default test takes about 55 seconds. Default: 10s.
- `user` (string): User name on the remote router. Its group needs the `test` and `winbox` policies, as the default `read` and `full` groups have. Without `user`, the command sends no user name, and every throughput line shows `authentication failed` unless the server has `authenticate=no`. The `address` setting of the user does not limit bandwidth test logins; `allowed-addresses4` and `allowed-addresses6` of the server limit which routers can connect.
- `password` (string): Password of `user` on the remote router.

**Read-only arguments**

- `status` (string): Part of the test that is running:
  - `ping` - Pings for latency, jitter and loss.
  - `tcp download` - TCP from the remote router to this router.
  - `tcp upload` - TCP from this router to the remote router.
  - `udp download` - UDP from the remote router to this router.
  - `udp upload` - UDP from this router to the remote router.
  - `done` - The test has ended.
- `time-remaining` (time): Time until the test ends.
- `ping-min-avg-max` (string): Shortest, average and longest round-trip time of the pings. The ping part sends ICMP echo requests, 20 per second.
- `jitter-min-avg-max` (string): Variation of the round-trip time between pings: smallest, average and largest.
- `loss` (string): Lost pings in percent, followed by lost and sent pings, for example `0% (0/100)`.
- `tcp-download` (string): TCP throughput from the remote router to this router, with `local-cpu-load`, the CPU load of this router. Shows `authentication failed` when the remote server refuses the user.
- `tcp-upload` (string): TCP throughput from this router to the remote router, with `local-cpu-load` and `remote-cpu-load`, the CPU load of this router and of the remote router. Shows `authentication failed` when the remote server refuses the user.
- `udp-download` (string): UDP throughput from the remote router to this router, with `local-cpu-load` and `remote-cpu-load`. Shows `authentication failed` when the remote server refuses the user.
- `udp-upload` (string): UDP throughput from this router to the remote router, with `local-cpu-load` and `remote-cpu-load`. Shows `authentication failed` when the remote server refuses the user.
