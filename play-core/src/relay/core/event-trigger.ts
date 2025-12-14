// import { ensureLookupValue } from "../helpers";
// import type { DocumentEventType, EventListenerHandler } from "./delegator";
// // import { QueriesEventMap } from "./queries-event-map";

// export class EventRegistry {
//   private readonly _eventMappings: Map<DocumentEventType, QueriesEventMap> =
//     new Map();

//   public register(type: DocumentEventType, { query, listener }: { query: string, listener: EventListenerHandler }) {
//     const queriesEventMap = ensureLookupValue(
//       this._eventMappings,
//       type,
//       () => new QueriesEventMap(type)
//     );

//     queriesEventMap.set(query, listener);
//   }

//   // pubic unre
// }

// export class EventTrigger {
//   constructor(private readonly _registry: EventRegistry) {}
// }
