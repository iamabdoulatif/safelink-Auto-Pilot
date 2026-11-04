# /tool/profile

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/profile

Type: Command

Show CPU usage per RouterOS process type, summed for all cores or per core. See the [Profiler](../../guides/diagnostics-monitoring-and-troubleshooting/profiler.md) guide.

**Arguments**

- `cpu` (enum (all | total) { all:0xfffffffe, total:0xfffffffd }; syscap=smp): Selects the CPU view on multi-core systems: `total` (default) sums the usage of all cores, `all` shows separate rows per core, and an integer (`0` .. number of cores minus one) shows only that core.

**Read-only arguments**

- `name` (string): The process classifier name (for example `wireless`, `console`). The per-core summary rows are named `cpu0`, `cpu1`, ..., and the summed view adds a `total` row.
- `cpu` (num; syscap=smp): The CPU core the row's usage belongs to (per-core view only).
- `usage` (num): Usage share of the CPU, in percent, measured since the previous output frame.
