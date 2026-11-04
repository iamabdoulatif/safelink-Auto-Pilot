# /tool/bandwidth-test

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/bandwidth-test

Type: Command

Runs a bandwidth test against the bandwidth test server of another RouterOS device ([`/tool/bandwidth-server`](bandwidth-server.md)) and prints the results every second until `duration` ends or you stop it. The test sends TCP or UDP traffic in one or both directions; the server must be enabled, reachable on TCP port 2000 and UDP ports from its `allocate-udp-ports-from`, and the `bandwidth-test` device mode must be on (see [Device mode](https://manual.mikrotik.com/docs/system-information-and-utilities/device-mode)). The server lists running tests in [`/tool/bandwidth-server/session`](bandwidth-server/session.md). To measure latency and both directions of TCP and UDP in one run, use [`/tool/speed-test`](speed-test.md). See [Bandwidth test](../../guides/diagnostics-monitoring-and-troubleshooting/bandwidth-test.md).

**Arguments**

- `address` (address (flags=46viD)): IPv4 or IPv6 address of the server. A link-local IPv6 address needs the interface, for example `fe80::1%ether1`.
- `protocol` (enum: udp | tcp): Traffic to send:
  - `udp` (default) - UDP packets of `local-udp-tx-size` and `remote-udp-tx-size` bytes; the receiver counts lost packets.
  - `tcp` - TCP connections (`connection-count`); TCP adapts its rate to the path.
- `local-udp-tx-size` (range): Size of the UDP packets the client sends, in bytes of the whole IP packet: 1500 sends a 1472-byte UDP payload. Values below 52 fail with `failure: size too small` over IPv4. Range `28..64000`. Default: 1500.
- `remote-udp-tx-size` (range): Size of the UDP packets the server sends, counted the same way as `local-udp-tx-size`. Default: 1500.
- `direction` (enum (receive | transmit | both) { receive:0x00000100, transmit:0x00000200, both:0x00000300 }): Which side sends:
  - `receive` (default) - The server sends, the client receives (`rx-*` values).
  - `transmit` - The client sends, the server receives (`tx-*` values).
  - `both` - Both sides send at the same time.
- `connection-count` (num): Number of TCP connections, or of UDP streams with their own ports, that the test uses. Range `1..255`. Default: 20, or the number of CPU cores on routers with more than 20 cores.
- `local-tx-speed` (num): Maximum rate the client sends at, in bits per second (suffixes such as `50M` work). Without it, the client sends as fast as it can: an unlimited UDP test floods for about the first second and then sends more than the receiver reports, so `lost-packets` stays above zero.
- `remote-tx-speed` (num): Maximum rate the server sends at, in bits per second (suffixes such as `50M` work). Without it, the server sends as fast as it can.
- `user` (string): User name on the server. The user's group needs both the `test` and `winbox` policies (see [`/user/group`](https://manual.mikrotik.com/docs/cli-reference/user/group)). Not needed when the server has `authenticate=no`.
- `password` (string): Password of `user` on the server.
- `duration` (time): How long the test runs. Without it, the test runs until you stop it, for example with <kbd>Control</kbd>+<kbd>C</kbd>.
- `random-data` (bool): Whether to fill the payload with random, incompressible data, so that links that compress traffic do not show a higher rate than they carry. It costs more CPU time on both sides. Default: no.

**Read-only arguments**

- `status` (enum: connecting | can not start test | can not connect | remote is busy | test unsupported | running | disconnected | authentication failed | done testing): State of the test:
  - `connecting` - The client is connecting to the server.
  - `running` - The test runs.
  - `done testing` - The test ended after `duration`.
  - `authentication failed` - The server refused the user name or password, or no user was given while the server authenticates.
  - `can not connect` - The server is disabled or not reachable, the client is not in its `allowed-addresses4`/`allowed-addresses6`, or `max-sessions` is reached.
  - `disconnected` - The connection to the server ended during the test, also when the test uses more connections than the server's `max-sessions`.

  Other values report that the server refused or could not start the test.
- `duration` (time): How long the test has run.
- `tx-current` (num): Rate the client sent at in the last second. UDP counts whole IP packets (IP and UDP headers included), TCP counts the TCP payload only.
- `tx-10-second-average` (num): Average rate the client sent at over the last 10 seconds.
- `tx-total-average` (num): Average rate the client sent at since the test started.
- `rx-current` (num): Rate the client received at in the last second. UDP counts whole IP packets (IP and UDP headers included), TCP counts the TCP payload only.
- `rx-10-second-average` (num): Average rate the client received at over the last 10 seconds.
- `rx-total-average` (num): Average rate the client received at since the test started.
- `lost-packets` (num): UDP packets lost in the last second, not a total since the start.
- `random-data` (bool): Whether the test uses random data (`random-data`).
- `direction` (enum (receive | transmit | both) { receive:0x00000100, transmit:0x00000200, both:0x00000300 }): Direction of the test (`direction`).
- `tx-size` (range): Size of the UDP packets the client sends, in bytes of the whole IP packet.
- `rx-size` (range): Size of the UDP packets the client receives, in bytes of the whole IP packet.
- `connection-count` (num): Number of TCP connections or UDP streams the test uses.
- `local-cpu-load` (num): CPU load of the client during the test, shown after the first seconds.
- `remote-cpu-load` (num): CPU load of the server during the test, shown after the first seconds.
- `tcp-info` (multi { name: string })
