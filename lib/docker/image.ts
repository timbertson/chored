export interface Image {
	url: string,
	tag?: string,
	digest?: string,
}

export class ImageExt implements Image {
	url: string
	tag?: string
	digest?: string

	constructor(i: Image) {
		this.url = i.url
		this.tag = i.tag
		this.digest = i.digest
	}
	
	withTag(tag: string): ImageExt {
		return new ImageExt({ url: this.url, tag })
	}

	withDigest(digest: string): ImageExt {
		return new ImageExt({ url: this.url, digest })
	}
	
	// only really useful to make comparisons simpler in tests
	get raw(): Image {
		const rv: Image = { url: this.url }
		if (this.tag != null) rv.tag = this.tag
		if (this.digest != null) rv.digest = this.tag
		return rv
	}
	
	static show(i: Image): string {
		let ret = i.url
		if (i.digest) {
			ret = ret + '@' + i.digest
		} else if (i.tag) {
			ret = ret + ':' + i.tag
		}
		return ret
	}

	static showSource(i: Image | string): string {
		if (typeof(i) === 'string' || !Object.hasOwn(i, 'url')) {
			return i as string
		} else {
			return ImageExt.show(i)
		}
	}
}

export function image(i: Image | string, tag?: string): ImageExt {
	let img = new ImageExt((typeof(i) === 'string') ? new ImageExt({ url: i }) : i)
	if (tag != null) {
		img = img.withTag(tag)
	}
	return img
}
