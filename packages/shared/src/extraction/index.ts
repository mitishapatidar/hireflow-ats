// Dynamic require to prevent bundling node extraction libraries in browser code
function getMammoth() {
  if (typeof window === 'undefined') {
    try {
      return require('mammoth');
    } catch {
      return null;
    }
  }
  return null;
}

import { OcrProvider, getOcrProvider } from './ocr';
export * from './ocr';

export interface ExtractedTextResult {
  rawText: string;
  pageCount: number;
  characterCount: number;
  format: 'PDF' | 'DOCX' | 'DOC' | 'UNKNOWN';
  ocrTriggered: boolean;
  extractionTimeMs: number;
}

export interface TextExtractorProvider {
  extractText(buffer: Buffer, fileName: string): Promise<ExtractedTextResult>;
}

/**
 * Extracts printable ASCII and UTF-16 text runs from binary Word DOC (OLE compound) documents
 * or raw streams without spawning unsafe external processes.
 */
export function extractDocBinaryText(buffer: Buffer): string {
  const chunks: string[] = [];
  let currentAscii: string[] = [];

  // 1. Scan for ASCII character sequences
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Printable ASCII or newline/tab
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      currentAscii.push(String.fromCharCode(byte));
    } else {
      if (currentAscii.length >= 3) {
        chunks.push(currentAscii.join(''));
      }
      currentAscii = [];
    }
  }
  if (currentAscii.length >= 3) {
    chunks.push(currentAscii.join(''));
  }

  // If ASCII chunks contain sufficient text, use them directly with newline preservation
  const asciiCombined = chunks.join('\n').trim();
  if (asciiCombined.length > 50) {
    return asciiCombined;
  }

  // 2. Scan for UTF-16LE character sequences (common in Word binary streams)
  const utf16Chunks: string[] = [];
  let currentUtf16: string[] = [];
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const code = buffer.readUInt16LE(i);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      currentUtf16.push(String.fromCharCode(code));
    } else {
      if (currentUtf16.length >= 3) {
        utf16Chunks.push(currentUtf16.join(''));
      }
      currentUtf16 = [];
    }
  }

  // Combine and remove OLE header metadata noise (like CompObj, SummaryInformation, WordDocument)
  const combined = [...chunks, ...utf16Chunks]
    .join('\n')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .trim();

  return combined;
}

export class DefaultTextExtractorProvider implements TextExtractorProvider {
  async extractText(buffer: Buffer, fileName: string): Promise<ExtractedTextResult> {
    const startTime = Date.now();
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    let rawText = '';
    let pageCount = 1;
    let format: ExtractedTextResult['format'] = 'UNKNOWN';
    let ocrTriggered = false;

    // A. PDF Extraction
    if (ext === 'pdf') {
      format = 'PDF';
      try {
        // Dynamic require to support varied module formats
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParseModule = require('pdf-parse');
        if (pdfParseModule.PDFParse) {
          try {
            if (typeof pdfParseModule.PDFParse.setWorker === 'function') {
              pdfParseModule.PDFParse.setWorker('');
            }
          } catch {
            // ignore worker fallback
          }
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          let res: any;
          try {
            const getTextPromise = parser.getText();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('PDF extraction timeout')), 2500)
            );
            res = await Promise.race([getTextPromise, timeoutPromise]);
          } finally {
            try {
              await parser.destroy();
            } catch {
              // ignore destroy errors
            }
          }
          rawText = typeof res === 'string' ? res : res?.text || '';
          pageCount = res?.total || res?.pages?.length || 1;
        } else if (typeof pdfParseModule === 'function') {
          const data = await pdfParseModule(buffer);
          rawText = data.text || '';
          pageCount = data.numpages || 1;
        } else if (pdfParseModule.default) {
          const data = await pdfParseModule.default(buffer);
          rawText = data.text || '';
          pageCount = data.numpages || 1;
        }

        // If parser returned empty or minimal text, try stream text extraction
        if (!rawText || rawText.trim().length < 20) {
          const streamText = extractDocBinaryText(buffer);
          if (streamText.trim().length > 20) {
            rawText = streamText;
          }
        }
      } catch (err: any) {
        if (err.message?.includes('password') || err.name === 'PasswordException') {
          throw new Error('This PDF is password-protected and cannot be parsed. Please upload an unprotected document.');
        }
        // Scanned or non-standard PDF: fallback to stream extraction; OCR pipeline below will run if text < 50 chars
        const fallbackText = extractDocBinaryText(buffer);
        rawText = fallbackText ? fallbackText.trim() : '';
      }
    }
    // B. DOCX Extraction
    else if (ext === 'docx') {
      format = 'DOCX';
      try {
        const mammothInstance = getMammoth();
        const result = mammothInstance ? await mammothInstance.extractRawText({ buffer }) : { value: '' };
        rawText = result.value || '';
        // Approximate pages from character length (avg 2000 chars per page)
        pageCount = Math.max(1, Math.ceil(rawText.length / 2000));
      } catch (err: any) {
        throw new Error(`Failed to extract text from DOCX: ${err.message || 'Corrupted archive'}`);
      }
    }
    // C. DOC Extraction (Word 97-2003 binary)
    else if (ext === 'doc') {
      format = 'DOC';
      try {
        rawText = extractDocBinaryText(buffer);
        pageCount = Math.max(1, Math.ceil(rawText.length / 2000));
      } catch (err: any) {
        throw new Error(`Failed to extract text from DOC: ${err.message || 'Corrupted binary'}`);
      }
    } else {
      throw new Error(`Unsupported file extension .${ext}`);
    }

    // Clean text whitespace
    rawText = rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

    // D. OCR Fallback Pipeline
    // If text extraction yielded fewer than 50 characters (e.g. scanned image PDF)
    if (rawText.length < 50) {
      const ocrProvider = getOcrProvider();
      try {
        const ocrResult = await ocrProvider.recognize(
          buffer,
          ext === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          { timeoutMs: 15000 }
        );
        if (ocrResult.text && ocrResult.text.trim().length > 20) {
          rawText = ocrResult.text.trim();
          ocrTriggered = true;
        } else {
          ocrTriggered = true;
          rawText = ocrResult.error
            ? `[Scanned Document: OCR processing failed (${ocrResult.error}). Please enter candidate details manually.]`
            : '[Scanned Document: Text could not be extracted directly from image layers. Please review or enter manually.]';
        }
      } catch (ocrErr: any) {
        ocrTriggered = true;
        rawText = `[Scanned Document: OCR processing error (${ocrErr.message || 'Timeout'}). Please enter details manually.]`;
      }
    }

    return {
      rawText,
      pageCount,
      characterCount: rawText.length,
      format,
      ocrTriggered,
      extractionTimeMs: Date.now() - startTime,
    };
  }
}

let activeTextExtractor: TextExtractorProvider | null = null;

export function getTextExtractor(): TextExtractorProvider {
  if (!activeTextExtractor) {
    activeTextExtractor = new DefaultTextExtractorProvider();
  }
  return activeTextExtractor;
}

export function setTextExtractor(extractor: TextExtractorProvider): void {
  activeTextExtractor = extractor;
}
