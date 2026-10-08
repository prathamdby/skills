# Persist contract

Input: absolute anchor, identity, clone path, target AGENTS.md, completed search.
Read `agents-md-template.md`, substitute slug/URL/path, and replace its marker
block or append once under External references, creating file/heading if absent.
Duplicate markers or missing end marker block; incomplete search blocks.
Write through a sibling temporary file and atomic rename; verify exactly one
complete block. Output target and created/updated/appended or blocked:<reason>.
