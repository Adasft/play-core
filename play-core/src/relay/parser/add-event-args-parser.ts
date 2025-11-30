import {
  EventArgsParser,
  type EventArgParserHandle,
  type EventListenerArgs,
} from "./event-args-parser";
import type {
  PartialEventListenerConfig,
  EventListenerConfig,
} from "../core/delegator";

export class AddEventArgsParser
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
