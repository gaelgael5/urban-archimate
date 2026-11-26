import { load as parseYaml } from 'js-yaml';

import type { HydratedModel, ModelIssue } from '../contract/types.ts';

import { ModelValidationError } from './errors.ts';
import { validateHydratedModel } from './validate.ts';

/**
 * Parses (when given YAML text) and validates a hydrated model. An
 * invalid model is refused with a {@link ModelValidationError} whose
 * issues name the offending elements. Warnings (extra graphics
 * entries, ...) are returned alongside the model.
 */
export function loadHydratedModel(
    input: string | HydratedModel
): { model: HydratedModel, warnings: ModelIssue[] } {

  let model: HydratedModel;

  if (typeof input === 'string') {
    try {
      model = parseYaml(input) as HydratedModel;
    } catch (error) {
      throw new ModelValidationError([ {
        code: 'yaml',
        message: `document YAML illisible : ${ (error as Error).message }`
      } ]);
    }
  } else {
    model = input;
  }

  if (!model || typeof model !== 'object') {
    throw new ModelValidationError([ {
      code: 'vide',
      message: 'le document du modèle est vide'
    } ]);
  }

  const { errors, warnings } = validateHydratedModel(model);

  if (errors.length) {
    throw new ModelValidationError(errors);
  }

  return { model, warnings };
}
