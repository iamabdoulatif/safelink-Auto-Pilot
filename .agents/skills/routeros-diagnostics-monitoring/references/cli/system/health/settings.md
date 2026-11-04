# /system/health/settings

> Source: https://manual.mikrotik.com/docs/cli-reference/system/health/settings

Conditions: !i386; Syscap: health and health-settings; Type: Settings Directory

Configures the fan and temperature monitoring behavior of the device.

**Arguments**

- `fan-full-speed-temp` (num): Sets the temperature value at which the fan speed is increased to the maximum possible RPM. The fan controller reads the temperature from CPU, PHY, switch and SFP, and adjusts the fan speed based on the component with the highest temperature. Range: -273..65. Default: 65.
- `fan-target-temp` (num): Sets the target temperature for the hottest component. The fan controller adjusts the fan behavior to keep the temperature in the target range. Range: -273..65. Default: 58.
- `fan-min-speed-percent` (num): Sets the minimum percentage of the fan speed, so the fans do not drop below this value. The default varies by fan controller chip; current devices default to 12. Range: 0..100.
- `fan-control-interval` (time): Sets the interval for reading the temperature data from the CPU, PHY, switch and SFP. This setting directly affects CPU usage. Range: 5..30 seconds. Default: 30s.
- `fan-mode` (enum: manual | auto): Selects the fan control mode. With `auto`, the device automatically switches to the auxiliary fan when the main fan fails. With `manual`, you select which fans run by using `use-fan` and `use-fan2`.
- `use-fan` (enum: auxiliary | main): Selects which fan to use in the manual fan-control mode.
- `use-fan2` (enum: auxiliary | main): Selects which second fan to use in the manual fan-control mode.
- `fan-switch` (enum: auto | on | off): Sets the fan state: `auto` follows the automatic temperature control, `on` forces the fan to run, and `off` forces the fan to stop.
- `fan-on-threshold` (num): Sets the temperature at which the fans are switched on.
- `cpu-overtemp-check` (bool): Enables or disables CPU overtemperature monitoring. Available on ARM and ARM64 devices. Default: no.
- `cpu-overtemp-threshold` (num): Sets the maximum temperature before the overtemperature protection is triggered. Range: 0..105. Default: 105.
- `cpu-overtemp-startup-delay` (time): Sets the delay after startup before overtemperature monitoring is enabled. Default: 1m.

**Read-only arguments**

- `active-fan` (enum: auxiliary | main | none): Fan that is currently in use.
- `active-fan2` (enum: auxiliary | main | none): Second fan that is currently in use.

## Commands

### /system/health/settings/detect-fans

Conditions: !i386; Syscap: health and health-settings; Type: Command

Detects the fans connected to the device, for example after installing or replacing a fan.
