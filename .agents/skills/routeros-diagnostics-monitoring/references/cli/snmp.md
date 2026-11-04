# /snmp

> Source: https://manual.mikrotik.com/docs/cli-reference/snmp

Type: Settings Directory

The `/snmp` menu turns the SNMP agent on and sets its general behavior: the engine ID that identifies the router to SNMPv3 clients, the address and VRF it answers on, and how traps are sent. The agent is off by default. The communities that may actually read or write are defined in the `/snmp/community` menu. See the [SNMP guide](../guides/diagnostics-monitoring-and-troubleshooting/snmp.md) for configuration examples.

**Arguments**

- `enabled` (bool): Whether the SNMP agent answers queries and sends traps. Default: no.
- `contact` (string): Administrative contact information, readable by any collector. Default: empty.
- `location` (string): Administrative location information, readable by any collector. Default: empty.
- `engine-id-suffix` (string): Tail of the agent's SNMP engine ID. The router builds the full engine ID from the prefix `80003a8c04` and the given value written as ASCII hex; for example the suffix `1234` produces the engine ID `80003a8c0431323334`. Leave the suffix empty to use the automatically generated engine ID, which is different on each router and stays the same across reboots. Default: empty.
- `src-address` (alt { ip: ipAddr , ip6: ip6Addr }): Source address for SNMP messages. With a value set, the agent answers only requests addressed to that address, and an IPv4 value stops it answering IPv6 requests. Default: `::` - replies come from the address of the interface that received the request.
- `trap-target` (object { ip-addresses: alt { ipv6: ip6Addr , ip: ipAddr } }): List of collector addresses that receive SNMP traps; traps go to UDP port 162 on each address. Default: empty.
- `trap-community` (enum): Community used to send traps. It must exist in the `/snmp/community` menu; its security level decides how the trap is protected. Default: `public`.
- `trap-version` (enum: 1 | 2 | 3): Version of the trap protocol.
  - `1` (default) - SNMPv1 trap.
  - `2` - SNMPv2c trap.
  - `3` - SNMPv3 trap, using the authentication and encryption of the `trap-community`.
- `trap-generators` (multi { array-id, generator: enum }): Events that generate a trap; several values can be combined.
  - `interfaces` - A `linkDown`/`linkUp` trap when an interface changes state; narrow this with `trap-interfaces`.
  - `start-trap` - A trap when the SNMP service starts.
  - `temp-exception` (default) - A trap when the CPU temperature reaches the `/system/health` threshold.
- `trap-interfaces` (object { interface: iface_enum }): List of interfaces whose state changes generate `interfaces` traps; other interfaces stay quiet. Empty means any interface. Default: empty.
- `vrf` (enum): VRF the SNMP agent runs in. Requests that arrive in other VRFs get no reply. Default: `main`.

**Read-only arguments**

- `engine-id` (string): Full SNMP engine ID of the agent: the prefix `80003a8c04` followed by the `engine-id-suffix` value written as ASCII hex, or the automatically generated ID when the suffix is empty. SNMPv3 clients address the agent by this value and include it in every request.

## Commands

### /snmp/send-trap

Type: Command

The `send-trap` command sends one SNMP trap to the configured trap target immediately, which is useful for testing that traps reach the collector. The trap uses the `trap-target`, `trap-community`, and `trap-version` settings of the SNMP service (with `trap-version=1` it is a classic v1 enterprise trap; otherwise it carries the OID and value under the MikroTik trap OID `1.3.6.1.4.1.14988.1.1.9.0.1`). See the [SNMP guide](../guides/diagnostics-monitoring-and-troubleshooting/snmp.md) for the trap configuration.

**Arguments**

- `oid` (string): OID of the object the trap reports.
- `type` (enum (integer | string | nullobj | obj-id | ip-address | counter32 | timeticks | unsigned) { integer:0x02, string:0x04, nullobj:0x05, obj-id:0x06, ip-address:0x40, counter32:0x41, timeticks:0x43, unsigned:0x47 }): SNMP type of the value. Accepted values:
  - `integer` - A signed integer.
  - `string` - An octet string.
  - `nullobj` - A NULL value.
  - `obj-id` - An object identifier.
  - `ip-address` - An IP address.
  - `counter32` - A 32-bit counter.
  - `timeticks` - A time in hundredths of a second.
  - `unsigned` - An unsigned integer.
- `value` (string): Value to send, in the format the selected `type` expects.
