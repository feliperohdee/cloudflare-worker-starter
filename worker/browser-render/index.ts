import browser from '@/worker/browser-render/browser';
import context from '@/worker/context';

const BOT_USER_AGENTS = [
	'applebot',
	'baiduspider',
	'bingbot',
	'bitlybot',
	'crawler',
	'discordbot',
	'duckduckbot',
	'embedly',
	'facebookexternalhit',
	'flipboard',
	'google page speed',
	'googlebot',
	'headless',
	'linkedinbot',
	'nuzzel',
	'outbrain',
	'pinterest',
	'quora link preview',
	'qwantify',
	'reddit',
	'rogerbot',
	'showyoubot',
	'skypeuripreview',
	'slackbot',
	'slurp',
	'spider',
	'tumblr',
	'twitterbot',
	'vkshare',
	'w3c_validator',
	'whatsapp',
	'yandexbot'
];

const bot = (request: Request): boolean => {
	const userAgent = request.headers.get('user-agent') || '';

	return BOT_USER_AGENTS.some(botAgent =>
		userAgent.toLowerCase().includes(botAgent.toLowerCase())
	);
};

const generatePageKey = (url: URL, lang = 'default'): string => {
	const path = url.pathname + url.search;

	return `${path}:${lang}`;
};

type RenderOptions = {
	patterns: Set<string>;
};

const matchPattern = (pathname: string, patterns?: Set<string>): boolean => {
	if (!patterns || patterns.size === 0) {
		return true;
	}

	return Array.from(patterns).some(pattern => {
		const regex = new RegExp(`^${pattern}$`);
		return regex.test(pathname);
	});
};

const handler = async (options?: RenderOptions): Promise<Response | null> => {
	const { env, executionContext, request } = context.store;
	const url = new URL(request.url);
	const searchParams = new URLSearchParams(url.search);
	const forceRender = searchParams.get('__render-force') === 'true';

	if (!bot(request) && !forceRender) {
		return null;
	}

	const host = request.headers.get('host') || '';
	const language =
		searchParams.get('__render-language') ||
		request.headers.get('accept-language')?.split(',')[0] ||
		'default';
	const key = generatePageKey(url, language);

	searchParams.forEach((value, key) => {
		if (key.startsWith('__render-')) {
			searchParams.delete(key);
		}
	});

	if (matchPattern(url.pathname, options?.patterns)) {
		const coordinator = env.RENDER_COORDINATOR.get(
			env.RENDER_COORDINATOR.idFromName(host)
		);

		if (url.pathname === '/__render/status') {
			const status = await coordinator.status({
				language,
				url: url.toString()
			});

			return Response.json(status);
		}
		const cached = await coordinator.getCache({ key });

		if (cached.mustRevalidate) {
			executionContext.waitUntil(
				(async () => {
					const { status } = await coordinator.render({
						language,
						url: url.toString()
					});

					if (status === 'rendering') {
						try {
							const html = await browser.render({
								language,
								url: url.toString()
							});

							await coordinator.complete({ html, key });
						} catch (err) {
							await coordinator.complete({
								error:
									err instanceof Error
										? err.message
										: String(err),
								key
							});
						}
					}
				})()
			);
		}

		if (cached.html) {
			return new Response(cached.html, {
				headers: {
					'content-type': 'text/html',
					'x-rendered': 'true',
					'x-rendered-language': language
				}
			});
		}
	}

	return null;
};

export default { handler };
