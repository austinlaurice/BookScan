import { Book } from './types.js';

/**
 * Sync configuration stored locally: whether sync is on, and the Google Apps
 * Script Web App URL to POST scanned/added books to.
 */
export interface SyncSettings {
	enabled: boolean;
	webAppUrl: string;
}

/**
 * Service for syncing books to a user-configured Google Apps Script Web App,
 * which appends them to a Google Sheet.
 */
export class SyncService {
	private static readonly SETTINGS_KEY = 'bookScan_syncSettings';

	static getSettings(): SyncSettings {
		try {
			const raw = localStorage.getItem(this.SETTINGS_KEY);
			return raw ? JSON.parse(raw) : { enabled: false, webAppUrl: '' };
		} catch (error) {
			console.error('Error loading sync settings:', error);
			return { enabled: false, webAppUrl: '' };
		}
	}

	static saveSettings(settings: SyncSettings): void {
		localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
	}

	/**
	 * Fire-and-forget sync of a single book to the configured Web App.
	 * Apps Script Web Apps don't return browser-readable CORS responses, so
	 * `no-cors` + `text/plain` is used to avoid a failing preflight request.
	 * This means only network-level failures are observable here — a request
	 * that "sends" successfully is not a guarantee the sheet was updated.
	 */
	static syncBook(book: Book, collectionName: string): void {
		const settings = this.getSettings();
		if (!settings.enabled || !settings.webAppUrl) return;

		const payload = {
			timestamp: new Date().toISOString(),
			collection: collectionName,
			title: book.title,
			authors: book.authors?.join(', ') || '',
			isbn: book.isbn || '',
			publisher: book.publisher || '',
			publishedDate: book.publishedDate || ''
		};

		fetch(settings.webAppUrl, {
			method: 'POST',
			mode: 'no-cors',
			headers: { 'Content-Type': 'text/plain' },
			body: JSON.stringify(payload)
		}).catch((error) => {
			console.error('Sync request failed to send:', error);
		});
	}
}
