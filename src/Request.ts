import { Dict, Future, Option, Result } from "@swan-io/boxed";

// Copied from type-fest, to avoid adding a dependency
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

type ResponseTypeMap = {
  text: string;
  arraybuffer: ArrayBuffer;
  document: Document;
  blob: Blob;
  json: JsonValue;
};

// The type system allows us infer the response type from the requested `responseType`
type ResponseType = keyof ResponseTypeMap;

type Method = "GET" | "POST" | "OPTIONS" | "PATCH" | "PUT" | "DELETE";

class NetworkError extends Error {}
class TimeoutError extends Error {}

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
      resolve(Result.Error(new NetworkError()));
    };

    const onTimeout = () => {
      cleanupEvents();
      resolve(Result.Error(new TimeoutError()));
    };

    const onLoad = () => {
      cleanupEvents();
      const status = xhr.status;
      // Response can be empty, which is why we represent it as an option.
      // We provide the `emptyToError` helper to handle this case.
      const response = Option.fromNullable(xhr.response);

      resolve(
        Result.Ok({
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

class BadStatusError extends Error {}

export const badStatusToError = <T>(
  response: Response<T>,
): Result<Response<T>, BadStatusError> => {
  return response.ok
    ? Result.Ok(response)
    : Result.Error(
        new BadStatusError(`Received HTTP status ${response.status}`),
      );
};

class EmptyResponseError extends Error {}

export const emptyToError = <T>(response: Response<T>) => {
  return response.response.toResult(new EmptyResponseError());
};

export const Request = {
  make,
};
