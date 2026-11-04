# /tool/traffic-generator/stats/port

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-generator/stats/port

Type: Directory

**Read-only arguments**

- `seq` (enum (TOT) { TOT:0xffffffff })
- `port` (composite { p: enum (TOT) { TOT:0xffffffff } , interface: iface_enum })
- `rx-unk-packet` (num)
- `rx-unk-byte` (num)
- `rx-unk-rate` (num)
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
