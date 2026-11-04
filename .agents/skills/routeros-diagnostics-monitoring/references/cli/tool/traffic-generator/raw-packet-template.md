# /tool/traffic-generator/raw-packet-template

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-generator/raw-packet-template

Type: Directory

**Flags**

- `D`: dynamic

**Arguments**

- `name` (string)
- `port` (enum)
- `header` (string)
- `data` (enum: uninitialized | random | specific-byte | incrementing)
- `data-byte` (num)
- `random-byte-offsets-and-masks` (multi { array-id, array-id, offset-and-mask: composite { offset: num [ .. 256] , mask: num [ .. 255] } })
- `random-ranges` (object { random-range: super { offset: num [ .. 256] , [width] :enum (8 | 16 | 32) , [range] :range } })
- `ip-header-offset` (multi { ip-header-offset: num [ .. 65535] })
- `ipv6-header-offset` (multi { ipv6-header-offset: num [ .. 65535] })
- `udp-header-offset` (multi { udp-header-offset: num [ .. 65535] })
- `udp-compute-checksum` (multi { udp-compute-checksum: bool })
- `tcp-header-offset` (multi { tcp-header-offset: num [ .. 65535] })
- `special-footer` (bool)
- `compute-checksum-from-offset` (num)

**Read-only arguments**

- `header-length` (num)
