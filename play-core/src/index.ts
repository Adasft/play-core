import {
  ensureLookupValue,
  getRandomId,
  getTimestamp,
  mergeAllSorted,
} from "./utils";

export const LISTENER_TIMESTAMP = Symbol("_timestamp");

type DocumentEventType = keyof DocumentEventMap;
type DocumentEventValue = DocumentEventMap[DocumentEventType];
export type EventListenerHandler = {
  (event: DocumentEventValue): void;
  [LISTENER_TIMESTAMP]?: ListenerTimestamp;
};
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
    if (delegate && !(target instanceof Window)) {
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
    if (delegate && !(target instanceof Window)) {
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
    target: Exclude<DelegatedEventTarget, Window>,
    type: DocumentEventType,
    listener: EventListenerHandler,
    options?: boolean | EventListenerOptions
  ) {
    const query =
      typeof target === "string" ? target : this._generateQuery(type, target);
  }

  private _generateQuery(
    type: DocumentEventType,
    target: Exclude<DelegatedEventTarget, string | Window>
  ): string {
    if (target instanceof Document) {
      target = document.documentElement;
    }

    if (!(target instanceof Element)) {
      throw new Error("No element");
    }

    return RelayId.ensureAttribute(target, type);
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

const RelayId = Object.freeze({
  PROPERTY: "__relayEventId",
  PREFIX: "data-relay",

  createPattern: (eventType: DocumentEventType) =>
    new RegExp(`^${RelayId.PREFIX}-${eventType}-([a-z0-9]{10})$`),

  ensureAttribute: (element: Element, eventType: DocumentEventType): string => {
    const id = RelayId.getId(element);
    const attr = `${RelayId.PREFIX}-${eventType}-${id}`;

    if (!element.hasAttribute(attr)) {
      element.setAttribute(attr, "");
    }

    return attr;
  },

  has: (element: Element): element is Element & { __relayEventId: string } =>
    RelayId.PROPERTY in element,

  getId: (element: Element): string =>
    RelayId.has(element) ? element.__relayEventId : getRandomId(),
});

type ListenerTimestamp = number;
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

  private readonly _regExp: Record<
    Uppercase<Exclude<SelectorKind, "complex">>,
    RegExp
  >;

  constructor(private readonly _eventType: DocumentEventType) {
    this._regExp = {
      CLASS: /^\.[\w-]+$/,
      ID: /^#[\w-]+$/,
      TAG: /^\w+$/,
      DATA: RelayId.createPattern(this._eventType),
    };
  }

  public set(query: string, listener: EventListenerHandler) {
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
      () => new Set<EventListenerHandler>()
    );

    if (listeners.has(listener)) return;

    listener[LISTENER_TIMESTAMP] = performance.now();

    listeners.add(listener);
  }

  public resolveListeners(target: Element): EventListenerHandler[] {
    const groups: EventListenerHandler[][] = [];

    // id
    const id = target.id;
    if (id) {
      groups.push(this._getGroup("id", id));
    }

    // tag
    const tag = target.tagName.toLowerCase();
    if (tag) {
      groups.push(this._getGroup("tag", tag));
    }

    // class
    const classList = target.classList;
    if (classList.length) {
      for (const className of classList) {
        groups.push(this._getGroup("class", className));
      }
    }

    // relay id (data)
    if (RelayId.has(target)) {
      const relayId = target.__relayEventId as string;
      groups.push(this._getGroup("data", relayId));
    }

    // complex selectors
    if (this._queries.complex) {
      for (const [selector, handlers] of this._queries.complex) {
        if (!target.matches(selector)) continue;
        groups.push([...handlers]); // ya ordenado
      }
    }

    // --- MERGE FINAL DE TODOS LOS GRUPOS ----
    return mergeAllSorted(groups, (a, b) => getTimestamp(a) - getTimestamp(b));
  }

  private _getGroup(kind: SelectorKind, key: string): EventListenerHandler[] {
    return [...(this._queries[kind]?.get(key) ?? [])];
  }

  private _parseQuery(query: string): CssSelector {
    if (this._regExp.CLASS.test(query)) {
      return { type: "class", value: query.slice(1) };
    }

    if (this._regExp.ID.test(query)) {
      return { type: "id", value: query.slice(1) };
    }

    if (this._regExp.TAG.test(query)) {
      return { type: "tag", value: query.toLowerCase() };
    }

    const dataMatch = query.match(this._regExp.DATA);
    if (dataMatch) {
      return { type: "data", value: dataMatch[2] };
    }

    return { type: "complex", value: query };
  }
}
