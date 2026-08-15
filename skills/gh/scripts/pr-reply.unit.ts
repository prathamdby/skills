#!/usr/bin/env node
import assert from "node:assert/strict";
import { parseReviewCommentId, replyPath, replyRootId } from "./pr-reply.ts";

assert.equal(parseReviewCommentId("42"), 42);
assert.equal(parseReviewCommentId("discussion_r99"), 99);
assert.equal(
  parseReviewCommentId("https://github.com/acme/app/pull/12#discussion_r123456"),
  123456,
);
assert.equal(
  parseReviewCommentId("https://api.github.com/repos/acme/app/pulls/comments/77"),
  77,
);
assert.throws(() => parseReviewCommentId("abc"), /review comment id/);
assert.throws(() => parseReviewCommentId("0"), /review comment id/);
assert.throws(() => parseReviewCommentId("-3"), /review comment id/);

assert.equal(replyPath("acme/app", 12, 99), "repos/acme/app/pulls/12/comments/99/replies");
assert.equal(replyPath("acme/app", 12), "repos/acme/app/issues/12/comments");

assert.equal(replyRootId({ id: 9, in_reply_to_id: 3 }), 3);
assert.equal(replyRootId({ id: 3 }), 3);
assert.equal(replyRootId({ id: 3, in_reply_to_id: null }), 3);

console.log("ok pr-reply.unit");
