import { StorageService } from './storage.js';
import { ScannerService } from './scanner.js';
import { UIUtils } from './utils.js';
import { ExportService } from './export.js';
import { SyncService } from './sync.js';
import { Collection, Book } from './types.js';

/**
 * Main application class
 */
class BookScanApp {
	private currentCollection: Collection | null = null;
	private scannerService: ScannerService;

	constructor() {
		this.scannerService = new ScannerService();
		this.init();
	}

	/**
	 * Initialize the application
	 */
	private init(): void {
		this.setupEventListeners();
		this.loadCollectionsView();
	}

	/**
	 * Setup all event listeners
	 */
	private setupEventListeners(): void {
		// Collections view
		document.getElementById('btn-new-collection')?.addEventListener('click', () => {
			UIUtils.showModal('modal-new-collection');
		});

		// Collection modal
		document.getElementById('btn-save-collection')?.addEventListener('click', () => {
			this.handleCreateCollection();
		});

		document.getElementById('btn-cancel-collection')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-new-collection');
		});

		// Collection detail view
		document.getElementById('btn-back')?.addEventListener('click', () => {
			this.currentCollection = null;
			this.loadCollectionsView();
			UIUtils.switchView('collections-view');
		});

		document.getElementById('btn-scan-book')?.addEventListener('click', () => {
			this.startScanning();
		});

		document.getElementById('btn-add-manual')?.addEventListener('click', () => {
			UIUtils.showModal('modal-add-book');
		});

		document.getElementById('btn-collection-menu')?.addEventListener('click', () => {
			UIUtils.showModal('modal-collection-menu');
		});

		// Scanner view
		document.getElementById('btn-close-scanner')?.addEventListener('click', () => {
			this.stopScanning();
		});

		// Manual book entry modal
		document.getElementById('btn-save-book')?.addEventListener('click', () => {
			this.handleAddManualBook();
		});

		document.getElementById('btn-cancel-book')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-add-book');
		});

		// Collection menu modal
		document.getElementById('btn-rename-collection')?.addEventListener('click', () => {
			this.handleRenameCollection();
		});

		document.getElementById('btn-delete-collection')?.addEventListener('click', () => {
			this.handleDeleteCollection();
		});

		document.getElementById('btn-cancel-menu')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-collection-menu');
		});

		// Export buttons
		document.getElementById('btn-export-collection')?.addEventListener('click', () => {
			this.handleExportCollection();
		});

		document.getElementById('btn-export-collection-menu')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-collection-menu');
			this.handleExportCollection();
		});

		document.getElementById('btn-export-all')?.addEventListener('click', () => {
			this.handleExportAllCollections();
		});

		// Settings (sync + books API key)
		document.getElementById('btn-settings')?.addEventListener('click', () => {
			const settings = SyncService.getSettings();
			(document.getElementById('input-sync-enabled') as HTMLInputElement).checked = settings.enabled;
			(document.getElementById('input-sync-url') as HTMLInputElement).value = settings.webAppUrl;
			UIUtils.showModal('modal-sync-settings');
		});

		document.getElementById('btn-cancel-sync')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-sync-settings');
		});

		document.getElementById('btn-test-sync')?.addEventListener('click', () => {
			const webAppUrl = (document.getElementById('input-sync-url') as HTMLInputElement).value.trim();
			if (!webAppUrl) {
				UIUtils.showToast('Enter a URL first');
				return;
			}
			SyncService.sendTest(webAppUrl);
		});

		document.getElementById('btn-save-sync')?.addEventListener('click', () => {
			const enabled = (document.getElementById('input-sync-enabled') as HTMLInputElement).checked;
			const webAppUrl = (document.getElementById('input-sync-url') as HTMLInputElement).value.trim();
			SyncService.saveSettings({ enabled, webAppUrl });
			UIUtils.hideModal('modal-sync-settings');
			UIUtils.showToast('Settings saved');
		});

		// Enter key handlers for inputs
		document.getElementById('input-collection-name')?.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.handleCreateCollection();
		});
	}

	/**
	 * Load and display all collections
	 */
	private loadCollectionsView(): void {
		const collections = StorageService.loadCollections();
		const container = document.getElementById('collections-list');

		if (!container) return;

		if (collections.length === 0) {
			container.innerHTML = `
                <div class="empty-state">
                    <h3>No Collections Yet</h3>
                    <p>Create your first collection to start scanning books!</p>
                </div>
            `;
			return;
		}

		container.innerHTML = collections.map(collection => `
            <div class="collection-card" data-id="${collection.id}">
                <h3>${UIUtils.escapeHtml(collection.name)}</h3>
                <p>${collection.books.length} book${collection.books.length !== 1 ? 's' : ''}</p>
            </div>
        `).join('');

		// Add click handlers
		container.querySelectorAll('.collection-card').forEach(card => {
			card.addEventListener('click', () => {
				const id = card.getAttribute('data-id');
				if (id) this.openCollection(id);
			});
		});
	}

	/**
	 * Open a specific collection
	 */
	private openCollection(collectionId: string): void {
		const collection = StorageService.getCollection(collectionId);

		if (!collection) {
			UIUtils.showToast('Collection not found');
			return;
		}

		this.currentCollection = collection;
		this.loadCollectionDetail();
		UIUtils.switchView('collection-detail-view');
	}

	/**
	 * Load and display collection details
	 */
	private loadCollectionDetail(): void {
		if (!this.currentCollection) return;

		const titleElement = document.getElementById('collection-title');
		const booksContainer = document.getElementById('books-list');

		if (titleElement) {
			titleElement.textContent = this.currentCollection.name;
		}

		if (!booksContainer) return;

		if (this.currentCollection.books.length === 0) {
			booksContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No Books Yet</h3>
                    <p>Scan or add books to get started!</p>
                </div>
            `;
			return;
		}

		booksContainer.innerHTML = this.currentCollection.books.map(book => `
            <div class="book-card" data-id="${book.id}">
                ${book.thumbnail
				? `<img src="${book.thumbnail}" alt="${UIUtils.escapeHtml(book.title)}" class="book-cover">`
				: '<div class="book-cover"></div>'}
                <div class="book-info">
                    <h3>${UIUtils.escapeHtml(book.title)}</h3>
                    ${book.authors && book.authors.length > 0
				? `<p>${UIUtils.escapeHtml(book.authors.join(', '))}</p>`
				: ''}
                    ${book.publishedDate
				? `<p>${UIUtils.escapeHtml(book.publishedDate)}</p>`
				: ''}
                    ${book.isbn
				? `<p>ISBN: ${UIUtils.escapeHtml(book.isbn)}</p>`
				: ''}
                </div>
                <div class="book-actions">
                    <button class="btn-delete-book" data-id="${book.id}" aria-label="Delete book">🗑️</button>
                </div>
            </div>
        `).join('');

		// Add delete handlers
		booksContainer.querySelectorAll('.btn-delete-book').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const bookId = btn.getAttribute('data-id');
				if (bookId) this.handleDeleteBook(bookId);
			});
		});
	}

	/**
	 * Handle creating a new collection
	 */
	private handleCreateCollection(): void {
		const input = document.getElementById('input-collection-name') as HTMLInputElement;
		const name = input?.value.trim();

		if (!name) {
			UIUtils.showToast('Please enter a collection name');
			return;
		}

		try {
			StorageService.createCollection(name);
			UIUtils.hideModal('modal-new-collection');
			this.loadCollectionsView();
			UIUtils.showToast('Collection created!');
		} catch (error) {
			UIUtils.showToast('Failed to create collection');
			console.error(error);
		}
	}

	/**
	 * Start the barcode scanner
	 */
	private async startScanning(): Promise<void> {
		UIUtils.switchView('scanner-view');

		const statusElement = document.getElementById('scanner-status');
		if (statusElement) {
			statusElement.textContent = 'Point camera at ISBN barcode...';
		}

		try {
			await this.scannerService.startScanner(
				'reader',
				(isbn) => this.handleScannedISBN(isbn)
			);
		} catch (error) {
			UIUtils.showToast((error as Error).message);
			this.stopScanning();
		}
	}

	/**
	 * Stop the scanner
	 */
	private async stopScanning(): Promise<void> {
		await this.scannerService.stopScanner();
		UIUtils.switchView('collection-detail-view');
	}

	/**
	 * Handle scanned ISBN: record it locally and sync it to the Google
	 * Sheet. No book-details lookup — the ISBN itself is the payload.
	 */
	private async handleScannedISBN(isbn: string): Promise<void> {
		if (!this.currentCollection) return;

		// Stop scanner immediately
		await this.scannerService.stopScanner();
		UIUtils.switchView('collection-detail-view');

		try {
			const newBook = StorageService.addBookToCollection(this.currentCollection.id, {
				title: isbn,
				isbn
			});
			SyncService.syncBook(newBook, this.currentCollection.name);

			// Reload collection
			this.currentCollection = StorageService.getCollection(this.currentCollection.id);
			this.loadCollectionDetail();

			UIUtils.showToast(`Scanned: ${isbn}`);
		} catch (error) {
			UIUtils.showToast((error as Error).message, 5000);
			console.error(error);
		}
	}

	/**
	 * Handle manual book entry
	 */
	private handleAddManualBook(): void {
		if (!this.currentCollection) return;

		const titleInput = document.getElementById('input-title') as HTMLInputElement;
		const authorInput = document.getElementById('input-author') as HTMLInputElement;
		const isbnInput = document.getElementById('input-isbn') as HTMLInputElement;
		const publisherInput = document.getElementById('input-publisher') as HTMLInputElement;
		const yearInput = document.getElementById('input-year') as HTMLInputElement;

		const title = titleInput?.value.trim();

		if (!title) {
			UIUtils.showToast('Title is required');
			return;
		}

		try {
			const bookData: Omit<Book, 'id' | 'addedDate'> = {
				title,
				authors: authorInput?.value.trim() ? [authorInput.value.trim()] : undefined,
				isbn: isbnInput?.value.trim() || undefined,
				publisher: publisherInput?.value.trim() || undefined,
				publishedDate: yearInput?.value || undefined
			};

			const newBook = StorageService.addBookToCollection(this.currentCollection.id, bookData);
			SyncService.syncBook(newBook, this.currentCollection.name);

			// Reload collection
			this.currentCollection = StorageService.getCollection(this.currentCollection.id);
			this.loadCollectionDetail();

			UIUtils.hideModal('modal-add-book');
			UIUtils.showToast('Book added!');
		} catch (error) {
			UIUtils.showToast('Failed to add book');
			console.error(error);
		}
	}

	/**
	 * Handle deleting a book
	 */
	private handleDeleteBook(bookId: string): void {
		if (!this.currentCollection) return;

		if (!confirm('Delete this book?')) return;

		try {
			StorageService.removeBookFromCollection(this.currentCollection.id, bookId);

			// Reload collection
			this.currentCollection = StorageService.getCollection(this.currentCollection.id);
			this.loadCollectionDetail();

			UIUtils.showToast('Book deleted');
		} catch (error) {
			UIUtils.showToast('Failed to delete book');
			console.error(error);
		}
	}

	/**
	 * Handle renaming a collection
	 */
	private handleRenameCollection(): void {
		if (!this.currentCollection) return;

		UIUtils.hideModal('modal-collection-menu');

		const newName = prompt('Enter new name:', this.currentCollection.name);

		if (!newName || !newName.trim()) return;

		try {
			StorageService.updateCollection(this.currentCollection.id, {
				name: newName.trim()
			});

			this.currentCollection = StorageService.getCollection(this.currentCollection.id);
			this.loadCollectionDetail();

			UIUtils.showToast('Collection renamed');
		} catch (error) {
			UIUtils.showToast('Failed to rename collection');
			console.error(error);
		}
	}

	/**
	 * Handle deleting a collection
	 */
	private handleDeleteCollection(): void {
		if (!this.currentCollection) return;

		UIUtils.hideModal('modal-collection-menu');

		const bookCount = this.currentCollection.books.length;
		const message = bookCount > 0
			? `Delete "${this.currentCollection.name}" and its ${bookCount} book${bookCount !== 1 ? 's' : ''}?`
			: `Delete "${this.currentCollection.name}"?`;

		if (!confirm(message)) return;

		try {
			StorageService.deleteCollection(this.currentCollection.id);
			this.currentCollection = null;
			this.loadCollectionsView();
			UIUtils.switchView('collections-view');
			UIUtils.showToast('Collection deleted');
		} catch (error) {
			UIUtils.showToast('Failed to delete collection');
			console.error(error);
		}
	}

	/**
	 * Handle exporting current collection to CSV
	 */
	private handleExportCollection(): void {
		if (!this.currentCollection) {
			UIUtils.showToast('No collection selected');
			return;
		}

		if (this.currentCollection.books.length === 0) {
			UIUtils.showToast('Collection is empty');
			return;
		}

		try {
			const csvContent = ExportService.exportCollectionToCSV(this.currentCollection);
			const filename = ExportService.generateCollectionFilename(this.currentCollection.name);
			ExportService.downloadCSV(csvContent, filename);
			UIUtils.showToast(`Exported ${this.currentCollection.books.length} book${this.currentCollection.books.length !== 1 ? 's' : ''}`);
		} catch (error) {
			console.error('Export error:', error);
		}
	}

	/**
	 * Handle exporting all collections to CSV
	 */
	private handleExportAllCollections(): void {
		const collections = StorageService.loadCollections();

		if (collections.length === 0) {
			UIUtils.showToast('No collections to export');
			return;
		}

		const totalBooks = collections.reduce((sum, col) => sum + col.books.length, 0);

		if (totalBooks === 0) {
			UIUtils.showToast('All collections are empty');
			return;
		}

		try {
			const csvContent = ExportService.exportAllCollectionsToCSV(collections);
			const filename = ExportService.generateAllCollectionsFilename();
			ExportService.downloadCSV(csvContent, filename);
			UIUtils.showToast(`Exported ${totalBooks} book${totalBooks !== 1 ? 's' : ''} from ${collections.length} collection${collections.length !== 1 ? 's' : ''}`);
		} catch (error) {
			UIUtils.showToast('Failed to export collections');
			console.error(error);
		}
	}
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => new BookScanApp());
} else {
	new BookScanApp();
}
