---
id: design-then-ship
kind: chain
primary: null
participants: [upfront-design, deslop, commit, make-pr]
complete_when: every milestone ticked, deferred, or skipped and PR URL verified
---

# design-then-ship

Trigger: design then ship

1. leaf:upfront-design — DIRECT is no-op success; DESIGNED and CHECKED are success; continue on either
2. parent:implementation — for each open milestone: implement, then run upfront-design with the approved design path until CHECKED, deferred, or skipped
3. leaf:deslop
4. leaf:commit
5. leaf:make-pr
