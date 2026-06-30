import { listReferenceMarkdownFiles, loadReferenceDocument } from '../shared/markdown-content.js';

export const WEBSDK2_REFERENCES = listReferenceMarkdownFiles().map(fileName =>
  loadReferenceDocument(fileName)
);
