import { Dict, Future, Option, Result } from "@swan-io/boxed";

// Copied from type-fest, to avoid adding a dependency
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// The type system allows us infer the response type from the requested `responseType`
type ResponseType = "text" | "arraybuffer" | "document" | "blob" | "json";

type ResponseTypeMap = {
  text: string;
  arraybuffer: ArrayBuffer;
  document: Document;
  blob: Blob;
  json: JsonValue;
};

type Method = "GET" | "POST" | "OPTIONS" | "PATCH" | "PUT" | "DELETE";

export class NetworkError extends Error {
  url: string;
  constructor(url: string) {
    super(`Request to ${url} failed`);
    this.url = url;
  }
}

export class TimeoutError extends Error {
  url: string;
  timeout: number | undefined;
  constructor(url: string, timeout?: number) {
    if (timeout == undefined) {
      super(`Request to ${url} timed out`);
    } else {
      super(`Request to ${url} timed out (> ${timeout}ms)`);
    }
    this.url = url;
    this.timeout = timeout;
  }
}

type Config<T extends ResponseType> = {
  url: string;
  method?: Method;
  responseType?: T;
  body?: Document | XMLHttpRequestBodyInit;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  onLoadStart?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
  onProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
  timeout?: number;
};

export type Response<T> = {
  url: string;
  status: number;
  ok: boolean;
  response: Option<T>;
  xhr: XMLHttpRequest;
};

const make = <T extends ResponseType = "text">({
  url,
  method = "GET",
  responseType,
  body,
  headers,
  withCredentials = false,
  onLoadStart,
  onProgress,
  timeout,
}: Config<T>): Future<
  Result<Response<ResponseTypeMap[T]>, NetworkError | TimeoutError>
> => {
  return Future.make<
    Result<Response<ResponseTypeMap[T]>, NetworkError | TimeoutError>
  >((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = withCredentials;
    // Only allow asynchronous requests
    xhr.open(method, url, true);
    // If `responseType` is unspecified, XHR defaults to `text`
    if (responseType != undefined) {
      xhr.responseType = responseType;
    }

    if (timeout != undefined) {
      xhr.timeout = timeout;
    }

    if (headers != undefined) {
      Dict.entries(headers).forEach(([key, value]) =>
        xhr.setRequestHeader(key, value),
      );
    }

    const onError = () => {
      cleanupEvents();
      resolve(Result.Error(new NetworkError(url)));
    };

    const onTimeout = () => {
      cleanupEvents();
      resolve(Result.Error(new TimeoutError(url, timeout)));
    };

    const onLoad = () => {
      cleanupEvents();
      const status = xhr.status;
      // Response can be empty, which is why we represent it as an option.
      // We provide the `emptyToError` helper to handle this case.
      const response = Option.fromNullable(xhr.response);

      resolve(
        Result.Ok({
          url,
          status,
          // Uses the same heuristics as the built-in `Response`
          ok: status >= 200 && status < 300,
          response,
          xhr,
        }),
      );
    };

    const cleanupEvents = () => {
      xhr.removeEventListener("error", onError);
      xhr.removeEventListener("load", onLoad);
      xhr.removeEventListener("timeout", onTimeout);
      if (onLoadStart != undefined) {
        xhr.removeEventListener("loadstart", onLoadStart);
      }
      if (onProgress != undefined) {
        xhr.removeEventListener("progress", onProgress);
      }
    };

    xhr.addEventListener("error", onError);
    xhr.addEventListener("load", onLoad);
    xhr.addEventListener("timeout", onTimeout);
    if (onLoadStart != undefined) {
      xhr.addEventListener("loadstart", onLoadStart);
    }
    if (onProgress != undefined) {
      xhr.addEventListener("progress", onProgress);
    }

    xhr.send(body);

    // Given we're using a Boxed Future, we have cancellation for free!
    return () => {
      cleanupEvents();
      xhr.abort();
    };
  });
};

export class BadStatusError extends Error {
  url: string;
  status: number;
  response: unknown;
  constructor(url: string, status: number, response?: unknown) {
    super(`Request to ${url} gave status ${status}`);
    this.url = url;
    this.status = status;
    this.response = response;
  }
}

export const badStatusToError = <T>(
  response: Response<T>,
): Result<Response<T>, BadStatusError> => {
  return response.ok
    ? Result.Ok(response)
    : Result.Error(
        new BadStatusError(
          response.url,
          response.status,
          response.response.toUndefined(),
        ),
      );
};

export class EmptyResponseError extends Error {
  url: string;
  constructor(url: string) {
    super(`Request to ${url} gave an empty response`);
    this.url = url;
  }
}

export const emptyToError = <T>(response: Response<T>) => {
  return response.response.toResult(new EmptyResponseError(response.url));
};

export const Request = {
  make,
};
