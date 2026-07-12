import { Book } from './types.js';
import { UIUtils } from './utils.js';

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
	 * Fire-and-forget POST to a Web App. Apps Script Web Apps don't return
	 * browser-readable CORS responses, so `no-cors` + `text/plain` is used to
	 * avoid a failing preflight request. This means only network-level
	 * failures are distinguishable here — a resolved request confirms the
	 * browser sent it and got *some* response, not that Apps Script's doPost
	 * actually wrote the row.
	 */
	private static sendPayload(webAppUrl: string, payload: Record<string, string>): void {
		fetch(webAppUrl, {
			method: 'POST',
			mode: 'no-cors',
			headers: { 'Content-Type': 'text/plain' },
			body: JSON.stringify(payload)
		})
			.then(() => UIUtils.showToast('🔄 Synced to Google Sheet', 2000))
			.catch((error) => {
				console.error('Sync request failed to send:', error);
				UIUtils.showToast('⚠️ Sync request failed to send (check network/URL)', 3000);
			});
	}

	/** Syncs a single book's ISBN to the configured Web App, if sync is enabled. */
	static syncBook(book: Book): void {
		const settings = this.getSettings();
		if (!settings.enabled || !settings.webAppUrl || !book.isbn) return;

		this.sendPayload(settings.webAppUrl, { isbn: book.isbn });
	}

	/** Sends a one-off test payload to an arbitrary URL, independent of saved settings. */
	static sendTest(webAppUrl: string): void {
		this.sendPayload(webAppUrl, { isbn: '0000000000000' });
	}
}
