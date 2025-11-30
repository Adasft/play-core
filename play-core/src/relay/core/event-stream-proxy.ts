import type {
  EventListenerConfig,
  PartialEventListenerConfig,
} from "./delegator";
import type {
  EventArgParserHandle,
  EventListenerArgs,
} from "../parser/event-args-parser";

export class EventStreamProxy<
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
