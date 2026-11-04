# /system/resource

> Source: https://manual.mikrotik.com/docs/cli-reference/system/resource

Type: Settings Directory

Overall resource usage and identity of the router: uptime, memory, disk, version, board. See the [Resource](../../guides/diagnostics-monitoring-and-troubleshooting/resource.md) guide.

**Read-only arguments**

- `uptime` (time): Time interval passed since boot-up
- `version` (string): Installed RouterOS version number
- `build-time` (string): Installed RouterOS version build-time
- `minimum-version` (string): Minimum RouterOS version the board allows downgrading to (was factory-software)
- `free-memory` (num): The unused amount of RAM
- `total-memory` (num): Amount of installed RAM
- `cpu` (string): CPU model that is on the board
- `cpu-count` (num): Number of CPUs present on the system; each core is a separate CPU, Intel HT also counts as one CPU
- `cpu-frequency` (num): Current CPU frequency
- `cpu-load` (num): Percentage of used CPU resources, combined for all CPUs; per-core values are in [`/system/resource/cpu`](resource/cpu.md)
- `free-hdd-space` (num): Free space on the hard drive or NAND
- `total-hdd-space` (num): Size of the hard drive or NAND
- `write-sect-since-reboot` (num): The number of sector writes to the drive/NAND since the router was last rebooted
- `write-sect-total` (num): The number of sector writes in total
- `bad-blocks` (num): Percentage of bad blocks on the NAND
- `architecture-name` (string): CPU architecture of this build (arm, arm64, x86, tile ...)
- `board-name` (string): RouterBOARD model name
- `platform` (string): Platform name

## Commands

### /system/resource/monitor

Type: Command

Live system resource monitor output (the table keeps refreshing; stops after `duration`).

**Read-only arguments**

- `cpu-used` (num): Total CPU usage across cores
- `cpu-used-per-core` (multi { cpu-used: num }; syscap=smp): One line per core with its percent usage
- `free-memory` (num): Free memory in KiB
