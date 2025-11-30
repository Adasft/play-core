import {
  EventArgsParser,
  type EventArgParserHandle,
  type EventListenerArgs,
} from "./event-args-parser";
import type { PartialEventListenerConfig } from "../core/delegator";

export class RemoveEventArgsParser
  extends EventArgsParser
  implements EventArgParserHandle<PartialEventListenerConfig>
{
  public parse(
    args: EventListenerArgs,
    fallbackTarget?: Element
  ): PartialEventListenerConfig {
    return super.parseArgs(args, fallbackTarget);
  }
}
