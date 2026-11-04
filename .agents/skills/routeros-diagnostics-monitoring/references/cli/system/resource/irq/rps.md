# /system/resource/irq/rps

> Source: https://manual.mikrotik.com/docs/cli-reference/system/resource/irq/rps

Syscap: rps; Type: Directory

Receive Packet Steering (RPS) entries: each entry enables RPS for its interface (the packet-processing work of that interface's receive path is spread over the CPU cores in software). See the [Resource guide](../../../../guides/diagnostics-monitoring-and-troubleshooting/resource.md) for when RPS pays off.

**Flags**

- `X` (disabled): disabled entry (RPS steering off for this interface)

**Arguments**

- `interface` (iface_enum; mandatory): Interface whose receive path is steered
