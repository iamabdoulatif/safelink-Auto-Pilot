# /ip/traffic-flow/ipfix

> Source: https://manual.mikrotik.com/docs/cli-reference/ip/traffic-flow/ipfix

Type: Settings Directory

Select the fields included in IPFIX flow records. A row set to `yes` exports that field per flow.

**Arguments**

- `nat-events` (bool): Include the NAT bitmask of the flow (event flags)
- `first-forwarded` (bool): Include the timestamp of the first forwarded packet of the flow
- `last-forwarded` (bool): Include the timestamp of the last forwarded packet of the flow
- `sys-init-time` (bool): Include the system boot time reference of the flow
- `packets` (bool): Include the number of packets in the flow
- `bytes` (bool): Include the total byte count of the flow
- `src-port` (bool): Include the source port number of the flow
- `dst-port` (bool): Include the destination port number of the flow
- `in-interface` (bool): Include the interface the flow was received on
- `out-interface` (bool): Include the interface the flow was sent out on
- `protocol` (bool): Include the IP protocol number (TCP, UDP, ICMP, ...)
- `tos` (bool): Include the IP header TOS (Type of Service) field
- `tcp-flags` (bool): Include the cumulative TCP flags of the flow (SYN, ACK, ...)
- `dst-mac-address` (bool): Include the destination MAC address of the flow
- `src-mac-address` (bool): Include the source MAC address of the flow
- `src-address` (bool): Include the source IP address of the flow
- `dst-address` (bool): Include the destination IP address of the flow
- `src-address-mask` (bool): Include the source netmask length (summarization)
- `dst-address-mask` (bool): Include the destination netmask length
- `gateway` (bool): Include the gateway IP address the flow was routed to
- `ttl` (bool): Include the TTL of the packets
- `ip-header-length` (bool): Include the IP header length
- `is-multicast` (bool): Mark the multicast flows
- `ip-total-length` (bool): Include the total IP packet length in bytes
- `nat-src-address` (bool): Include the NATed source address of the flow
- `nat-dst-address` (bool): Include the NATed destination address of the flow
- `nat-src-port` (bool): Include the NATed source port of the flow
- `nat-dst-port` (bool): Include the NATed destination port of the flow
- `ipv6-flow-label` (bool): Include the IPv6 flow label field
- `udp-length` (bool): Include the UDP payload length
- `tcp-seq-num` (bool): Include the TCP sequence number
- `tcp-ack-num` (bool): Include the TCP acknowledgment number
- `tcp-window-size` (bool): Include the TCP window size
- `igmp-type` (bool): Include the IGMP message type
- `icmp-type` (bool): Include the ICMP type
- `icmp-code` (bool): Include the ICMP code
