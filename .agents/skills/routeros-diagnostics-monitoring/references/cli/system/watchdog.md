# /system/watchdog

> Source: https://manual.mikrotik.com/docs/cli-reference/system/watchdog

Type: Settings Directory

Reboots the router when the system stops responding (the software watchdog timer) or when one IP address stops answering pings (the ping watchdog), and writes a support output file after a software failure. See [Watchdog](../../guides/diagnostics-monitoring-and-troubleshooting/watchdog.md).

**Arguments**

- `watch-address` (alt { ip: ipAddr , ipv6: composite { address: ip6Addr , interface: [ iface_enum] } }): Address the ping watchdog pings. The router sends six pings over `ping-timeout` and reboots when all six fail. `none` turns the ping watchdog off. Use an address that is reliably up and reached through the link to watch, such as the gateway or, for a VPN, the tunnel address of the far end. If it stays unreachable, the router reboots again after every boot, about every `ping-start-after-boot` plus `ping-timeout`. Default: none.
- `watchdog-timer` (bool): Whether the router reboots when the system is unresponsive for a minute. Default: yes.
- `ping-start-after-boot` (time): Time after a boot before the ping watchdog sends its first ping to `watch-address`. On a router that has been up longer than this time, setting `watch-address` starts the pings at once. Set it longer than the watched link needs to come up after a boot. Older exports call it `no-ping-delay`. Default: 5m.
- `ping-timeout` (time): Time over which the ping watchdog sends six pings to `watch-address`, one every `ping-timeout` divided by six. The router reboots when all six fail. Default: 1m.
- `automatic-supout` (bool): Whether the router writes `autosupout.rif` when the software fails. The previous file is renamed to `autosupout.old.rif`. A ping watchdog reboot does not write the file. Default: yes.
- `auto-send-supout` (bool): Whether the router sends the automatic support output file by email to `send-email-to`. Default: no.
- `send-email-to` (string): Email address the automatic support output file is sent to, with `auto-send-supout=yes`.
- `send-email-from` (string): Sender address of the email with the automatic support output file. When not set, the value from `/tool/e-mail` is used.
- `send-smtp-server` (alt { ipv4: ipAddr , fqdn: string }): SMTP server, as an IPv4 address or a name, that sends the email with the automatic support output file. When not set, the value from `/tool/e-mail` is used.
