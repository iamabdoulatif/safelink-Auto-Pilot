# /tool/bandwidth-server/session

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/bandwidth-server/session

Type: Directory

Tests that are running on this router's bandwidth test server ([`/tool/bandwidth-server`](../bandwidth-server.md)), from the server's point of view: `send` means that the server sends. A session disappears when its test ends. See [Bandwidth test](../../../guides/diagnostics-monitoring-and-troubleshooting/bandwidth-test.md).

**Read-only arguments**

- `client` (alt { ip: ipAddr , ipv6: ip6Addr }): Address of the client. IPv4 clients are shown as IPv4-mapped IPv6 addresses, for example `::ffff:192.0.2.1`.
- `protocol` (enum: udp | tcp): Protocol of the test, `udp` or `tcp`.
- `direction` (enum (receive | send | both) { receive:0x00000100, send:0x00000200, both:0x00000300 }): Which side sends, from the server's point of view:
  - `receive` - The client sends, the server receives (the client's `transmit`).
  - `send` - The server sends (the client's `receive`).
  - `both` - Both sides send.
- `user` (string): User the client logged in as; empty when the server has `authenticate=no` and the client gave no user.
- `random-data` (bool): Whether the test uses random data.
- `tx-current` (num): Rate the server sent at in the last second.
- `tx-10-second-average` (num): Average rate the server sent at over the last 10 seconds.
- `tx-total-average` (num): Average rate the server sent at since the test started.
- `rx-current` (num): Rate the server received at in the last second.
- `rx-10-second-average` (num): Average rate the server received at over the last 10 seconds.
- `rx-total-average` (num): Average rate the server received at since the test started.
- `lost-packets` (num): UDP packets the server found missing in the last second.
- `tx-size` (range): Size of the UDP packets the server sends, in bytes of the whole IP packet.
- `rx-size` (range): Size of the UDP packets the server receives, in bytes of the whole IP packet.
- `tcp-connection-count` (num): Number of connections of the test (`connection-count` of the client); also shown for UDP tests.
- `local-tx-speed` (num): Speed limit the client set for its own sending (`local-tx-speed`).
- `remote-tx-speed` (num): Speed limit the client set for the server's sending (`remote-tx-speed`).
