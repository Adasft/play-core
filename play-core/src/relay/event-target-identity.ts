import type { DocumentEventType } from "./core/delegator";
import { getRandomId } from "./helpers";
import { RELAY_EVENT_TARGET_IDENTITY } from "./constants";

interface TargetIdentityElement extends Element {
  [RELAY_EVENT_TARGET_IDENTITY]?: EventTargetIdentityValue;
}

type EventTargetIdentityValue = {
  readonly id: string;
};

function defineEventTargetIdentity(element: Element) {
  Object.defineProperty(element, TargetIndentity.PROPERTY, {
    value: {
      id: getRandomId(),
    },
  });
}

export const TargetIndentity = Object.freeze(
  Object.seal({
    PROPERTY: RELAY_EVENT_TARGET_IDENTITY as typeof RELAY_EVENT_TARGET_IDENTITY,
    PREFIX: "data-relay",

    createPattern: (eventType: DocumentEventType) =>
      new RegExp(`^${TargetIndentity.PREFIX}-${eventType}-([a-z0-9]{10})$`),

    queryOf: (element: Element, eventType: DocumentEventType): string => {
      if (!TargetIndentity.is(element)) {
        defineEventTargetIdentity(element);
      }

      const id = TargetIndentity.get(element, "id")!;
      const attr = `${TargetIndentity.PREFIX}-${eventType}-${id}`;

      if (!element.hasAttribute(attr)) {
        element.setAttribute(attr, "");
      }

      return attr;
    },

    is: (
      element: Element
    ): element is Element & {
      [RELAY_EVENT_TARGET_IDENTITY]: EventTargetIdentityValue;
    } => TargetIndentity.PROPERTY in element,

    get: (
      element: TargetIdentityElement,
      key: keyof EventTargetIdentityValue
    ): string | undefined => {
      return element[TargetIndentity.PROPERTY]?.[key];
    },
  })
);
