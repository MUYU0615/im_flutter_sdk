export interface GroupNamecardHydratorOptions {
  readonly maxConcurrency: number;
}

export class GroupNamecardHydrator {
  public constructor(private readonly options: GroupNamecardHydratorOptions) {}

  public getOptions(): GroupNamecardHydratorOptions {
    return this.options;
  }
}
