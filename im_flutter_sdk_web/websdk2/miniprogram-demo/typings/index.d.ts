declare function App(options: Record<string, unknown>): void;
declare function Page(options: Record<string, unknown>): void;
declare const wx: Record<string, unknown>;

declare module '../../dist/index.js' {
  export * from '../../src/index';
}
