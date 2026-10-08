# CI JSON

Drilldown: repo, pr?, runs[{runId,workflow,conclusion,url,checks,jobs?,error?}],
external[{name,state,bucket,link}]. Jobs contain name, conclusion, url,
failedSteps, log{file,lines,snippet} or {error}, annotations?.
List mode returns repo and runs[{databaseId,workflowName,displayTitle,event,
status,conclusion,createdAt}], default limit 10 with optional workflow.

Known SHA selects pinned check runs. This script is drilldown, not proof of
required-versus-optional classification or exhaustive check/annotation coverage.
Deleted/expired runs are per-run errors while others continue.
Full is accepted and ignored. External checks lack an actions/runs/id link.
For job-log handling, apply `logs.md`.
