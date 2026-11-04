# /tool/traffic-monitor

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-monitor

Type: Directory

Threshold trigger: run a [script](https://manual.mikrotik.com/docs/developer-guides/scripting) (`on-event`) when an interface's transmit or receive rate crosses a threshold.

**Flags**

- `X`: disabled
- `I`: invalid

**Arguments**

- `name` (string): Name of the traffic monitor entry
- `interface` (iface_enum; mandatory): Interface whose rate is watched
- `traffic` (enum: transmitted | received): Direction to watch: `transmitted` or `received`
- `trigger` (enum: above | below | always): When `on-event` runs: when the rate crosses `above` the threshold, crosses `below` it, or `always` (on every poll).
- `threshold` (num): Traffic rate in bits per second that the trigger compares against
- `on-event` (alt { script: string }): Script run when the trigger condition is met
