<img width="108" alt="@swan-io/request logo" src="https://github.com/swan-io/request/blob/main/logo.svg?raw=true">

# @swan-io/request

[![mit licence](https://img.shields.io/dub/l/vibe-d.svg?style=for-the-badge)](https://github.com/swan-io/request/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@swan-io/request?style=for-the-badge)](https://www.npmjs.org/package/@swan-io/request)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@swan-io/request?label=size&style=for-the-badge)](https://bundlephobia.com/result?p=@swan-io/request)

> Wrapper for XMLHttpRequest with better data-structures

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
- Handles `onLoadStart` & `onProgress` events
- Handles **timeouts**
- Types the response using the provided `responseType`

## Getting started

```ts
import { Request, badStatusToError, emptyToError } from "@swan-io/request";

// Regular case
Request.make({ url: "/api/health" }).onResolve(console.log);
// Result.Ok({status: 200, ok: true, response: Option.Some("{\"ok\":true}")})

// Timeout
Request.make({ url: "/api/health", timeout: 2000 }).onResolve(console.log);
// Result.Error(TimeoutError)

// Network error
Request.make({ url: "/api/health" }).onResolve(console.log);
// Result.Error(NetworkError)

// Custom response type
Request.make({ url: "/api/health", responseType: "json" }).onResolve(
  console.log,
);
// Result.Ok({status: 200, ok: true, response: Option.Some({ok: true})})

// Handle empty response as an error
Request.make({ url: "/api/health" })
  .mapOkToResult(emptyToError)
  .onResolve(console.log);
// Result.Error(EmptyResponseError)

// Handle bad status as an error
Request.make({ url: "/api/health" })
  .mapOkToResult(badStatusToError)
  .onResolve(console.log);
// Result.Error(BadStatusError)

// Cancel request
useEffect(() => {
  const future = Request.make({ url: "/api/health" });
  return () => future.cancel();
}, []);
```

## API

### Request.make(config)

#### config

- `url`: string
- `method`: `GET` (default), `POST`, `OPTIONS`, `PATCH`, `PUT` or `DELETE`
- `responseType`:
  - `text`: (default) response will be a `string`
  - `arraybuffer`: response will be a `ArrayBuffer`
  - `document`: response will be `Document`
  - `blob`: response will be `Blob`
  - `json`: response will be a JSON value
- `body`: request body
- `headers`: a record containing the headers
- `withCredentials`: boolean
- `onLoadStart`: event triggered on load start
- `onProgress`: event triggered at different times when the payload is being sent
- `timeout`: number

#### Return value

Returns a `Future<Result<Response<T>, NetworkError | TimeoutError>>`, where `Response<T>` has the following properties:

- `status`: `number`
- `ok`: `boolean`
- `response`: `Option<T>`
- `xhr`: `XMLHttpRequest`

`T` is the type associated with the `responseType` provided in the `config` object.

### emptyToError

Helper to use with `mapOkToResult` to consider empty response as an error.

### badStatusToError

Helper to use with `mapOkToResult` to consider a status outside of the 200-299 range as an error.

## [License](./LICENSE)
