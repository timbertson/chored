export function defaulted<Arg, Ret>(defaults: Partial<Arg>, fn: (_: Arg) => Ret, attrs?: Object): (_: Arg) => Ret {
	const ret = (arg: Arg) => fn({ ... defaults, ... arg })
	if (attrs) {
		Object.assign(ret, attrs)
	}
	return ret
}
