import { MODEL_GROUPS } from './composer-data.js';

export const MAX_REPLY_MODELS = 5;
export const MIN_REPLY_MODELS = 2;

const knownModels = new Set(MODEL_GROUPS.flatMap(group => group.models.map(model => model.name)));
const defaultModel = 'Auto';

function validModels(models, limit) {
  return [...new Set((Array.isArray(models) ? models : []).filter(name => knownModels.has(name)))].slice(0, limit);
}

export function readModelSelection(draft) {
  const multiple = Boolean(draft?.multiModel);
  const source = Array.isArray(draft?.models) ? draft.models : [draft?.model];
  const models = validModels(source, multiple ? MAX_REPLY_MODELS : 1);
  return { multiple, models: models.length ? models : [defaultModel] };
}

export function toggleReplyModel(selection, name) {
  const multiple = Boolean(selection?.multiple);
  const models = validModels(selection?.models, multiple ? MAX_REPLY_MODELS : 1);
  if (!knownModels.has(name)) return { multiple, models };
  if (!multiple) return { multiple, models: [name] };
  if (models.includes(name)) return { multiple, models: models.filter(model => model !== name) };
  if (models.length >= MAX_REPLY_MODELS) return { multiple, models };
  return { multiple, models: [...models, name] };
}

export function setReplyModelMode(selection, multiple) {
  const nextMultiple = Boolean(multiple);
  const models = validModels(selection?.models, nextMultiple ? MAX_REPLY_MODELS : 1);
  return { multiple: nextMultiple, models: models.length ? models : [defaultModel] };
}
