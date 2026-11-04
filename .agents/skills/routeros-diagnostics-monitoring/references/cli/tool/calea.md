# /tool/calea

> Source: https://manual.mikrotik.com/docs/cli-reference/tool/calea

Package: calea; Type: Directory

**Flags**

- `X`: disabled

**Arguments**

- `case-id` (num)
- `case-name` (string)
- `intercept-ip` (ipAddr)
- `intercept-port` (num)
- `action` (enum: pcap | limited)
- `file-root` (string)
- `pcap-file-stop-interval` (time)
- `pcap-file-stop-size` (num)
- `pcap-file-stop-count` (num)
- `pcap-file-hash-method` (enum: none | md5 | sha1 | sha256)
- `limited-file-stop-interval` (time)
- `limited-file-hash-method` (enum: none | md5 | sha1 | sha256)

**Read-only arguments**

- `access-session-id` (num)
- `packets` (num)
- `bytes` (num)
