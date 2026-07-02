import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Service for handling barcode/QR code scanning
 */
export class ScannerService {
	private html5QrCode: Html5Qrcode | null = null;
	private isScanning: boolean = false;

	/**
	 * Initialize the scanner
	 */
	async startScanner(
		elementId: string,
		onSuccess: (decodedText: string) => void,
		onError?: (error: string) => void
	): Promise<void> {
		if (this.isScanning) {
			throw new Error('Scanner is already running');
		}

		try {
			this.html5QrCode = new Html5Qrcode(elementId, {
				formatsToSupport: [
					Html5QrcodeSupportedFormats.EAN_13,
					Html5QrcodeSupportedFormats.EAN_8,
					Html5QrcodeSupportedFormats.UPC_A,
					Html5QrcodeSupportedFormats.UPC_E,
					Html5QrcodeSupportedFormats.CODE_128
				],
				// The library's own maintainer has confirmed the native
				// BarcodeDetector path is unreliable for 1D barcodes on iOS —
				// forcing the pure-JS zxing decoder instead is the recommended
				// workaround there, and it works fine on Android too.
				useBarCodeDetectorIfSupported: false,
				verbose: false
			});

			const config = {
				// A higher scan rate gives the JS decoder more attempts per
				// second to catch a clean, non-blurry frame.
				fps: 25,
				// ISBN barcodes (EAN-13) are wide and short, not square — a wide
				// rectangular box makes them much easier to fit and scan than a
				// square one. Sized generously (most of the viewport) since a
				// bigger box gives the decoder a bigger, more forgiving target.
				qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
					const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
					const boxWidth = Math.floor(minEdge * 0.9);
					return { width: boxWidth, height: Math.floor(boxWidth * 0.45) };
				},
				// The decode canvas is always cropped down to the qrbox's CSS pixel
				// size regardless of camera resolution — but a higher native stream
				// gives that crop more real detail to work with before downscaling.
				// Many browsers default to a much lower resolution unless asked.
				videoConstraints: {
					facingMode: "environment",
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				}
			};

			// Try to use back camera (environment) for mobile devices
			await this.html5QrCode.start(
				{ facingMode: "environment" },
				config,
				(decodedText, decodedResult) => {
					// Filter for ISBN/EAN-13 only (13 digits)
					if (this.isValidISBN(decodedText)) {
						onSuccess(decodedText);
					}
				},
				(errorMessage) => {
					// Ignore scanning errors (happens constantly while scanning)
					// Only log if callback is provided
					if (onError && !errorMessage.includes('NotFoundException')) {
						console.warn('Scan error:', errorMessage);
					}
				}
			);

			this.isScanning = true;
		} catch (error) {
			console.error('Error starting scanner:', error);
			throw new Error('Failed to start camera. Please grant camera permissions.');
		}
	}

	/**
	 * Stop the scanner
	 */
	async stopScanner(): Promise<void> {
		if (!this.html5QrCode || !this.isScanning) {
			return;
		}

		try {
			await this.html5QrCode.stop();
			this.html5QrCode.clear();
			this.isScanning = false;
		} catch (error) {
			console.error('Error stopping scanner:', error);
		}
	}

	/**
	 * Check if scanner is currently running
	 */
	isRunning(): boolean {
		return this.isScanning;
	}

	/**
	 * Validate if the scanned code is a valid ISBN/EAN-13
	 */
	private isValidISBN(code: string): boolean {
		// Remove any hyphens or spaces
		const cleanCode = code.replace(/[-\s]/g, '');

		// Check if it's 13 digits (EAN-13/ISBN-13) or 10 digits (ISBN-10)
		return /^\d{13}$/.test(cleanCode) || /^\d{9}[0-9X]$/i.test(cleanCode);
	}
}
