import type { tr } from "./tr";

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Dictionary = DeepString<typeof tr>;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = { [K in keyof T]: T[K] extends string ? K : Join<K, Leaves<T[K]>> }[keyof T];
export type TKey = Leaves<typeof tr>;
