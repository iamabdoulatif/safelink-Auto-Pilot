# /tool/snmp-walk

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/snmp-walk

Type: Command

Retrieves the values of a whole OID subtree from an SNMP agent with repeated GETNEXT requests — for example all interface counters at once, or everything under the MikroTik OID `1.3.6.1.4.1.14988`. Use `/tool/snmp-get` to read a single OID.

**Arguments**

- `oid` (string): The OID where the walk starts; the agent lists that subtree, for example `1.3.6.1.2.1.2` for the interface table.
- `address` (ipAddr): Address of the SNMP agent to query.
- `port` (num): UDP port of the agent. Default: `161`.
- `tries` (num): Number of attempts before giving up.
- `try-timeout` (time): Timeout for each attempt.
- `version` (enum: 1 | 2c | 3): SNMP protocol version: `1`, `2c`, or `3`.
- `community` (string): Community name. For v1/v2c the name is the password; for v3 it is the community that carries the matching security level.
- `security` (enum: none | authorized | private): Security level, matching the community: `none`, `authorized`, or `private`.
- `authentication-password` (string): SNMPv3 authentication password (at least 8 characters).
- `authentication-protocol` (enum: MD5 | SHA1 | SHA256 | SHA384 | SHA512): SNMPv3 authentication protocol: `MD5`, `SHA1`, `SHA256`, `SHA384`, or `SHA512`.
- `encryption-password` (string): SNMPv3 encryption password (at least 8 characters).
- `encryption-protocol` (enum: DES | AES): SNMPv3 encryption protocol: `DES` or `AES`.

**Read-only arguments**

- `oid` (string): OID of the value the agent returned.
- `type` (enum: null | integer | counter | gauge | timeticks | unsigned-integer | octet-string | opaque | object-id | ip-address | counter-64bit | no-such-object | no-such-instance | end-of-mib-view): Value type as returned by the agent.
- `value` (string): Value the agent returned.
