import {
  createParser,
  type ParserError,
  type AstRule,
  type AstTagName,
  type AstWildcardTag,
  type AstId,
  type AstClassName,
  type AstAttribute,
  type AstPseudoClass,
  type AstPseudoElement,
  type AstNestingSelector,
} from "css-selector-parser";
import { when } from "../helpers";

type AstRuleItem =
  | AstTagName
  | AstWildcardTag
  | AstId
  | AstClassName
  | AstAttribute
  | AstPseudoClass
  | AstPseudoElement
  | AstNestingSelector;

enum SelectorItemType {
  TagName = "TagName",
  WildcardTag = "WildcardTag",
  Id = "Id",
  ClassName = "ClassName",
  Attribute = "Attribute",
  PseudoClass = "PseudoClass",
  PseudoElement = "PseudoElement",
  NestingSelector = "NestingSelector",
}

type FinalSelectorDescriptor = {
  raw: string;
  tag?: string;
  id?: string;
  classes?: string[];
  attrs?: string[];
  pseudos?: {
    classes?: string[];
    elements?: string[];
  };
};

interface QueryParser {
  parse(
    query: string
  ): Result<{ finalSelectors: FinalSelectorDescriptor[]; matchCost: number }>;
}

class QueryParserError extends Error {
  public readonly query: string;
  public readonly position: number;

  constructor(query: string, origin: ParserError) {
    super(origin.message);
    this.name = "QueryParserError";
    this.stack = origin.stack;
    this.query = query;
    this.position = origin.position;
    this.message = this._getDetailedMessage();
  }

  private _getDetailedMessage(): string {
    const lines: string[] = [];

    lines.push(`${this.message}`);
    lines.push("");

    if (this.query.length > 80) {
      const start = Math.max(0, this.position - 40);
      const end = Math.min(this.query.length, this.position + 40);
      const snippet = this.query.substring(start, end);
      const adjustedPosition = this.position - start;

      if (start > 0) lines.push("...");
      lines.push(snippet);
      lines.push(" ".repeat(adjustedPosition) + "^----error here");
      if (end < this.query.length) lines.push("...");
    } else {
      lines.push(this.query);
      lines.push(" ".repeat(this.position) + "^");
    }

    lines.push("");
    lines.push(`Position: ${this.position}`);

    return lines.join("\n");
  }
}

export interface CostModel {
  tag(): void;
  id(): void;
  className(): void;

  attribute(hasOperator: boolean): void;

  pseudoClass(): void;
  pseudoElement(): void;

  nesting(depth: number): void;
  reset(): void;
  finalize(length: number): number;
}

class DefaultCostModel implements CostModel {
  private _totalCost: number = 0;

  public tag() {
    this._totalCost += 1.0;
  }

  public id() {
    this._totalCost += 0.2;
  }

  public className() {
    this._totalCost += 0.7;
  }

  public attribute(hasOperator: boolean) {
    this._totalCost += hasOperator ? 3.5 : 2.5;
  }

  public pseudoClass() {
    this._totalCost += 4.0;
  }

  public pseudoElement() {
    this._totalCost += 1.5;
  }

  public nesting(depth: number) {
    this._totalCost += 1.2 * depth;
  }

  public reset() {
    this._totalCost = 0;
  }

  public finalize(length: number = 1) {
    const cost = this._totalCost + (length > 1 ? Math.log2(length + 1) : 0);
    this._totalCost = 0;
    return cost;
  }
}

export class QuerySelectorParser implements QueryParser {
  private readonly _parser = createParser();

  constructor(
    private readonly _costModel: CostModel = new DefaultCostModel()
  ) {}

  public parse(
    query: string
  ): Result<{ finalSelectors: FinalSelectorDescriptor[]; matchCost: number }> {
    this._costModel.reset();
    try {
      const ast = this._parser(query);
      const finalRules = this._extractFinalRules(ast.rules);

      return [
        null,
        {
          finalSelectors: finalRules.map((rule) =>
            this._buildDescriptor(query, rule)
          ),
          matchCost: this._costModel.finalize(ast.rules.length),
        },
      ];
    } catch (error) {
      return [new QueryParserError(query, error as ParserError), null];
    }
  }

  private _buildDescriptor(
    raw: string,
    rule: AstRule
  ): FinalSelectorDescriptor {
    const descriptor: FinalSelectorDescriptor = { raw };

    for (const item of rule.items) {
      this._applyRuleItem(descriptor, item);
    }

    return descriptor;
  }

  private _applyRuleItem(
    descriptor: FinalSelectorDescriptor,
    item: AstRuleItem
  ): void {
    switch (item.type) {
      case SelectorItemType.TagName:
        descriptor.tag = item.name;
        this._costModel.tag();
        return;

      case SelectorItemType.Id:
        descriptor.id = item.name;
        this._costModel.id();
        return;

      case SelectorItemType.ClassName:
        this._push(descriptor, "classes", item.name);
        this._costModel.className();
        return;

      case SelectorItemType.Attribute:
        this._push(descriptor, "attrs", item.name);
        this._costModel.attribute(Boolean(item.operator));
        return;

      case SelectorItemType.PseudoClass:
        descriptor.pseudos ??= {};
        this._push(descriptor.pseudos, "classes", item.name);
        this._costModel.pseudoClass();
        return;

      case SelectorItemType.PseudoElement:
        descriptor.pseudos ??= {};
        this._push(descriptor.pseudos, "elements", item.name);
        this._costModel.pseudoElement();
        return;
    }
  }

  private _extractFinalRules(rules: AstRule[]): AstRule[] {
    return rules.map((rule) => this._getDeepestRule(rule));
  }

  private _getDeepestRule(rule: AstRule): AstRule {
    let current = rule;
    let depth = 0;
    while (current.nestedRule) {
      current = current.nestedRule;
      depth++;
    }
    this._costModel.nesting(depth);
    return current;
  }

  private _push<T extends object>(
    target: T,
    key: keyof T,
    value: string
  ): void {
    (target[key] as string[] | undefined)?.push?.(value) ??
      // @ts-ignore
      ((target[key] = [value]) as any);
  }
}

class LRUCache<Key, Value> {
  private readonly _cache: Map<Key, Value> = new Map();

  constructor(public readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error("LRU capacity must be greater than 0");
    }
  }

  public set(key: Key, value: Value) {
    if (this.has(key)) {
      this._cache.delete(key);
    } else if (this.isFull()) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey!);
    }

    this._cache.set(key, value);
    return this;
  }

  public get(key: Key): Value | undefined {
    const value = this._cache.get(key);
    if (value !== undefined) {
      this._cache.delete(key);
      this._cache.set(key, value);
    }
    return value;
  }

  public delete(key: Key) {
    this._cache.delete(key);
  }

  public clear() {
    this._cache.clear();
  }

  public isFull(): boolean {
    return this._cache.size >= this.capacity;
  }

  public has(key: Key): boolean {
    return this._cache.has(key);
  }

  public get size(): number {
    return this._cache.size;
  }
}

type Result<T> = [Error, null] | [null, T];

class FinalSelectorExtractor {
  private readonly _cache = new LRUCache<string, FinalSelectorDescriptor[]>(
    100
  );

  constructor(private readonly _parser: QueryParser) {}

  public extract(query: string): FinalSelectorDescriptor[] {
    const queryTrimmed = query.trim();

    if (queryTrimmed.length === 0) return [];

    if (this._cache.has(queryTrimmed)) return this._cache.get(queryTrimmed)!;

    const [error, result] = this._parser.parse(queryTrimmed);

    if (error) {
      throw error;
    }

    if (result.matchCost >= 4) {
      this._cache.set(queryTrimmed, result.finalSelectors);
    }

    return result.finalSelectors;
  }

  public invalidate(query: string) {
    this._cache.delete(query);
  }

  public clearCache() {
    this._cache.clear();
  }

  //   extract(query: string): FinalSelectorDescriptor[]
  // getCached(query: string): FinalSelectorDescriptor[] | null
  // clearCache(): void
  // invalidate(query: string): void
  // getCacheStats(): { size: number; hits: number; misses: number }
}
