# Prepare contract

Input: absolute anchor, slug, URL, update boolean.
Create sandbox and initialize missing manifest as [].
Normalize origin comparison: lowercase host, SCP syntax to host/owner/repo,
strip .git/trailing slash. Slug collision tries owner-repo; ambiguity blocks.

Validate existing clone with Git and origin. Manifest-listed invalid clone or
origin mismatch blocks without moving/deleting it. Reuse if update is false;
otherwise pull --ff-only, blocking on divergence/transport errors.
A manifest-free invalid path moves to a timestamped .partial sibling before
one clone retry; preserve unknown data. Clone missing repos with depth 1.

Only after validation upsert slug,url,local_path,cloned_at, atomically through
a sibling temp manifest. Return identity/path and cloned/updated/reused or
blocked:<reason>. Done when clone, origin, and manifest all agree.
