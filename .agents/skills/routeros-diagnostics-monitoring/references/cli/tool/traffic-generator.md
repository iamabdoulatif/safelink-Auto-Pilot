# /tool/traffic-generator

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-generator

Type: Settings Directory

**Arguments**

- `test-id` (num)
- `measure-out-of-order` (bool)
- `latency-distribution-max` (time)
- `stats-samples-to-keep` (num)

**Read-only arguments**

- `running` (bool)
- `latency-distribution-samples` (num)
- `latency-distribution-measure-interval` (string)

## Commands

### /tool/traffic-generator/inject

Type: Command

**Arguments**

- `interface` (iface_enum)
- `data` (string)
- `priority` (num; unset)

### /tool/traffic-generator/inject-pcap

Type: Command

**Arguments**

- `interface` (iface_enum)
- `pcap-file` (file)
- `speed-multiplier` (num)
- `loop` (bool)

**Read-only arguments**

- `iteration` (num)
- `tx-packets` (num)
- `tx-bytes` (num)

### /tool/traffic-generator/quick

Type: Command

**Arguments**

- `entries-to-show` (num)
- `test-id` (num)
- `measure-out-of-order` (bool)
- `cpu-core` (multi { array-id, array-id, cpu-core: range [0 .. 255] })
- `stream` (multi { stream: enum })
- `port` (multi { port: enum })
- `interface` (multi { port: iface_enum })
- `id` (multi { id: num [0 .. 255] })
- `packet-size` (multi { array-id, array-id, packet-size: range [1 .. 65535] })
- `pps` (multi { pps: num })
- `mbps` (multi { mbps: num })
- `tx-template` (multi { tx-template: enum })
- `packet-count` (multi { packet-count: num })

**Read-only arguments**

- `seq` (enum (TOT) { TOT:0xffffffff })
- `id` (enum (TOT) { TOT:0xffffffff })
- `tx-packet` (num)
- `tx-rate` (num)
- `rx-packet` (num)
- `rx-rate` (num)
- `rx-ooo` (num)
- `rx-bad-csum` (num)
- `lost-packet` (num)
- `lost-rate` (num)
- `lost-ratio` (string)
- `lat-min` (string)
- `lat-avg` (string)
- `lat-max` (string)
- `jitter` (string)

### /tool/traffic-generator/start

Type: Command

**Arguments**

- `test-id` (num)
- `measure-out-of-order` (bool)
- `cpu-core` (multi { array-id, array-id, cpu-core: range [0 .. 255] })
- `stream` (multi { stream: enum })
- `port` (multi { port: enum })
- `interface` (multi { port: iface_enum })
- `id` (multi { id: num [0 .. 255] })
- `packet-size` (multi { array-id, array-id, packet-size: range [1 .. 65535] })
- `pps` (multi { pps: num })
- `mbps` (multi { mbps: num })
- `tx-template` (multi { tx-template: enum })
- `packet-count` (multi { packet-count: num })

### /tool/traffic-generator/stop

Type: Command
