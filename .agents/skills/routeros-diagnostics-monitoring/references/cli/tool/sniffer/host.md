# /tool/sniffer/host

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/host

Type: Directory

The addresses that took part in the traffic of the last capture, with their rates and byte counts. See [Packet sniffer](../../../guides/diagnostics-monitoring-and-troubleshooting/packet-sniffer.md).

**Read-only arguments**

- `address` (ipAddr): Address seen in the captured packets.
- `rate` (composite { in: num , out: num }): Rate of the address's captured traffic, in bits per second, as two values: in (to the address) and out (from the address). The rates are calculated when the capture stops; while the sniffer runs, they show 0.
- `peak-rate` (composite { in: num , out: num }): Highest rate of the address's captured traffic during the capture, in bits per second (in/out), calculated when the capture stops.
- `total` (composite { in: num , out: num }): Captured bytes of the address's traffic: in (to the address) and out (from the address).
