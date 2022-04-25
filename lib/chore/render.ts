import { render } from '../render.ts'

// fallback render only includes `./chored` wrapper
export default async function(_: {}) {
	return render([])
}
