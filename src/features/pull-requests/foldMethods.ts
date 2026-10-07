import type { FoldMethod } from './foldModel';
import { heuristicFoldMethod } from './heuristicFolds';
import { grammarNameFor } from './treeSitter';
import { treeSitterFoldMethod } from './treeSitterFolds';

export function foldMethodFor(filename: string): FoldMethod {
  return grammarNameFor(filename) ? treeSitterFoldMethod : heuristicFoldMethod;
}
