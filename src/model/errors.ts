import type { ModelIssue } from '../contract/types.ts';

/**
 * Error thrown when a hydrated model is refused. `issues` name each
 * offending element.
 */
export class ModelValidationError extends Error {

  issues: ModelIssue[];

  constructor(issues: ModelIssue[]) {
    const summary = issues.map((issue) => issue.message).join('; ');

    super(`modèle refusé : ${ summary }`);

    this.name = 'ModelValidationError';
    this.issues = issues;
  }
}
