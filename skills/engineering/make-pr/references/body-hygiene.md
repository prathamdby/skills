# Body read-back

Load after create/update when remote body differs from the locked ledger body.
Normalize only a single trailing newline. Any other addition/difference is
dirty, including identity trailers, Made-with/product marketing, and trailing
blocks. Exact user-pasted links belonging to the ledger are retained.

Update only the body once to the ledger's exact text, then read it back.
Remaining differences are `BLOCKED`, with the leftover lines. Report whether
a strip ran. A clean draft is not proof that the platform kept it clean.
