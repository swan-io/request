<img width="108" alt="@swan-io/request logo" src="https://github.com/swan-io/request/blob/main/logo.svg?raw=true">

# @swan-io/request

[![mit licence](https://img.shields.io/dub/l/vibe-d.svg?style=for-the-badge)](https://github.com/swan-io/request/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@swan-io/request?style=for-the-badge)](https://www.npmjs.org/package/@swan-io/request)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@swan-io/request?label=size&style=for-the-badge)](https://bundlephobia.com/result?p=@swan-io/request)

> Wrapper for fetch with better data-structures

## Installation

```bash
$ yarn add @swan-io/request @swan-io/boxed
# --- or ---
$ npm install --save @swan-io/request @swan-io/boxed
```

## Design principles

- Has a **strong contract** with data-structures from [Boxed](https://swan-io.github.io/boxed/) (`Future`, `Result` & `Option`)
- Makes the request **easily cancellable** with `Future` API
- Gives **freedom of interpretation for response status**
- Handles **timeouts**
- Types the response using the provided `type`

## Getting started

```ts
import { Request, badStatusToError, emptyToError } from "@swan-io/request";

// Regular case
Request.make({ url: "/api/health", type: "text" }).onResolve(console.log);
// Result.Ok({status: 200, ok: true, response: Option.Some("{\"ok\":true}")})

// Timeout
Request.make({ url: "/api/health", type: "text", timeout: 2000 }).onResolve(
  console.log,
);
// Result.Error(TimeoutError)

// Network error
Request.make({ url: "/api/health", type: "text" }).onResolve(console.log);
// Result.Error(NetworkError)

// Custom response type
Request.make({ url: "/api/health", type: "json" }).onResolve(console.log);
// Result.Ok({status: 200, ok: true, response: Option.Some({ok: true})})

// Handle empty response as an error
Request.make({ url: "/api/health", type: "text" })
  .mapOkToResult(emptyToError)
  .onResolve(console.log);
// Result.Error(EmptyResponseError)

// Handle bad status as an error
Request.make({ url: "/api/health", type: "text" })
  .mapOkToResult(badStatusToError)
  .onResolve(console.log);
// Result.Error(BadStatusError)

// Cancel request
useEffect(() => {
  const future = Request.make({ url: "/api/health", type: "text" });
  return () => future.cancel();
}, []);
```

## API

### Request.make(config)

#### config

- `url`: string
- `method`: `GET` (default), `POST`, `OPTIONS`, `PATCH`, `PUT` or `DELETE`
- `type`:
  - `text`: (default) response will be a `string`
  - `arraybuffer`: response will be a `ArrayBuffer`
  - `blob`: response will be `Blob`
  - `json`: response will be a JSON value
- `body`: request body
- `headers`: a record containing the headers
- `creatials`: `omit`, `same-origin` or `include`
- `timeout`: number

#### Return value

Returns a `Future<Result<Response<T>, NetworkError | TimeoutError>>`, where `Response<T>` has the following properties:

- `status`: `number`
- `ok`: `boolean`
- `response`: `Option<T>`
- `url`: `string`
- `headers`: `Headers`

`T` is the type associated with the `responseType` provided in the `config` object.

### emptyToError

Helper to use with `mapOkToResult` to consider empty response as an error.

### badStatusToError

Helper to use with `mapOkToResult` to consider a status outside of the 200-299 range as an error.

## [License](./LICENSE)
