export type PageActivityCallback = (active: boolean) => void;

export function isPageActive(doc?: Document): boolean;
export function subscribePageActivity(callback: PageActivityCallback, doc?: Document): () => void;
export function reflectPageActivity(doc?: Document): () => void;
