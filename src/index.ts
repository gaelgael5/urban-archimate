/**
 * Public entry of urban-archimate.
 *
 * Importing this module registers the `<urban-archimate>` custom
 * element and exposes the editor facade and the contract types.
 */

export * from './contract/types.ts';

export { UrbanArchimateEditor } from './editor/UrbanArchimateEditor.ts';
export type { EditorOptions } from './editor/UrbanArchimateEditor.ts';

export { exportExchange } from './exchange/export.ts';
export { loadHydratedModel } from './model/load.ts';
export { validateHydratedModel } from './model/validate.ts';
export { ModelValidationError } from './model/errors.ts';

export {
  UrbanArchimateElement,
  register
} from './web-component/UrbanArchimateElement.ts';

import { register } from './web-component/UrbanArchimateElement.ts';

register();
