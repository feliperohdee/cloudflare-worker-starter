import { DurableObject } from 'cloudflare:workers';

type CacheEntry = {
	html: string;
	lastUpdated: number;
};

type RenderStatus = {
	error?: string | null;
	html?: string | null;
	lastUpdated: number;
	renderCount: number;
	status: 'idle' | 'rendering' | 'completed' | 'failed';
};

const CACHE_TTL_SECONDS = 60 * 60;
const RENDER_TIMEOUT = 30_000;

const generatePageKey = (url: URL, lang = 'default'): string => {
	const path = url.pathname + url.search;

	return `${lang}:${path}`;
};

class RenderCoordinator extends DurableObject {
	private cache: Map<string, CacheEntry> = new Map();
	private tasks: Map<string, RenderStatus> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			const tasks =
				await ctx.storage.get<Map<string, RenderStatus>>('tasks');

			if (tasks) {
				this.tasks = tasks;

				// Clean up any stale tasks (e.g., if worker crashed during rendering)
				const now = Date.now();

				for (const [, status] of this.tasks.entries()) {
					if (
						status.status === 'rendering' &&
						now - status.lastUpdated > RENDER_TIMEOUT
					) {
						status.status = 'idle';
					}
				}

				await ctx.storage.put('tasks', this.tasks);
			}
		});
	}

	async complete({
		error,
		html,
		key
	}: {
		error?: string;
		html?: string;
		key: string;
	}): Promise<void> {
		const currentStatus = this.tasks.get(key) || {
			lastUpdated: Date.now(),
			renderCount: 0,
			status: 'idle'
		};

		const status: RenderStatus = {
			error,
			html: html || null,
			lastUpdated: Date.now(),
			renderCount: currentStatus.renderCount,
			status: error ? 'failed' : 'completed'
		};

		if (html) {
			await this.setCache({ key, html });
		}

		this.tasks.set(key, status);
		await this.ctx.storage.put('tasks', this.tasks);
	}

	async getCache({
		key
	}: {
		key: string;
	}): Promise<{ html: string; mustRevalidate: boolean }> {
		const res =
			this.cache.get(key) ||
			(await this.ctx.storage.get<CacheEntry>(`cache:${key}`)) ||
			null;

		if (!res) {
			return {
				html: '',
				mustRevalidate: true
			};
		}

		if ((Date.now() - res.lastUpdated) / 1000 > CACHE_TTL_SECONDS) {
			this.cache.delete(key);
			await this.ctx.storage.delete(`cache:${key}`);

			return {
				html: res.html,
				mustRevalidate: true
			};
		}

		return {
			html: res.html,
			mustRevalidate: false
		};
	}

	async render({
		language,
		url
	}: {
		language: string;
		url: string;
	}): Promise<RenderStatus> {
		if (!url) {
			throw new Error('Missing required fields');
		}

		const urlObj = new URL(url);
		const key = generatePageKey(urlObj, language);
		const currentStatus = this.tasks.get(key);

		if (currentStatus && currentStatus.status === 'rendering') {
			return currentStatus;
		}

		const status: RenderStatus = {
			status: 'rendering',
			lastUpdated: Date.now(),
			renderCount: (currentStatus?.renderCount || 0) + 1
		};

		this.tasks.set(key, status);
		await this.ctx.storage.put('tasks', this.tasks);

		return status;
	}

	async setCache({
		key,
		html
	}: {
		key: string;
		html: string;
	}): Promise<void> {
		const cacheEntry: CacheEntry = {
			html,
			lastUpdated: Date.now()
		};

		this.cache.set(key, cacheEntry);
		await this.ctx.storage.put(`cache:${key}`, cacheEntry);
	}

	async status({
		language,
		url
	}: {
		language: string;
		url: string;
	}): Promise<RenderStatus> {
		const urlObj = new URL(url);
		const key = generatePageKey(urlObj, language);

		return (
			this.tasks.get(key) || {
				lastUpdated: Date.now(),
				renderCount: 0,
				status: 'idle'
			}
		);
	}
}

export default RenderCoordinator;
