import { LISTENER_TIMESTAMP } from "./constants";
import type { EventListenerHandler } from "./core/delegator";

// export function lookupObjectValue<K extends keyof any, V>(
//   map: { [P in K]: V },
//   key: K,
//   defaultValue: NonNullable<V>
// ): NonNullable<V> {
//   let value = map[key];

//   if (!value) {
//     value = map[key] = defaultValue;
//   }

//   return value as NonNullable<V>;
// }

export function ensureLookupValue<K, V>(
  map: Map<K, V> | Record<string, V>,
  key: K extends keyof any ? K : never,
  defaultValue: () => V
): NonNullable<V> {
  if (map instanceof Map) {
    if (!map.has(key)) {
      map.set(key, defaultValue());
    }
    return map.get(key)!;
  }

  if (map[key as string] === undefined) {
    map[key as string] = defaultValue();
  }
  return map[key as string]!;
}

export function getRandomId() {
  if (!window.crypto) {
    return Math.random().toString(36).slice(2);
  }

  return Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((v) => v.toString(36))
    .join("");
}

export function createListener<T extends (...args: any) => any>(
  handler: T
): EventListenerHandler {
  (handler as EventListenerHandler)[LISTENER_TIMESTAMP] = performance.now();
  return handler;
}

export function getTimestamp(listener: EventListenerHandler) {
  return listener[LISTENER_TIMESTAMP]!;
}

export function mergeSorted<T>(
  a: T[],
  b: T[],
  compare: (a: T, b: T) => number
): T[] {
  let result = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (compare(a[i], b[j]) <= 0) {
      result.push(a[i++]);
    } else {
      result.push(b[j++]);
    }
  }

  return result.concat(a.slice(i)).concat(b.slice(j));
}

export function mergeAllSorted<T>(
  sortedGroups: T[][],
  compare: (a: T, b: T) => number
): T[] {
  let result: T[] | null = null;

  for (const group of sortedGroups) {
    if (group.length === 0) continue;

    result = result === null ? [...group] : mergeSorted(result, group, compare);
  }

  return result ?? [];
}

export function when<T extends PropertyKey>(
  currentCase: T,
  caseHandlers: Record<T, () => any> & { default?: () => any }
) {
  if (!caseHandlers.hasOwnProperty(currentCase)) {
    return caseHandlers.default?.();
  }

  const caseHandler = caseHandlers[currentCase];

  if (typeof caseHandler !== "function") {
    throw new Error(
      `Invalid case: "${JSON.stringify(
        currentCase
      )}". Expected a function but got ${typeof caseHandler}.`
    );
  }

  return caseHandler();
}
