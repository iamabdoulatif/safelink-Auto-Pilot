# /tool/mac-scan

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/mac-scan

Conditions: !smips; Type: Command

Lists the devices that send MikroTik Neighbor Discovery (MNDP) announcements on an interface, with their MAC address and IPv4 address, to find the MAC address for MAC Telnet or MAC WinBox. A device appears whatever its MAC server settings are; a device whose neighbor discovery is off on that interface does not appear. Without `duration`, the scan runs until you stop it. For examples, see [MAC server](https://manual.mikrotik.com/docs/management-tools/mac-server).

**Arguments**

- `interface` (iface_enum): Interface to scan, or `all` for all interfaces.

**Read-only arguments**

- `mac-address` (macAddr): MAC address of the device.
- `address` (ipAddr): IPv4 address the device announces in neighbor discovery.
- `age` (num): Seconds since the device's last neighbor discovery announcement.
