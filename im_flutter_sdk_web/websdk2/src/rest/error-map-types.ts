export interface RuntimeApiErrorEntry {
  readonly code: number;
  readonly retryable?: boolean;
  readonly httpStatus?: number;
  readonly provisional?: boolean;
  readonly canonicalCode?: number;
  readonly aliases?: readonly string[];
  readonly matchField?: string;
  readonly matchValue?: string | number;
  readonly matchPattern?: string;
}

export interface RuntimeApiErrorDefinition {
  readonly range?: string;
  readonly localErrors?: Readonly<
    Record<string, Readonly<Record<string, RuntimeApiErrorEntry>>>
  >;
  readonly errors: Readonly<Record<string, RuntimeApiErrorEntry>>;
}

export interface RuntimeCommonErrorDefinition {
  readonly range?: string;
  readonly errors: Readonly<Record<string, RuntimeApiErrorEntry>>;
}

export interface RuntimeErrorMap {
  readonly common: Readonly<Record<string, RuntimeCommonErrorDefinition>>;
  readonly apis: Readonly<Record<string, RuntimeApiErrorDefinition>>;
}

export const mergeRuntimeErrorMaps = (
  ...maps: ReadonlyArray<RuntimeErrorMap>
): RuntimeErrorMap => {
  const common: Record<string, RuntimeCommonErrorDefinition> = {};
  const apis: Record<string, RuntimeApiErrorDefinition> = {};

  for (const map of maps) {
    Object.assign(common, map.common);
    Object.assign(apis, map.apis);
  }

  return { common, apis };
};
