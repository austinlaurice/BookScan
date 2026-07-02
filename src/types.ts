/**
 * Book interface representing a single book in a collection
 */
export interface Book {
	id: string;
	isbn?: string;
	title: string;
	authors?: string[];
	publisher?: string;
	publishedDate?: string;
	description?: string;
	thumbnail?: string;
	addedDate: string;
}

/**
 * Collection interface representing a collection of books
 */
export interface Collection {
	id: string;
	name: string;
	books: Book[];
	createdDate: string;
	modifiedDate: string;
}
