# /snmp/community

> Source: https://manual.mikrotik.com/docs/cli-reference/snmp/community

Type: Directory

The `/snmp/community` menu defines the SNMP communities: what each of them may read or write, from which addresses, and under which security level. The community name works as the password for SNMPv1 and v2c and as the security name for SNMPv3. A request that does not match a community (wrong name or wrong source address) gets no reply at all. See the [`/snmp`](../snmp.md) reference for the agent settings and the [SNMP guide](../../guides/diagnostics-monitoring-and-troubleshooting/snmp.md) for examples.

**Flags**

- `*` (default): Default community. The router is created with one community, `public`, with read access from any address, until you change or remove it.
- `X` (disabled): Disabled community. A disabled community does not answer requests; new communities are created enabled.

**Arguments**

- `name` (string): Name of the community. For SNMPv1 and v2c it travels in clear text with every packet and works as the password; for SNMPv3 it is the security name. Default: `public`.
- `addresses` (object { address: alt { ipv6: ip6Prefix , ip: ipPrefix } }): Source addresses or prefixes allowed to use this community. A request from any other address gets no reply. Default: `::/0` (any address).
- `security` (enum: none | authorized | private): Security level the community requires.
  - `none` (default) - No authentication and no encryption (noAuthNoPriv); the community name alone grants access.
  - `authorized` - SNMPv3 authentication required (authNoPriv); v1 and v2c requests are not answered.
  - `private` - SNMPv3 authentication and encryption required (authPriv); v1 and v2c requests are not answered.
- `read-access` (bool): Whether requests may read MIB values. Default: yes.
- `write-access` (bool): Whether requests may change the router: set the system identity, run scripts and reboot. A write community is a powerful credential, so keep its name hard to guess and its `addresses` narrow. Default: no.
- `denied-oids` (multi { array-id, oid: string }): OIDs or subtrees that this community cannot read. A direct GET of a blacklisted OID returns no-such-object and a walk skips the blocked subtree, so a monitoring tool's poll does not fail. Several OIDs can be given as a comma-separated list. The setting is per community. Default: empty (everything the agent implements is readable).
- `authentication-protocol` (enum: MD5 | SHA1 | SHA256 | SHA384 | SHA512): Authentication protocol for SNMPv3 with `security=authorized` or `private`; all clients of the community must use it.
  - `MD5` (default)
  - `SHA1`
  - `SHA256`
  - `SHA384`
  - `SHA512`
- `encryption-protocol` (enum: DES | AES): Encryption protocol for SNMPv3 with `security=private`.
  - `DES` (default)
  - `AES` - AES-128, defined in RFC 3826.
- `authentication-password` (string): Password for SNMPv3 authentication, at least 8 characters. Sensitive; see the [list of menus with sensitive parameters](https://manual.mikrotik.com/docs/getting-started/configuration-management/list-of-menus-with-sensitive-parameters).
- `encryption-password` (string): Password for SNMPv3 encryption, at least 8 characters. Sensitive; see the [list of menus with sensitive parameters](https://manual.mikrotik.com/docs/getting-started/configuration-management/list-of-menus-with-sensitive-parameters).
