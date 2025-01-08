import { beforeEach, expect, test } from "vitest";
import { Request, emptyToError } from "../src/Request";
import { Option, Result } from "@swan-io/boxed";

test("Request: basic", async () => {
  return Request.make({ url: "data:text/plain,hello!", type: "text" }).tap(
    (value) => {
      expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
      expect(value.map((value) => value.response)).toEqual(
        Result.Ok(Option.Some("hello!")),
      );
      expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
    },
  );
});

test("Request: emptyToError", async () => {
  return Request.make({ url: "data:text/plain,hello!", type: "text" })
    .mapOkToResult(emptyToError)
    .tap((value) => {
      expect(value).toEqual(Result.Ok("hello!"));
    });
});

test("Request: JSON as text", async () => {
  return Request.make({ url: 'data:text/json,{"ok":true}', type: "text" }).tap(
    (value) => {
      expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
      expect(value.map((value) => value.response)).toEqual(
        Result.Ok(Option.Some('{"ok":true}')),
      );
      expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
    },
  );
});

test("Request: JSON as JSON", async () => {
  return Request.make({
    url: 'data:text/json,{"ok":true}',
    type: "json",
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
    type: "json",
  }).tap((value) => {
    expect(value.map((value) => value.status)).toEqual(Result.Ok(200));
    expect(value.map((value) => value.response)).toEqual(
      Result.Ok(Option.None()),
    );
    expect(value.map((value) => value.ok)).toEqual(Result.Ok(true));
  });
});

test("Request: invalid JSON as JSON", async () => {
  const request = Request.make({
    url: "https://api.punkapi.com/v2/beers",
    type: "text",
  });

  request.cancel();

  // @ts-expect-error
  expect(request._state.tag).toBe("Cancelled");
});
