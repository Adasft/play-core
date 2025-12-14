import { LISTENER_TIMESTAMP } from "../constants";
import { type ListenerTimestamp } from "./queries-event-map";
import { EventStreamProxy } from "./event-stream-proxy";
import { AddEventArgsParser } from "../args/add-event-args-parser";
import { RemoveEventArgsParser } from "../args/remove-event-args-parser";
import { TargetIdentity } from "../event-target-identity";
// import { EventRegistry, EventTrigger } from "./event-trigger";

export type DocumentEventType = keyof DocumentEventMap;
type DocumentEventValue = DocumentEventMap[DocumentEventType];
export type EventListenerHandler = {
  (event: DocumentEventValue): void;
  [LISTENER_TIMESTAMP]?: ListenerTimestamp;
};
export type DelegatedEventTarget = string | Element | Document | Window;

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EventListenerConfig = {
  target: DelegatedEventTarget;
  type: DocumentEventType;
  listener: EventListenerHandler;
  options?: boolean | EventListenerOptions;
};

export type PartialEventListenerConfig = PartialBy<
  EventListenerConfig,
  "type" | "listener"
>;

export class Delegator {
  private readonly _addEventListener = new EventStreamProxy(
    (config, delegate) => this._attachEvent(config, delegate),
    new AddEventArgsParser()
  );
  private readonly _removeEventListener = new EventStreamProxy(
    (config, delegate) => this._detachEvent(config, delegate),
    new RemoveEventArgsParser()
  );
  // private readonly _registry: EventRegistry = new EventRegistry();
  // private readonly _trigger: EventTrigger = new EventTrigger(this._registry);

  get on() {
    return this._addEventListener.self("click", () => {});
  }

  get off() {
    return this._removeEventListener.self();
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

    return TargetIdentity.associateEvent(target, type);
  }

  /**
   * Case 1: target, undefined, undefined => remove all delegated events for target
   * Case 2: target, type, undefined => remove all delegated events for target and type
   * Case 3: target, type, listener => remove specific delegated event
   */
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
