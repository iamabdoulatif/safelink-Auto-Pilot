# /tool/netwatch

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/netwatch

Type: Directory

Monitor network hosts with simple, ICMP, TCP, HTTP, HTTPS and DNS probes, and run scripts on state changes. See the [Netwatch](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md) guide.

**Flags**

- `X`: disabled

**Arguments**

- `name` (string): The name of the Netwatch probe; named probes are identified by it in log lines (unnamed probes log their type and host instead).
- `host` (address (flags=46viD); mandatory): The IP address or domain name of the server to be probed. Accepts an address with a VRF suffix (`192.0.2.1@vrf1`) and a link-local IPv6 address with an interface suffix (`fe80::1%ether1`). See [address flags](https://manual.mikrotik.com/docs/cli-reference#address-flags)
- `type` (enum: simple | icmp | tcp-conn | http-get | https-get | dns): Type of the probe (default value: **"simple"**) :
  - simple - simplified ICMP probe, with fewer options than "ICMP" type, used for backward compatibility with the older Netwatch version
  - icmp - (ping-style) series of ICMP request-response with statistics
  - tcp-conn - test TCP connection (3-way handshake) to a server specified by IP and port
  - http-get - do an HTTP Get request and test for a range of correct replies
  - https-get - do an HTTPS Get request and test for a range of correct replies
  - dns - do a specified DNS query for the domain name
- `src-address` (address (flags=46); unset): Source IP address which the Netwatch will try to use in order to reach the host. If the address is not configured on the router or was lost, then the host will be considered as "down". See [address flags](https://manual.mikrotik.com/docs/cli-reference#address-flags)
- `interval` (time; unset): The time interval between probe tests. (default value: **10s**, except `simple` probes: **60s**)
- `timeout` (time; unset): Max time limit to wait for a response. (default value: **3s**)
- `start-delay` (time; unset): Time to wait before starting the probe. (default value: **3s**) (on add, enable, or system startup in cases when "startup-delay" value is smaller then "start-delay" value)
- `startup-delay` (time; unset): Time to wait until starting the Netwatch probe after system startup. (default value: **5m**)
- `ignore-initial-up` (bool; unset): Specifies if "Up" script should be run if the probe state change goes from Unknown to "Up", used to help against false positives after enabling the probe, or after a reboot. "no" means that the change from "Unknown" to "Up" will not be ignored. (default value: **no**)
- `ignore-initial-down` (bool; unset): Specifies if "Down" script should be run if the probe state change goes from Unknown to "Down". "no" means that the change from "Unknown" to "Down" will not be ignored. (default value: **no**)  **Warning**: Should be used with care, as the first "Down" status won't be executed, and Down script will only be run if the probe goes from "Up" to "Down" state.
- `up-script` (alt { script: string }; unset): Script to execute on the event of probe state change from "Down" to "Up".
- `down-script` (alt { script: string }; unset): Script to execute on the event of probe state change from "Up" to "Down".
- `test-script` (alt { script: string }; unset): Script to execute at the end of every probe test.
- `packet-interval` (time; unset): The time between ICMP-request packet sends. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **50ms**)
- `packet-count` (num; unset): Total count of ICMP packets to send out within a single test. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **10**)
- `packet-size` (num; unset): Total size of the IP ICMP packet. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **50**)
- `ttl` (num; unset): Manually sets the time to live value for the ICMP packet. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **255**)
- `accept-icmp-time-exceeded` (bool; unset): If the ICMP "time exceeded" message should be considered a valid response. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **no**)
- `early-success-detection` (bool; unset): Netwatch reports the "Up" state before the whole packet train is processed once the result is certain, for example when the remaining packets can no longer push the loss past `thr-loss-count`. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **no**)
- `early-failure-detection` (bool; unset): Netwatch reports the "Down" state before the whole packet train is processed once failure is certain, for example as soon as the loss crosses `thr-loss-count`. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **no**)
- `thr-max` (time; unset): Fail threshold for rtt-max. (a value above thr-max is a probe fail) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **1s**)
- `thr-avg` (time; unset): Fail threshold for rtt-avg. (round trip time-avg) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **100ms**)
- `thr-stdev` (time; unset): Fail threshold for rtt-stdev. (standard deviation of round trip time) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **250ms**)
- `thr-jitter` (time; unset): Fail threshold for rtt-jitter. (jitter ( = max - min) of round trip time) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **1s**)
- `thr-loss-percent` (num; unset): Fail threshold for loss-percent. (number of lost packets in percent) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **85%**)
- `thr-loss-count` (num; unset): Fail threshold for loss-count. (number of lost packets) This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type. (default value: **4294967295(max)**)
- `port` (num; unset): TCP port. This parameter is specific to the [**TCP-conn**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#tcp-conn-probe) and [**HTTP/S-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#http-get-probe) probe types. (default value: **80** (TCP-conn, HTTP-GET) and  **443** (HTTPS-GET))
- `thr-tcp-conn-time` (time; unset): Fail threshold for tcp-connect-time, the configuration uses microseconds, if the time unit is not specified (s/m/h), log and status pages display the same value in milliseconds. This parameter is specific to the [**TCP-conn**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#tcp-conn-probe) probe type.(default value: **1s**)
- `thr-http-time` (time; unset): Fail threshold for http-resp-time. This parameter is specific to the [**HTTP/S-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#http-get-probe) probe types. (default value: **10s**)
- `http-codes` (multi { http-response-range: range [100 .. 599] }; unset): Range of HTTP response status codes that are accepted as an "Up" state for the probe. See [mozilla-http-status](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) or [RFC7231](https://datatracker.ietf.org/doc/html/rfc7231#section-6). This parameter is specific to the [**HTTP/S-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#http-get-probe) probe types. (default value: **100-299**)
- `certificate` (enum: none; unset): Certificate from the local store that should be used for host verification. This parameter is specific to the [**HTTPS-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#https-get-probe) probe type.
- `check-certificate` (bool; unset): Enables trust chain validation from the local certificate store. This parameter is specific to the [**HTTPS-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#https-get-probe) probe type. (default value: **no**)
- `record-type` (enum: A | AAAA | MX | NS; unset): Record type that will be used for DNS probe. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type. (default value: **A**)
- `dns-server` (address (flags=46); unset): The DNS server that the probe should send its requests to; if not specified, it will use the value from `/ip/dns`. The probe is paced by its own `timeout`, not by the `query-server-timeout` of `/ip/dns`. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type. See [address flags](https://manual.mikrotik.com/docs/cli-reference#address-flags)

**Read-only arguments**

- `status` (enum: unknown | down | up; unset): Current status of the probe.
- `since` (date): Last time the status change happened.
- `done-tests` (num): Total number of completed probe tests.
- `failed-tests` (num): Total number of failed probe tests.
- `sent-count` (num): Amount of ICMP packets sent out during last probe test. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `response-count` (num): Amount of ICMP response packets received during last probe test. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `loss-count` (num): Amount of lost ICMP response packets during last probe test. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `loss-percent` (num): Percent of lost ICMP response packets during last probe test. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `rtt-avg` (time): Mean value of round trip time. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `rtt-min` (time): Minimal round trip time. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `rtt-max` (time): Maximum round trip time. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `rtt-jitter` (time): Jitter ( = max - min) of round trip time. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `rtt-stdev` (time): Standard deviation of round trip time. This parameter is specific to the [**ICMP**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#icmp-probe) probe type.
- `tcp-connect-time` (time): Time taken to establish a TCP connection. This parameter is specific to the [**TCP-conn**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#tcp-conn-probe) probe type.
- `http-status-code` (num): HTTP response status code (200 OK, 404 Not Found, etc.). See [mozilla-http-status](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) or [RFC7231](https://datatracker.ietf.org/doc/html/rfc7231#section-6). This parameter is specific to the [**HTTP/S-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#http-get-probe) probe types.
- `http-resp-time` (time): Time taken by the HTTP/S server to send a response after receiving a request, typically measured in milliseconds. This parameter is specific to the [**HTTP/S-GET**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#http-get-probe) probe types.
- `ip` (ipAddr): IPv4 IP address - the result of A record-type probe. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type.
- `ip6` (ip6Addr): IPv6 IP address - the result of AAAA record-type probe. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type.
- `name-servers` (multi { array-id, name-servers: string }): Name servers - the result of NS record-type probe. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type.
- `mail-servers` (multi { array-id, mail-servers: string }): Mail servers along with their priorities - the result of MX record-type probe. This parameter is specific to the [**DNS**](../../guides/diagnostics-monitoring-and-troubleshooting/netwatch.md#dns-probe) probe type.
