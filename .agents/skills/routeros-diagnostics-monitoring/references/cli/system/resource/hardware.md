# /system/resource/hardware

> Source: https://manual.mikrotik.com/docs/cli-reference/system/resource/hardware

Conditions: !powerpc, !smips; Type: Directory

Detected hardware devices connected over PCI, USB or SCSI buses. Empty on boards with no such bus (for example the hAP ax²).

**Flags**

- `I` (inactive): inactive: the device is present but not active

**Read-only arguments**

- `device-name` (string): Name of the device as reported by its firmware (name column refinement)
- `location` (string): Device location in the system topology
- `parent` (enum): Parent bus or controller
- `type` (enum: usb | pci | scsi | serial): Bus type of the device: `usb`, `pci`, `scsi` or `serial`
- `vendor` (string): Device vendor name
- `name` (string): Device name or model
- `category` (string): Device category
- `serial-number` (string): Device serial number
- `vendor-id` (string): Vendor identifier (VID)
- `device-id` (string): Device identifier (PID / Device ID)
- `speed` (string): Negotiated device speed
- `ports` (num): Number of ports provided by the device
- `usb-version` (string): Supported USB version
- `manufacturer-reported-max-power` (string): Maximum power draw reported by the device (for example a USB modem)
- `irq` (num): Assigned interrupt number
- `memory` (multi { range: composite { min: num , max: num } }): Memory window assigned to the device
- `io` (multi { range: composite { min: num , max: num } }): I/O window assigned to the device
- `owner` (string): Subsystem or driver owning the device
- `device-path` (multi { path: string }): Device path from root bus to endpoint

## Commands

### /system/resource/hardware/authorize

Conditions: !powerpc, !smips; Type: Command

Allow or forbid the use of a USB hardware device (used when authorization is turned on in `usb-settings`).

**Arguments**

- `allow` (bool): Authorize the USB device (`yes`) or keep it unusable (`no`)

### /system/resource/hardware/usb-power-reset

Conditions: !powerpc, !smips, i386; Type: Command

Power-cycle a USB port: power off for `duration` and back on (resets misbehaving modems and drives without rebooting the router).

**Arguments**

- `duration` (time): Power-off duration before re-enabling USB
- `bus` (num): USB bus number (as shown by `/system/resource/hardware`)
- `slot` (num): USB slot number on the bus
