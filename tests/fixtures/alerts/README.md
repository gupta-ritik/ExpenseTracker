Synthetic bank alerts. Every number, name and reference is invented.

Blocks are separated by a line containing only `---`. Each block starts with
`sender:` and `expect:` header lines, followed by the message text.

- `expect: ignore <reason>`
- `expect: <expense|income> <rupees> [last4=] [ref=] [merchant=] [date=]`
