import { Future, Option, Result } from "@swan-io/boxed";

// Copied from type-fest, to avoid adding a dependency
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// The type system allows us infer the response type from the requested `responseType`
type ResponseType = "text" | "arraybuffer" | "blob" | "json";

type ResponseTypeMap = {
  text: string;
  arraybuffer: ArrayBuffer;
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
    if (timeout == undefined) {
      super(`Request to ${url} timed out`);
    } else {
      super(`Request to ${url} timed out (> ${timeout}ms)`);
    }
    Object.setPrototypeOf(this, TimeoutError.prototype);
    this.name = "TimeoutError";
    this.url = url;
    this.timeout = timeout;
  }
}

export class CanceledError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, CanceledError.prototype);
    this.name = "CanceledError";
  }
}

type Config<T extends ResponseType> = {
  url: string;
  method?: Method;
  type: T;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  timeout?: number;
  cache?: RequestCache;
  integrity?: string;
  keepalive?: boolean;
  mode?: RequestMode;
  priority?: RequestPriority;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  window?: null;
};

export type Response<T> = {
  url: string;
  status: number;
  ok: boolean;
  response: Option<T>;
};

const resolvedPromise = Promise.resolve();

const make = <T extends ResponseType>({
  url,
  method,
  type,
  body,
  headers,
  credentials,
  timeout,
  cache,
  integrity,
  keepalive,
  mode,
  priority,
  redirect,
  referrer,
  referrerPolicy,
  window,
}: Config<T>): Future<
  Result<Response<ResponseTypeMap[T]>, NetworkError | TimeoutError>
> => {
  return Future.make<
    Result<Response<ResponseTypeMap[T]>, NetworkError | TimeoutError>
  >((resolve) => {
    const controller = new AbortController();

    if (timeout) {
      setTimeout(() => {
        controller.abort(new TimeoutError(url, timeout));
      }, timeout);
    }

    const init = async () => {
      const res = await fetch(url, {
        method,
        credentials,
        headers,
        signal: controller.signal,
        body,
        cache,
        integrity,
        keepalive,
        mode,
        priority,
        redirect,
        referrer,
        referrerPolicy,
        window,
      });

      let payload;
      try {
        if (type === "arraybuffer") {
          payload = Option.Some(await res.arrayBuffer());
        }
        if (type === "blob") {
          payload = Option.Some(await res.blob());
        }
        if (type === "json") {
          payload = Option.Some(await res.json());
        }
        if (type === "text") {
          payload = Option.Some(await res.text());
        }
      } catch {
        payload = Option.None();
      }

      const status = res.status;
      const ok = res.ok;

      const response: Response<ResponseTypeMap[T]> = {
        url,
        status,
        ok,
        response: payload as Option<ResponseTypeMap[T]>,
      };
      return response;
    };

    init().then(
      (response) => resolve(Result.Ok(response)),
      (error) => {
        if (error instanceof CanceledError) {
          return resolvedPromise;
        }
        if (error instanceof TimeoutError) {
          resolve(Result.Error(error));
          return resolvedPromise;
        }
        resolve(Result.Error(new NetworkError(url)));
        return resolvedPromise;
      },
    );

    return () => {
      controller.abort(new CanceledError());
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

export const Request = {
  make,
};
