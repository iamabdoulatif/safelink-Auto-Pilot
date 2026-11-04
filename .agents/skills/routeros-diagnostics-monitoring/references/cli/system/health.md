# /system/health

> Source: https://manual.mikrotik.com/docs/cli-reference/system/health

## /system/health

Conditions: i386; Type: Settings Directory

Hardware health monitoring on x86 (i386) based devices. Use `/system/health/print` to read the sensor values.

**Arguments**

- `state-after-reboot` (enum: disabled | enabled): Enables or disables hardware health monitoring after a reboot.

**Read-only arguments**

- `core` (num): CPU core voltage.
- `3.3v` (num): 3.3 V supply line voltage.
- `5v` (num): 5 V supply line voltage.
- `12v` (num): 12 V supply line voltage.
- `lm87-temp` (num): Temperature measured by the LM87 sensor.
- `cpu-temp` (num): CPU temperature.
- `board-temp` (num): Board temperature.
- `voltage1` (num): Voltage measured by sensor 1.
- `voltage2` (num): Voltage measured by sensor 2.
- `voltage3` (num): Voltage measured by sensor 3.
- `voltage4` (num): Voltage measured by sensor 4.
- `voltage5` (num): Voltage measured by sensor 5.
- `voltage6` (num): Voltage measured by sensor 6.
- `voltage7` (num): Voltage measured by sensor 7.
- `voltage8` (num): Voltage measured by sensor 8.
- `voltage9` (num): Voltage measured by sensor 9.
- `voltage10` (num): Voltage measured by sensor 10.
- `temp1` (num): Temperature measured by sensor 1.
- `temp2` (num): Temperature measured by sensor 2.
- `temp3` (num): Temperature measured by sensor 3.
- `fan1` (num): Speed of fan 1 in RPM.
- `fan2` (num): Speed of fan 2 in RPM.
- `fan3` (num): Speed of fan 3 in RPM.
- `state` (enum: disabled | enabled): Health monitoring state.

## /system/health

Conditions: !i386; Syscap: health; Type: Directory

Hardware health monitoring on non-x86 devices. Use `/system/health/print` to list the name, current value and type of each monitored parameter.

**Read-only arguments**

- `name` (string): Name of the monitored parameter, for example `voltage`, `cpu-temperature` or `fan1-speed`.
- `value` (alt { valuet: num , valuer: num , valuev: num , valuea: num , valuew: num , valueb: enum (ok | fail | not-present | idle | no-input) , values: string }): Current value of the parameter. The value and its unit depend on the parameter `type`.
- `type` (enum: C | RPM | V | A | W | |): Type of the measured value: `C` is degrees Celsius, `RPM` is fan speed, `V` is voltage, `A` is current and `W` is power consumption.
