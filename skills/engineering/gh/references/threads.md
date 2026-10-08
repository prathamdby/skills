# Discussion JSON

conversation items: kind(review/comment), state?, author, createdAt, body,
id, databaseId, url. Threads: id, databaseId, url, isResolved, isOutdated,
path, line, originalLine, moreComments, comments[{author,createdAt,body,id,
databaseId,url}]. Top-level markers: moreReviews, moreComments, moreConvo,
moreThreadComments.

Thread databaseId/url come from the first comment (native REST reply target),
not the GraphQL thread type. Nested comments initially use first 100.
Complete pages remaining comments and older reviews/conversation; any set
marker still means failed/truncated pages, never exhaustive completeness.
Without complete, nested moreComments and top-level markers expose caps.

Default hides resolved/outdated; open retains unresolved including outdated;
all retains every thread. Reviews omit PENDING/empty bodies.
GraphQL pages threads first 100; latest 50 reviews/comments are on page one.
