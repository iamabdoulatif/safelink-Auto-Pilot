# /tool/flood-ping

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/flood-ping

Conditions: !smips; Type: Command

Sends a series of ICMP echo requests to one host and shows only the totals. Not available on SMIPS devices. Needs the `traffic-gen` device-mode feature; without it the command fails with `failure: not allowed by device-mode`. For examples, see [Flood Ping](../../guides/diagnostics-monitoring-and-troubleshooting/flood-ping.md).

**Arguments**

- `address` (alt { ipv6: ip6Addr , ip: ipAddr }): IPv4 or IPv6 address of the host to ping.
- `count` (num): Number of requests to send, `0..1000`.
- `size` (num): Size of each request, `10..1500`.
- `timeout` (time): How long to wait for each reply, `00:00:00.010..00:00:05` (10 ms to 5 s).

**Read-only arguments**

- `sent` (num): Number of requests sent.
- `received` (num): Number of replies received. The difference from `sent` is the packet loss.
- `min-rtt` (time): Shortest round-trip time of the run.
- `avg-rtt` (time): Average round-trip time of the run.
- `max-rtt` (time): Longest round-trip time of the run.
