import { extensionOf, JAVASCRIPT_EXTENSIONS } from './foldDialects';
import type { FoldMethod } from './foldModel';
import { heuristicFoldMethod } from './heuristicFolds';
import { javascriptFoldMethod } from './javascriptFolds';
import { grammarNameFor } from './treeSitter';
import { treeSitterFoldMethod } from './treeSitterFolds';

export function foldMethodFor(filename: string): FoldMethod {
  if (JAVASCRIPT_EXTENSIONS.has(extensionOf(filename))) return javascriptFoldMethod;
  return grammarNameFor(filename) ? treeSitterFoldMethod : heuristicFoldMethod;
}
