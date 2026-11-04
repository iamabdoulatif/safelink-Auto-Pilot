# /tool/traffic-generator/stats/raw

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-generator/stats/raw

Type: Directory

**Read-only arguments**

- `seq` (enum (TOT) { TOT:0xffffffff })
- `port` (composite { p: enum (TOT) { TOT:0xffffffff } , interface: iface_enum })
- `id` (enum (TOT) { TOT:0xffffffff })
- `tx-packet` (num)
- `tx-byte` (num)
- `tx-rate` (num)
- `rx-packet` (num)
- `rx-byte` (num)
- `rx-rate` (num)
- `rx-ooo` (num)
- `rx-bad-csum` (num)
- `lost-packet` (num)
- `lost-byte` (num)
- `lost-rate` (num)
- `lost-ratio` (string)
- `lat-min` (string)
- `lat-avg` (string)
- `lat-max` (string)
- `jitter` (string)
