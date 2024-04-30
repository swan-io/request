import { expect, test } from "vitest";
import { Request, emptyToError } from "../src/Request";
import { Future, Option, Result } from "@swan-io/boxed";

test("Request: basic", async () => {
  return Request.make({ url: "data:text/plain,hello!" }).tap((value) => {
    expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
    expect(value.map((value) => value.response)).toEqual(
      Result.Ok(Option.Some("hello!")),
    );
    expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
  });
});

test("Request: emptyToError", async () => {
  return Request.make({ url: "data:text/plain,hello!" })
    .mapOkToResult(emptyToError)
    .tap((value) => {
      expect(value).toEqual(Result.Ok("hello!"));
    });
});

test("Request: JSON as text", async () => {
  return Request.make({ url: 'data:text/json,{"ok":true}' }).tap((value) => {
    expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
    expect(value.map((value) => value.response)).toEqual(
      Result.Ok(Option.Some('{"ok":true}')),
    );
    expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
  });
});

test("Request: JSON as JSON", async () => {
  return Request.make({
    url: 'data:text/json,{"ok":true}',
    responseType: "json",
  }).tap((value) => {
    expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
    expect(value.map((value) => value.response)).toEqual(
      Result.Ok(Option.Some({ ok: true })),
    );
    expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
  });
});

test("Request: invalid JSON as JSON", async () => {
  return Request.make({
    url: 'data:text/json,{"ok":UNKNOWN}',
    responseType: "json",
  }).tap((value) => {
    expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
    expect(value.map((value) => value.response)).toEqual(
      Result.Ok(Option.None()),
    );
    expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
  });
});
