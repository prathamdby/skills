---
name: box
description: box when cloning, updating, listing, or searching an external git repository from its real local source.
---

# Box

Clone the external repository into a sandbox next to this skill file and answer from that local copy. Keep a small manifest there that maps each repository name to its URL and local path. Reuse a clone that already exists. Pull only when the answer needs remote state or the user asks for an update. Never put sandbox data inside the user's working directory.

Search the local files and answer with `path:line` citations. When several questions or areas need searching, split the work across parallel readers with scopes that do not overlap. Say `no matches` when an area has none. Never guess the contents of a repository from its URL.

If you find a directory in the sandbox that you did not create, do not delete it. Move it aside with a timestamp in the name and tell the user. Never commit or push inside a clone.
