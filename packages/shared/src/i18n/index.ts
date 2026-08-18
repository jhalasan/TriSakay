import { en } from './en.ts';
import { fil } from './fil.ts';

type Stringify<T> = T extends object
  ? { [K in keyof T]: Stringify<T[K]> }
  : string;

export type Translations = Stringify<typeof en>;
export const translations: Record<'en' | 'fil', Translations> = { en, fil };
