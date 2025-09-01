import {
    BaseDocumentParser,
    DocumentModelOptions,
    DocumentOCROptions,
    DocumentParseOptions,
    DocumentParseResult,
    DocumentParserModel,
    OCRParseResult
} from "@/lib/health-data/parser/document/base-document";
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'node:fs'
import {currentDeploymentEnv} from "@/lib/current-deployment-env";
import {detectLanguageFromFilename, getMultiLanguageOcrCodes} from "@/lib/health-data/parser/language-detection";

interface DoclingJsonResponse {
    document: { json_content: unknown }
}

interface DoclingMdResponse {
    document: { md_content: string }
}

export class DoclingDocumentParser extends BaseDocumentParser {
    get apiKeyRequired(): boolean {
        return false;
    }

    get enabled(): boolean {
        return currentDeploymentEnv === 'local';
    }

    get name(): string {
        return "Docling";
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async models(options?: DocumentModelOptions): Promise<DocumentParserModel[]> {
        return [
            {id: 'document-parse', name: 'Document Parse'}
        ];
    }

    async ocr(options: DocumentOCROptions): Promise<OCRParseResult> {
        // Auto-detect language from filename first
        const filenameLanguage = detectLanguageFromFilename(options.input);
        
        const formData = new FormData();
        formData.append('ocr_engine', 'tesseract');
        formData.append('pdf_backend', 'dlparse_v2');
        formData.append('from_formats', 'pdf');
        formData.append('from_formats', 'docx');
        formData.append('from_formats', 'image');
        formData.append('force_ocr', 'false');
        formData.append('image_export_mode', 'placeholder');
        
        // Add language codes for OCR
        if (filenameLanguage) {
            const ocrCodes = getMultiLanguageOcrCodes([filenameLanguage]);
            for (const code of ocrCodes) {
                formData.append('ocr_lang', code);
            }
            console.log(`OCR languages from filename: ${ocrCodes.join(', ')}`);
        } else {
            // Default to multi-language OCR (English, Polish, and common European languages)
            const defaultLanguages = ['eng', 'pol', 'deu', 'fra', 'spa', 'ita', 'rus'];
            for (const code of defaultLanguages) {
                formData.append('ocr_lang', code);
            }
            console.log(`OCR languages (default multi-language): ${defaultLanguages.join(', ')}`);
        }
        
        formData.append('table_mode', 'fast');
        
        // Handle both local file paths and URLs
        if (options.input.startsWith('http')) {
            // For URLs, fetch the file first
            const response = await fetch(options.input);
            const buffer = Buffer.from(await response.arrayBuffer());
            formData.append('files', buffer, 'uploaded_file');
        } else {
            // For local paths, use createReadStream
            formData.append('files', fs.createReadStream(options.input));
        }
        
        formData.append('abort_on_error', 'false');
        formData.append('to_formats', 'json');
        formData.append('return_as_file', 'false');
        formData.append('do_ocr', 'true');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
        let response;
        try {
            response = await fetch(`${process.env.DOCLING_API_URL || 'http://localhost:5001'}/v1alpha/convert/file`, {
                method: 'POST',
                headers: {'accept': 'application/json'},
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
        const data = await response.json() as DoclingJsonResponse
        const {document} = data
        const {json_content} = document

        const convertedJsonContent = this.convertJsonContent(json_content)

        return {ocr: convertedJsonContent};
    }

    async parse(options: DocumentParseOptions): Promise<DocumentParseResult> {
        // Auto-detect language from filename first
        const filenameLanguage = detectLanguageFromFilename(options.input);
        
        const formData = new FormData();
        formData.append('ocr_engine', 'tesseract');
        formData.append('pdf_backend', 'dlparse_v2');
        formData.append('from_formats', 'pdf');
        formData.append('from_formats', 'docx');
        formData.append('from_formats', 'image');
        formData.append('force_ocr', 'true');
        formData.append('image_export_mode', 'placeholder');
        
        // Add language codes for OCR
        if (filenameLanguage) {
            const ocrCodes = getMultiLanguageOcrCodes([filenameLanguage]);
            for (const code of ocrCodes) {
                formData.append('ocr_lang', code);
            }
            console.log(`Parse OCR languages from filename: ${ocrCodes.join(', ')}`);
        } else {
            // Default to multi-language OCR
            const defaultLanguages = ['eng', 'pol', 'deu', 'fra', 'spa', 'ita', 'rus'];
            for (const code of defaultLanguages) {
                formData.append('ocr_lang', code);
            }
            console.log(`Parse OCR languages (default multi-language): ${defaultLanguages.join(', ')}`);
        }
        
        formData.append('table_mode', 'fast');
        
        // Handle both local file paths and URLs
        if (options.input.startsWith('http')) {
            // For URLs, fetch the file first
            const response = await fetch(options.input);
            const buffer = Buffer.from(await response.arrayBuffer());
            formData.append('files', buffer, 'uploaded_file');
        } else {
            // For local paths, use createReadStream
            formData.append('files', fs.createReadStream(options.input));
        }
        
        formData.append('abort_on_error', 'false');
        formData.append('to_formats', 'md');
        formData.append('return_as_file', 'false');
        formData.append('do_ocr', 'true');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
        let response;
        try {
            response = await fetch(`${process.env.DOCLING_API_URL || 'http://localhost:5001'}/v1alpha/convert/file`, {
                method: 'POST',
                headers: {'accept': 'application/json'},
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
        const {document} = await response.json() as DoclingMdResponse
        const {md_content} = document
        return {document: {content: {markdown: md_content}}};
    }

    private convertCoordinates(bbox: { l: number; t: number; r: number; b: number }, pageHeight: number) {
        if (!bbox) return null;

        return {
            vertices: [
                {
                    x: Math.round(bbox.l),
                    y: Math.round(pageHeight - bbox.t)
                },
                {
                    x: Math.round(bbox.r),
                    y: Math.round(pageHeight - bbox.t)
                },
                {
                    x: Math.round(bbox.r),
                    y: Math.round(pageHeight - bbox.b)
                },
                {
                    x: Math.round(bbox.l),
                    y: Math.round(pageHeight - bbox.b)
                }
            ]
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private convertJsonContent(data: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = {
            metadata: {pages: []},
            pages: [],
            stored: false
        };

        // Process each page
        for (const [pageNum, value] of Object.entries(data.pages)) {
            const pageInfo = value as { size: { width: number, height: number } }
            const pageHeight = pageInfo.size.height;
            const pageWidth = pageInfo.size.width;

            // Add page metadata
            result.metadata.pages.push({
                height: pageHeight,
                page: parseInt(pageNum),
                width: pageWidth
            });

            // Initialize page object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageObject: any = {
                height: pageHeight,
                id: parseInt(pageNum) - 1,
                text: "",
                width: pageWidth,
                words: []
            };

            // Process text elements and create full text content
            let wordId = 0;
            let fullText = "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.texts.forEach((text: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                text.prov.forEach((prov: any) => {
                    if (prov.page_no.toString() === pageNum) {
                        pageObject.words.push({
                            boundingBox: this.convertCoordinates(prov.bbox, pageHeight),
                            confidence: 0.98,
                            id: wordId++,
                            text: text.text
                        });
                        fullText += text.text + " ";
                    }
                });
            });

            // Set full text content
            pageObject.text = fullText.trim();
            result.pages.push(pageObject);

            // Set overall document text
            result.text = fullText.trim();
        }

        return result;
    }
}
