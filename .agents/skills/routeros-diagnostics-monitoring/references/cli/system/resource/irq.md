# /system/resource/irq

> Source: https://manual.mikrotik.com/docs/cli-reference/system/resource/irq

Type: Directory

IRQ counters per interrupt source. With `cpu=auto` the IRQ handling is balanced by interrupt counts (NAPI-assisted); pin an IRQ to a fixed core only when needed.

**Flags**

- `o` (read-only): read-only (the CPU assignment is fixed by the hardware)

**Arguments**

- `cpu` (num): The CPU the IRQ is pinned to; `auto` lets the scheduler balance by interrupt counts

**Read-only arguments**

- `irq` (num): IRQ identification number
- `users` (object { user: alt { interface: iface_enum , other: string } }): Process/driver bound to the IRQ
- `active-cpu` (num): The CPU currently serving the IRQ on multicore systems
- `count` (num): The number of interrupts handled (on ethernet interfaces interrupt = packet)
- `per-cpu-count` (multi { count: num }): Per-CPU interrupt counts as a list
