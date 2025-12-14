import type { DocumentEventType } from "./core/delegator";
import { getRandomId } from "./helpers";
import { RELAY_EVENT_TARGET_IDENTITY } from "./constants";

interface TargetIdentityElement extends Element {
  [RELAY_EVENT_TARGET_IDENTITY]?: EventTargetIdentityValue;
}

// type EventTargetIdentityValue = {
//   readonly id: string;
//   associatedEvents: Set<DocumentEventType>;
// };

// export const TargetIndentity = Object.freeze(
//   Object.seal({
//     PROPERTY: RELAY_EVENT_TARGET_IDENTITY as typeof RELAY_EVENT_TARGET_IDENTITY,
//     PREFIX: "data-relay",

//     createPattern: (eventType: DocumentEventType) =>
//       new RegExp(`^${TargetIndentity.PREFIX}-${eventType}-([a-z0-9]{10})$`),

//     defineIdentity: (element: Element) => {
//       try {
//         Object.defineProperty(element, TargetIndentity.PROPERTY, {
//           value: {
//             id: getRandomId(),
//             associatedEvents: new Set<DocumentEventType>(),
//           },
//         });
//       } catch {
//         throw new Error(
//           "Cannot redefine event target identity on the element."
//         );
//       }
//     },

//     assosiateEvent: (element: Element, eventType: DocumentEventType) => {
//       if (!TargetIndentity.is(element)) {
//         throw new Error(
//           "Unable to associate event: Target identity is not defined on the element."
//         );
//       }

//       element[TargetIndentity.PROPERTY].associatedEvents.add(eventType);
//     },

//     queryOf: (element: Element, eventType: DocumentEventType): string => {
//       if (!TargetIndentity.is(element)) {
//         defineEventTargetIdentity(element);
//       }

//       const id = TargetIndentity.get(element, "id")!;
//       const attr = `${TargetIndentity.PREFIX}-${eventType}-${id}`;

//       if (!element.hasAttribute(attr)) {
//         element.setAttribute(attr, "");
//       }

//       return attr;
//     },

//     is: (
//       element: Element
//     ): element is Element & {
//       [RELAY_EVENT_TARGET_IDENTITY]: EventTargetIdentityValue;
//     } => TargetIndentity.PROPERTY in element,

//     get: <K extends keyof EventTargetIdentityValue>(
//       element: TargetIdentityElement,
//       key: K
//     ): EventTargetIdentityValue[K] | undefined => {
//       return element[TargetIndentity.PROPERTY]?.[key];
//     },
//   })
// );

class EventTargetIdentityValue {
  private readonly _associatedEvents: Set<DocumentEventType> =
    new Set<DocumentEventType>();

  constructor(public readonly id: string) {}

  public setEvent(eventType: DocumentEventType) {
    this._associatedEvents.add(eventType);
  }

  public hasEvent(eventType: DocumentEventType): boolean {
    return this._associatedEvents.has(eventType);
  }

  public removeEvent(eventType: DocumentEventType): boolean {
    return this._associatedEvents.delete(eventType);
  }

  public clearEvents() {
    this._associatedEvents.clear();
  }
}

export class TargetIdentity {
  public static PROP = RELAY_EVENT_TARGET_IDENTITY;

  private constructor() {
    throw new Error(
      "Invalid instantiation: cannot instantiate TargetIdentity class."
    );
  }

  public static is(element: Element): element is Element & {
    [RELAY_EVENT_TARGET_IDENTITY]: EventTargetIdentityValue;
  } {
    return (
      RELAY_EVENT_TARGET_IDENTITY in element &&
      element[RELAY_EVENT_TARGET_IDENTITY] instanceof EventTargetIdentityValue
    );
  }

  public static get(
    element: TargetIdentityElement
  ): EventTargetIdentityValue | undefined {
    return element[RELAY_EVENT_TARGET_IDENTITY];
  }

  public static define(element: Element): EventTargetIdentityValue {
    let identity = this.get(element);

    if (!identity) {
      const id = getRandomId();
      identity = new EventTargetIdentityValue(id);

      Object.defineProperty(element, RELAY_EVENT_TARGET_IDENTITY, {
        value: identity,
        writable: false,
        enumerable: false,
      });
    }

    return identity;
  }

  public static associateEvent(
    element: Element,
    eventType: DocumentEventType
  ): string {
    const identity = this.define(element);
    const attr = `data-relay-${eventType}-${identity.id}`;

    if (!identity.hasEvent(eventType)) {
      element.setAttribute(attr, "");
      identity.setEvent(eventType);
    }

    return attr;
  }
}
