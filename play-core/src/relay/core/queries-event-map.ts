import type { EventListenerHandler, DocumentEventType } from "./delegator";
import { TargetIndentity } from "../event-target-identity";
import { LISTENER_TIMESTAMP } from "../constants";
import { ensureLookupValue, mergeAllSorted, getTimestamp } from "../helpers";

export type ListenerTimestamp = number;
type QueryMap = Map<string, Set<EventListenerHandler>>;
type SelectorKind = "class" | "id" | "tag" | "data" | "complex";
type CssSelector = { type: SelectorKind; value: string };

export class QueriesEventMap {
  private readonly _queries: Record<SelectorKind, QueryMap | null> = {
    id: null,
    class: null,
    tag: null,
    data: null,
    complex: null,
  };

  private readonly _selectorPatterns: Record<
    Exclude<SelectorKind, "complex">,
    RegExp
  >;

  constructor(private readonly _eventType: DocumentEventType) {
    this._selectorPatterns = {
      class: /^\.[\w-]+$/,
      id: /^#[\w-]+$/,
      tag: /^[a-zA-Z][a-zA-Z0-9-]*$/,
      data: TargetIndentity.createPattern(this._eventType),
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

    const id = target.id;
    if (id) {
      groups.push(this._getGroup("id", id));
    }

    const tag = target.tagName.toLowerCase();
    if (tag) {
      groups.push(this._getGroup("tag", tag));
    }

    const classList = target.classList;
    if (classList.length) {
      for (const className of classList) {
        groups.push(this._getGroup("class", className));
      }
    }

    // relay id (data) - Attribute (data-relay-<event>-<id>)
    // If the target was registered explicitly, it will have a relay identity.
    // All elements with relay identity are considered to have a data selector
    if (TargetIndentity.is(target)) {
      const relayId = TargetIndentity.get(target, "id")!;
      groups.push(this._getGroup("data", relayId));
    }

    // complex selectors
    if (this._queries.complex) {
      for (const [selector, handlers] of this._queries.complex) {
        if (!target.matches(selector)) continue;
        groups.push([...handlers]);
      }
    }

    // Merge all groups and sort by timestamp.
    // This ensures that listeners are called in the order they were added.
    return mergeAllSorted(groups, (a, b) => getTimestamp(a) - getTimestamp(b));
  }

  private _getGroup(kind: SelectorKind, key: string): EventListenerHandler[] {
    return [...(this._queries[kind]?.get(key) ?? [])];
  }

  private _parseQuery(query: string): CssSelector {
    // 1. Class: .foo
    if (this._selectorPatterns.class.test(query)) {
      return { type: "class", value: query.slice(1) };
    }

    // 2. ID: #foo
    if (this._selectorPatterns.id.test(query)) {
      return { type: "id", value: query.slice(1) };
    }

    // 4. Tag: div, span, button...
    if (this._selectorPatterns.tag.test(query)) {
      return { type: "tag", value: query.toLowerCase() };
    }

    // 3. Data: [data-relay-click="..."]
    const dataPattern = this._selectorPatterns.data;
    if (dataPattern.test(query)) {
      const match = dataPattern.exec(query)!;
      return { type: "data", value: match[2] };
    }

    return { type: "complex", value: query };
  }
}
