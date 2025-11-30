import { LISTENER_TIMESTAMP } from "../constants";
import { type ListenerTimestamp } from "./queries-event-map";
import { EventStreamProxy } from "./event-stream-proxy";
import { AddEventArgsParser } from "../parser/add-event-args-parser";
import { RemoveEventArgsParser } from "../parser/remove-event-args-parser";
import { TargetIndentity } from "../event-target-identity";

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

    return TargetIndentity.queryOf(target, type);
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
