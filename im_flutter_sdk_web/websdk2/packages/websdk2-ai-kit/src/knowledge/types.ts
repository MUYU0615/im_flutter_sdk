export interface SkillDefinition {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly cursorGlobs: string;
  readonly body: string;
  readonly referenceIds: ReadonlyArray<string>;
}

export interface ReferenceDocument {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
}
