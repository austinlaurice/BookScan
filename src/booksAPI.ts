import { GoogleBooksResponse, Book } from './types.js';

/**
 * Service for fetching book information by ISBN.
 *
 * Primary source is Google Books — but Google now gives keyless requests a
 * daily quota of zero (they respond 429), so a user-supplied API key is
 * effectively required for it. OpenLibrary is tried as a keyless fallback.
 */
export class BooksAPIService {
	private static readonly BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
	private static readonly OPENLIBRARY_URL = 'https://openlibrary.org/api/books';
	private static readonly API_KEY_STORAGE = 'bookScan_booksApiKey';

	// Website-restricted key (only usable from this app's deployed origin, so
	// safe to ship in the public bundle). Restricted to the Books API. Note:
	// lookups from localhost dev servers are blocked by the restriction —
	// add localhost to the key's allowed websites or set a key in Settings
	// if you need lookups during local development.
	private static readonly DEFAULT_API_KEY = 'AIzaSyChF6m02TVT57J_Dg1befnRdS0GxvWnpbE';

	static getApiKey(): string {
		try {
			return localStorage.getItem(this.API_KEY_STORAGE) || this.DEFAULT_API_KEY;
		} catch {
			return this.DEFAULT_API_KEY;
		}
	}

	static saveApiKey(key: string): void {
		localStorage.setItem(this.API_KEY_STORAGE, key.trim());
	}

	/**
	 * Fetch book details by ISBN. Returns null when the sources answered but
	 * don't know the book; throws when no source could be queried at all.
	 */
	static async fetchBookByISBN(isbn: string): Promise<Book | null> {
		const cleanISBN = isbn.replace(/[^0-9X]/gi, '');
		let anySourceAnswered = false;
		let rateLimited = false;

		// 1. Google Books (best coverage, incl. Taiwanese books — needs a key)
		try {
			const key = this.getApiKey();
			const url = `${this.BASE_URL}?q=isbn:${cleanISBN}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
			const response = await fetch(url);

			if (response.ok) {
				anySourceAnswered = true;
				const data: GoogleBooksResponse = await response.json();
				if (data.items && data.items.length > 0) {
					return this.convertGoogleBookToBook(data.items[0], cleanISBN);
				}
			} else if (response.status === 429 || response.status === 403) {
				rateLimited = true;
				console.warn(`Google Books API quota/permission error: ${response.status}`);
			} else {
				console.warn(`Google Books API request failed: ${response.status}`);
			}
		} catch (error) {
			console.error('Error fetching from Google Books API:', error);
		}

		// 2. OpenLibrary fallback (keyless; weak on Chinese-language books)
		try {
			const response = await fetch(
				`${this.OPENLIBRARY_URL}?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`
			);
			if (response.ok) {
				anySourceAnswered = true;
				const data = await response.json();
				const entry = data[`ISBN:${cleanISBN}`];
				if (entry) {
					return this.convertOpenLibraryToBook(entry, cleanISBN);
				}
			}
		} catch (error) {
			console.error('Error fetching from OpenLibrary:', error);
		}

		if (anySourceAnswered) {
			return null;
		}
		throw new Error(
			rateLimited
				? 'Google Books now requires an API key (free) — add one via the ⚙️ Settings.'
				: 'Failed to fetch book details. Please check your connection.'
		);
	}

	/**
	 * Search for books by query (title, author, etc.)
	 */
	static async searchBooks(query: string): Promise<Book[]> {
		try {
			const key = this.getApiKey();
			const encodedQuery = encodeURIComponent(query);
			const response = await fetch(
				`${this.BASE_URL}?q=${encodedQuery}&maxResults=10${key ? `&key=${encodeURIComponent(key)}` : ''}`
			);

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status}`);
			}

			const data: GoogleBooksResponse = await response.json();

			if (!data.items || data.items.length === 0) {
				return [];
			}

			return data.items.map(item => this.convertGoogleBookToBook(item));
		} catch (error) {
			console.error('Error searching books:', error);
			throw new Error('Failed to search books. Please check your connection.');
		}
	}

	/**
	 * Convert Google Books API response to our Book interface
	 */
	private static convertGoogleBookToBook(item: any, isbn?: string): Book {
		const volumeInfo = item.volumeInfo || {};

		// Extract ISBN if not provided
		let bookISBN = isbn;
		if (!bookISBN && volumeInfo.industryIdentifiers) {
			const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_13');
			const isbn10 = volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
			bookISBN = isbn13?.identifier || isbn10?.identifier;
		}

		return {
			id: '', // Will be set by StorageService
			isbn: bookISBN,
			title: volumeInfo.title || 'Unknown Title',
			authors: volumeInfo.authors || [],
			publisher: volumeInfo.publisher,
			publishedDate: volumeInfo.publishedDate,
			description: volumeInfo.description,
			thumbnail: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
			addedDate: '' // Will be set by StorageService
		};
	}

	/**
	 * Convert an OpenLibrary "data" API entry to our Book interface
	 */
	private static convertOpenLibraryToBook(entry: any, isbn: string): Book {
		return {
			id: '', // Will be set by StorageService
			isbn,
			title: entry.title || 'Unknown Title',
			authors: (entry.authors || []).map((a: any) => a.name).filter(Boolean),
			publisher: entry.publishers?.[0]?.name,
			publishedDate: entry.publish_date,
			description: undefined,
			thumbnail: entry.cover?.medium?.replace('http:', 'https:'),
			addedDate: '' // Will be set by StorageService
		};
	}
}
