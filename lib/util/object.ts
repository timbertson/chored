import { dedupe } from './collection.ts'

export function notNull<T>(v: T|undefined|null, desc?: string): T {
	if (v == null) {
		const msg = desc ? `Error: ${desc} is null` : 'Error: unexpected null'
		throw new Error(msg)
	}
	return v
}

export function merge<T>(a: T, ...rest: Partial<T>[]): T {
	const ret: T = {...a}
	for (const addition of rest) {
		Object.assign(ret, addition)
	}
	return ret
}

export function tap<T>(obj: T, fn: (obj: T) => any): T {
	fn(obj)
	return obj
}

// source: https://github.com/joonhocho/tsdef/blob/master/src/index.ts
export type DeepPartial<T> =
	// map types without expliit keys should NOT be partialized, beause we can't guarantee that the LHS has the same keys
	string extends keyof T ? T : {
		// if it's not an indexed type, we create an interface with the same keys but partialized values
		[P in keyof T]?:
			// if it's an array of something, return that
			T[P] extends Array<infer I>
				? Array<I>
				// otherwise partialize each value type
				: DeepPartial<T[P]>;
	}

export function isObject(obj: any) {
	if (typeof obj === "object" && obj !== null) {
		if (typeof Object.getPrototypeOf === "function") {
			const prototype = Object.getPrototypeOf(obj);
			return prototype === Object.prototype || prototype === null;
		}
		return Object.prototype.toString.call(obj) === "[object Object]";
	}
	return false;
}

interface IObject {
	[key: string]: any
}

export interface DeepMergeOptions {
	arrays: 'union' | 'concat' | 'replace'
}

type ArrayMerge = (a: Array<any>, b: Array<any>) => Array<any>
const arrayMergeImpl : {union: ArrayMerge, concat: ArrayMerge, replace: ArrayMerge } = {
	union: (a,b) => dedupe(a.concat(b)),
	concat: (a,b) => a.concat(b),
	replace: (_a,b) => b,
}

export function deepMergeWith(options: DeepMergeOptions) {
	return function deepMerge<T extends IObject>(base: T, ...rest: DeepPartial<T>[]): T {
		const result = {} as any
		Object.assign(result, base)
		for (const addition of rest) {
			for (const key of Object.keys(addition)) {
				if (Array.isArray(result[key]) && Array.isArray(addition[key])) {
					result[key] = arrayMergeImpl[options.arrays](result[key], addition[key] as Array<any>)
				} else if (isObject(result[key]) && isObject(addition[key])) {
					result[key] = deepMerge(result[key] as IObject, addition[key] as IObject)
				} else {
					result[key] = addition[key]
				}
			}
		}
		return result as T
	}
}

export const deepMerge = deepMergeWith({ arrays: 'replace' })
