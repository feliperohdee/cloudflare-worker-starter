import puppeteer from '@cloudflare/puppeteer';

import context from '@/worker/context';

const injectBrowserRenderFlag = (html: string): string => {
	const scriptTag = `
    <script>
    	window.__IS_BROWSER_RENDERED__ = true;
    	window.__RENDER_TIME__ = "${new Date().toISOString()}";
    	document.dispatchEvent(new CustomEvent('browser-rendered'));
    </script>
  `;

	return html.replace('<head>', '<head>' + scriptTag);
};

const render = async ({
	language,
	url
}: {
	language: string;
	url: string;
}): Promise<string> => {
	const { env } = context.store;

	const browser = await puppeteer.launch(env.BROWSER);
	const page = await browser.newPage();

	try {
		await page.setViewport({ width: 1200, height: 800 });
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
		);

		if (language && language !== 'default') {
			await page.setExtraHTTPHeaders({
				'Accept-Language': language
			});
		}

		// Add a script to expose a flag that the client can check
		await page.evaluateOnNewDocument(() => {
			// @ts-ignore - This will be available in the browser context
			window.__IS_BROWSER_RENDERED__ = true;
		});

		// Navigate to the app with the correct path
		await page.goto(url, {
			waitUntil: 'networkidle0'
		});

		// Wait for the page to indicate it's fully rendered
		// This checks for the data-app-ready attribute or the app-rendered event
		await page.evaluate(() => {
			return new Promise<void>(resolve => {
				if (
					document.documentElement.getAttribute('data-app-ready') ===
					'true'
				) {
					return resolve();
				}

				// Listen for the custom event
				document.addEventListener('app-rendered', () => {
					return resolve();
				}, { once: true });

				// Fallback timeout (10 seconds max wait)
				setTimeout(resolve, 10000);
			});
		});

		// Get the fully rendered HTML
		let renderedHtml = await page.content();

		// Inject the browser render flag into the HTML
		renderedHtml = injectBrowserRenderFlag(renderedHtml);

		return renderedHtml;
	} finally {
		await browser.close();
	}
}

export default {render};
