import type { RefObject } from 'react';
export function usePageSwipe(root:RefObject<HTMLElement | null>, options:{blocked:boolean; pages:{name:string}[]; index:number; onSelect:(index:number)=>void; swipeWidth?:'root'}):string;
