import { ensureLookupValue } from "./utils";

type DocumentEventType = keyof DocumentEventMap;
type DocumentEventValue = DocumentEventMap[DocumentEventType];
type EventListenerHandler = (event: DocumentEventValue) => void;
type DelegatedEventTarget = string | Element | Document | Window;

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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

type EventListenerArgs = FullEventSignatureArgs | ShortEventSignatureArgs;

type EventListenerConfig = {
  target: DelegatedEventTarget;
  type: DocumentEventType;
  listener: EventListenerHandler;
  options?: boolean | EventListenerOptions;
};

type PartialEventListenerConfig = PartialBy<
  EventListenerConfig,
  "type" | "listener"
>;

interface EventArgParserHandle<T> {
  parse(args: EventListenerArgs, fallbackTarget?: Element): T;
}

abstract class EventArgsParser {
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

class AddEventArgsParser
  extends EventArgsParser
  implements EventArgParserHandle<EventListenerConfig>
{
  public parse(
    args: EventListenerArgs,
    fallbackTarget?: Element
  ): EventListenerConfig {
    const config = this.parseArgs(args, fallbackTarget);
    this.validate(config);
    return config;
  }

  private validate(
    config: PartialEventListenerConfig
  ): asserts config is EventListenerConfig {
    if (!config.type) {
      throw new Error("Event type is required for addEventListener");
    }

    if (!config.listener) {
      throw new Error("Event handler is required for addEventListener");
    }
  }
}

class RemoveEventArgsParser
  extends EventArgsParser
  implements EventArgParserHandle<PartialEventListenerConfig>
{
  public parse(
    args: EventListenerArgs,
    fallbackTarget?: Element
  ): PartialEventListenerConfig {
    return super.parseArgs(args, fallbackTarget);
  }
}

class EventStreamProxy<
  T extends EventListenerConfig | PartialEventListenerConfig
> extends Function {
  private static _bindedTarget?: Element = undefined;

  constructor(
    private readonly _handle: (config: T, delegate: boolean) => void,
    private readonly _parser: EventArgParserHandle<T>
  ) {
    super();

    return new Proxy(this, {
      apply(target, _, args: EventListenerArgs) {
        target._resolve(true, ...args);
      },
    });
  }

  public bind(target: Element) {
    EventStreamProxy._bindedTarget = target;
  }

  public direct(...args: EventListenerArgs) {
    this._resolve(false, ...args);
  }

  private _resolve(delegate: boolean, ...args: EventListenerArgs) {
    const config = this._parser.parse(args, EventStreamProxy._bindedTarget);

    this._handle(config, delegate);
  }
}

class Delegator {
  private readonly _addEventListener = new EventStreamProxy(
    (config, delegate) => this._attachEvent(config, delegate),
    new AddEventArgsParser()
  );
  private readonly _removeEventListener = new EventStreamProxy(
    (config, delegate) => this._detachEvent(config, delegate),
    new RemoveEventArgsParser()
  );

  get on() {
    return this._addEventListener;
  }

  get off() {
    return this._removeEventListener;
  }

  private _attachEvent(
    { target, type, listener, options }: EventListenerConfig,
    delegate: boolean
  ) {
    if (delegate) {
      this._addDelegatedEvent(target, type, listener, options);
      return;
    }

    let element = this._resolveTarget(target);

    element?.addEventListener(type, listener, options);
  }

  private _detachEvent(
    { target, type, listener }: PartialEventListenerConfig,
    delegate: boolean
  ) {
    if (delegate) {
      this._removeDelegatedEvent(target, type, listener);
      return;
    }

    let element = this._resolveTarget(target);

    if (!type || !listener) {
      console.warn(
        "Unable to remove native event listener: removeEventListener requires both type and listener parameters. " +
          "Received: " +
          `type=${type ?? "undefined"}, listener=${listener ?? "undefined"}`
      );
      return;
    }

    element?.removeEventListener(type, listener);
  }

  private _addDelegatedEvent(
    target: DelegatedEventTarget,
    type: DocumentEventType,
    listener: EventListenerHandler,
    options?: boolean | EventListenerOptions
  ) {
    if (target instanceof Window) {
      target.addEventListener(type, listener, options);
      return;
    }

    if (target instanceof Document) {
      target = document.documentElement;
    }
  }

  private _removeDelegatedEvent(
    target: DelegatedEventTarget,
    type?: DocumentEventType,
    listener?: EventListenerHandler
  ) {}

  private _resolveTarget(
    target: DelegatedEventTarget
  ): Exclude<DelegatedEventTarget, string> | null {
    let element =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!element) {
      console.warn(`Target not found:`, target.toString());
      return null;
    }

    return element;
  }
}

type QueryMap = Map<string, Set<EventListenerHandler>>;
type SelectorKind = "class" | "id" | "tag" | "data" | "complex";
type CssSelector = { type: SelectorKind; value: string };

class QueriesEventMap {
  private readonly _queries: Record<SelectorKind, QueryMap | null> = {
    id: null,
    class: null,
    tag: null,
    data: null,
    complex: null,
  };

  public set(query: string, value: EventListenerHandler) {
    if (!query.trim().length) return;

    const selector = this._parseQuery(query);
    const map = ensureLookupValue(
      this._queries,
      selector.type,
      () => new Map() as QueryMap
    );
    const listeners = ensureLookupValue(
      map,
      selector.value,
      () => new Set() as Set<EventListenerHandler>
    );

    if (listeners.has(value)) return;
    listeners.add(value);
  }

  public resolveListeners(target: Element): EventListenerHandler[] {
    
  }

  private _parseQuery(query: string): CssSelector {
    if (/^\.[\w-]+$/.test(query)) {
      return { type: "class", value: query.slice(1) };
    }

    if (/^#[\w-]+$/.test(query)) {
      return { type: "id", value: query.slice(1) };
    }

    if (/^\w+$/.test(query)) {
      return { type: "tag", value: query.toLowerCase() };
    }

    if (/\[data-on-stream-([a-zA-Z0-9_-]+)\]/.test(query)) {
      return { type: "data", value: query };
    }

    return { type: "complex", value: query };
  }
}
