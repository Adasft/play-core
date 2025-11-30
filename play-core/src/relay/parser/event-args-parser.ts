import type {
  DocumentEventType,
  EventListenerHandler,
  DelegatedEventTarget,
  PartialEventListenerConfig,
} from "../core/delegator";

export interface EventArgParserHandle<T> {
  parse(args: EventListenerArgs, fallbackTarget?: Element): T;
}

type ShortEventSignatureArgs = [
  type?: DocumentEventType,
  listener?: EventListenerHandler,
  options?: boolean | EventListenerOptions
];

type FullEventSignatureArgs = [
  target?: DelegatedEventTarget,
  type?: DocumentEventType,
  listener?: EventListenerHandler,
  options?: boolean | EventListenerOptions
];

export type EventListenerArgs =
  | FullEventSignatureArgs
  | ShortEventSignatureArgs;

export abstract class EventArgsParser {
  protected parseArgs(
    args: EventListenerArgs,
    fallbackTarget?: Element
  ): PartialEventListenerConfig {
    let target: DelegatedEventTarget | undefined | null;
    let type: DocumentEventType | undefined;
    let listener: EventListenerHandler | undefined;
    let options: boolean | EventListenerOptions | undefined;

    if (this._isShortSignature(args)) {
      [type, listener, options] = args;
    } else if (this._isFullSignature(args)) {
      [target, type, listener, options] = args;
    }

    target ??= fallbackTarget;
    if (!target) {
      throw new Error(
        "Target is required: not provided in args and no default target set"
      );
    }

    return {
      target,
      type,
      listener,
      options,
    };
  }

  private _isShortSignature(
    args: EventListenerArgs
  ): args is ShortEventSignatureArgs {
    return typeof args[0] === "string" && typeof args[1] === "function";
  }

  private _isFullSignature(
    args: EventListenerArgs
  ): args is FullEventSignatureArgs {
    return (
      this._isValidTarget(args[0]) &&
      typeof args[1] === "string" &&
      typeof args[2] === "function"
    );
  }

  private _isValidTarget(value: unknown): value is DelegatedEventTarget {
    return (
      typeof value === "string" ||
      value instanceof Element ||
      value instanceof Document ||
      value instanceof Window
    );
  }
}
