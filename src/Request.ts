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
    Object.setPrototypeOf(this, NetworkError.prototype);

    this.name = "NetworkError";
    this.url = url;
  }
}

export class TimeoutError extends Error {
  url: string;
  timeout: number | undefined;

  constructor(url: string, timeout?: number) {
    super(`Request to ${url} timed out` + (timeout ? ` (> ${timeout}ms)` : ""));
    Object.setPrototypeOf(this, TimeoutError.prototype);

    this.name = "TimeoutError";
    this.url = url;
    this.timeout = timeout;
  }
}

type Config<T extends ResponseType> = {
  url: string;
  headers?: Record<string, string>;
  body?: Document | XMLHttpRequestBodyInit;
  method?: Method;
  responseType: T;
  timeout?: number;
  withCredentials?: boolean;
  onProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
  onLoadStart?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
};

export type Response<T> = {
  ok: boolean;
  response: Option<T>;
  status: number;
  url: string;
  xhr: XMLHttpRequest;
};

const make = <T extends ResponseType>({
  url,
  headers,
  body,
  method = "GET",
  responseType,
  timeout,
  withCredentials = false,
  onProgress,
  onLoadStart,
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
    if (responseType != null) {
      xhr.responseType = responseType;
    }

    if (timeout != null) {
      xhr.timeout = timeout;
    }

    if (headers != null) {
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

      if (onLoadStart != null) {
        xhr.removeEventListener("loadstart", onLoadStart);
      }
      if (onProgress != null) {
        xhr.removeEventListener("progress", onProgress);
      }
    };

    xhr.addEventListener("error", onError);
    xhr.addEventListener("load", onLoad);
    xhr.addEventListener("timeout", onTimeout);

    if (onLoadStart != null) {
      xhr.addEventListener("loadstart", onLoadStart);
    }
    if (onProgress != null) {
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
    Object.setPrototypeOf(this, BadStatusError.prototype);

    this.name = "BadStatusError";
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
    Object.setPrototypeOf(this, EmptyResponseError.prototype);

    this.name = "EmptyResponseError";
    this.url = url;
  }
}

export const emptyToError = <T>(response: Response<T>) => {
  return response.response.toResult(new EmptyResponseError(response.url));
};

export const Request = { make };
