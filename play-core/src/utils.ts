// export function lookupMapValue<K, V>(
//   map: Map<K, V>,
//   key: K,
//   defaultValue: V
// ): V {
//   return map.get(key) ?? map.set(key, defaultValue).get(key) as V;
// }

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
