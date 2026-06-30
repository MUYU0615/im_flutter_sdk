export interface UserInfoHydratorOptions {
  readonly batchSize: number;
}

export class UserInfoHydrator {
  public constructor(private readonly options: UserInfoHydratorOptions) {}

  public getOptions(): UserInfoHydratorOptions {
    return this.options;
  }
}
