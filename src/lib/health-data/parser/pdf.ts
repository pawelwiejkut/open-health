/* eslint-disable */

import {ChatPromptTemplate} from "@langchain/core/prompts";
import {HealthCheckupSchema, HealthCheckupType} from "@/lib/health-data/parser/schema";
import {fileTypeFromBuffer} from 'file-type';
import {getFileMd5, processBatchWithConcurrency} from "@/lib/health-data/parser/util";
import {getParsePrompt, MessagePayload} from "@/lib/health-data/parser/prompt";
import visions from "@/lib/health-data/parser/vision";
import documents from "@/lib/health-data/parser/document";
import {put} from "@vercel/blob";
import {currentDeploymentEnv} from "@/lib/current-deployment-env";
import fs from "node:fs";
import {fromBuffer as pdf2picFromBuffer} from 'pdf2pic'
import {tasks} from "@trigger.dev/sdk/v3";
import type {pdfToImages} from "@/trigger/pdf-to-image";

interface VisionParserOptions {
    parser: string;
    model: string;
    apiKey: string;
    apiUrl?: string
}

interface DocumentParserOptions {
    parser: string;
    model: string;
    apiKey: string;
}

interface SourceParseOptions {
    file: string;
    visionParser?: VisionParserOptions
    documentParser?: DocumentParserOptions
}

interface InferenceOptions {
    imagePaths: string[],
    excludeImage: boolean,
    excludeText: boolean,
    visionParser: VisionParserOptions
    documentParser?: DocumentParserOptions
}

async function documentOCR({document, documentParser}: { document: string, documentParser: DocumentParserOptions }) {

    // Get the document parser
    const parser = documents.find(e => e.name === documentParser.parser)
    if (!parser) throw new Error('Invalid document parser')

    // Get the ocr result
    const models = await parser.models()
    const model = models.find(e => e.id === documentParser.model)
    if (!model) throw new Error('Invalid document parser model')

    // Get the ocr result
    const {ocr} = await parser.ocr({input: document, model: model, apiKey: documentParser.apiKey})

    return ocr
}

async function documentParse({document, documentParser}: {
    document: string,
    documentParser: DocumentParserOptions
}): Promise<any> {

    // Get the document parser
    const parser = documents.find(e => e.name === documentParser.parser)
    if (!parser) throw new Error('Invalid document parser')

    // Get the ocr result
    const models = await parser.models()
    const model = models.find(e => e.id === documentParser.model)
    if (!model) throw new Error('Invalid document parser model')

    // Get the parse result
    const {document: result} = await parser.parse({input: document, model: model, apiKey: documentParser.apiKey})

    return result
}

async function inference(inferenceOptions: InferenceOptions) {
    const {
        imagePaths,
        excludeImage,
        excludeText,
        visionParser: visionParserOptions,
        documentParser: documentParserOptions
    } = inferenceOptions

    if (!excludeText && !documentParserOptions) {
        throw new Error('Document parser is required when text extraction is enabled');
    }

    // Extract text data if not excluding text
    let pageDataList: { page_content: string }[] | undefined = undefined
    if (!excludeText) {
        // documentParserOptions is guaranteed by guard above
        pageDataList = await processBatchWithConcurrency(
            imagePaths,
            async (path) => {
                const {content} = await documentParse({document: path, documentParser: documentParserOptions as DocumentParserOptions})
                const {markdown} = content
                return {page_content: markdown}
            },
            2
        )
    }

    // Extract image data if not excluding images
    const imageDataList: string[] = !excludeImage ? await processBatchWithConcurrency(
        imagePaths,
        async (path) => {
            const fileResponse = await fetch(path)
            const buffer = Buffer.from(await fileResponse.arrayBuffer())
            return `data:image/png;base64,${buffer.toString('base64')}`
        },
        4
    ) : []

    // Batch Inputs
    const numPages = pageDataList ? pageDataList.length : imageDataList.length
    const batchInputs: MessagePayload[] = new Array(numPages).fill(0).map((_, i) => ({
        ...(!excludeText && pageDataList ? {context: pageDataList[i].page_content} : {}),
        ...(!excludeImage && imageDataList ? {image_data: imageDataList[i]} : {})
    }))

    // Generate Messages with multilingual support
    const textContent = pageDataList && pageDataList.length > 0 ? 
        pageDataList.map(page => page.page_content).join('\n') : '';
    
    const messages = ChatPromptTemplate.fromMessages(getParsePrompt({excludeImage, excludeText}));

    // Select Vision Parser
    const visionParser = visions.find(e => e.name === visionParserOptions.parser)
    if (!visionParser) throw new Error('Invalid vision parser')

    // Get models
    const visionParserModels = await visionParser.models({
        apiUrl: visionParserOptions.apiUrl,
    })
    const visionParserModel = visionParserModels.find(e => e.id === visionParserOptions.model)
    if (!visionParserModel) throw new Error('Invalid vision parser model')

    // Process the batch inputs
    const batchData = await processBatchWithConcurrency(
        batchInputs,
        async (input) => visionParser.parse({
            model: visionParserModel,
            messages: messages,
            input: input,
            apiKey: visionParserOptions.apiKey,
            apiUrl: visionParserOptions.apiUrl,
        }),
        4
    )

    console.log('BatchData from vision parser:', JSON.stringify(batchData, null, 2))

    // Merge the results
    const data: { [key: string]: any } = batchData.reduce((acc, curr, i) => {
        console.log(`Adding page_${i}:`, JSON.stringify(curr, null, 2))
        acc[`page_${i}`] = curr;
        return acc;
    }, {} as { [key: string]: any });

    // Merge Results - collect ALL keys from actual data, not just schema keys
    const mergeInfo: { [key: string]: { pages: number[], values: any[] } } = {}
    const allKeys = new Set<string>()
    
    // First collect all keys that actually exist in the data
    for (let i = 0; i < numPages; i++) {
        const healthCheckup = data[`page_${i}`]
        console.log(`Page ${i} healthCheckup:`, JSON.stringify(healthCheckup, null, 2))
        const healthCheckupTestResult = healthCheckup?.test_result
        
        if (healthCheckupTestResult && typeof healthCheckupTestResult === 'object') {
            Object.keys(healthCheckupTestResult).forEach(key => allKeys.add(key))
        }
    }
    
    console.log('All keys found in data:', Array.from(allKeys))

    // Then process each key that was found
    for (const key of allKeys) {
        const testFields = [];
        const testPages: number[] = [];
        for (let i = 0; i < numPages; i++) {
            const healthCheckup = data[`page_${i}`]
            const healthCheckupTestResult = healthCheckup?.test_result

            if (healthCheckupTestResult?.hasOwnProperty?.(key) && healthCheckupTestResult[key]) {
                testFields.push(healthCheckupTestResult[key])
                testPages.push(i)
            }
        }

        if (testFields.length > 0) {
            mergeInfo[key] = {'pages': testPages, 'values': testFields}
        }
    }

    const mergedTestResult: { [key: string]: any } = {}
    const mergedTestResultPage: { [key: string]: { page: number } } = {}

    console.log('MergeInfo keys:', Object.keys(mergeInfo));
    console.log('MergeInfo content:', JSON.stringify(mergeInfo, null, 2));
    
    // Merge the results
    for (const mergeInfoKey in mergeInfo) {
        const mergeTarget = mergeInfo[mergeInfoKey]
        mergedTestResult[mergeInfoKey] = mergeTarget.values[0]
        mergedTestResultPage[mergeInfoKey] = {
            page: mergeTarget.pages[0] + 1
        }
        console.log(`Added to merged result: ${mergeInfoKey} = ${JSON.stringify(mergeTarget.values[0])}`);
    }
    
    console.log('Final mergedTestResult:', JSON.stringify(mergedTestResult, null, 2));

    let mergeData: any = {}

    // Merge name and date
    for (let i = 0; i < numPages; i++) {
        const healthCheckup = data[`page_${i}`]
        mergeData = {
            ...mergeData,
            ...healthCheckup,
        }
    }

    // Update test_result with merged data
    mergeData['test_result'] = mergedTestResult

    // Create final HealthCheckup object
    const finalHealthCheckup = HealthCheckupSchema.parse(mergeData)

    return {
        finalHealthCheckup: finalHealthCheckup,
        mergedTestResultPage: mergedTestResultPage,
    }
}

/**
 * Convert a document to images
 * - pdf: convert to images
 * - image: nothing
 *
 * @param file
 *
 * @returns {Promise<string[]>} - List of image paths
 */
async function documentToImages({file: filePath}: Pick<SourceParseOptions, 'file'>): Promise<string[]> {
    let fileBuffer: Buffer;
    
    // Check if it's a local file path or URL
    if (filePath.startsWith('./') || filePath.startsWith('/') || (!filePath.startsWith('http'))) {
        // Local file path - use fs.readFileSync
        fileBuffer = fs.readFileSync(filePath)
    } else {
        // URL - use fetch
        const fileResponse = await fetch(filePath);
        fileBuffer = Buffer.from(await fileResponse.arrayBuffer())
    }
    const result = await fileTypeFromBuffer(fileBuffer)
    const fileHash = await getFileMd5(fileBuffer)
    if (!result) throw new Error('Invalid file type')
    const mime = result.mime

    // Convert pdf to images, or use the image as is
    const images: string[] = []
    if (mime === 'application/pdf') {
        if (currentDeploymentEnv === 'local') {
            const pdf2picConverter = pdf2picFromBuffer(fileBuffer, {preserveAspectRatio: true})
            for (const image of await pdf2picConverter.bulk(-1, {responseType: 'base64'})) {
                if (image.base64) images.push(`data:image/png;base64,${image.base64}`)
            }
        } else {
            const result = await tasks.triggerAndPoll<typeof pdfToImages>(
                'pdf-to-image',
                {pdfUrl: filePath},
                {pollIntervalMs: 5000},
            )
            if (result.status === 'COMPLETED' && result.output) {
                images.push(...result.output.images.map((image) => `data:image/png;base64,${image}`))
            } else {
                throw new Error('Failed to convert the pdf to images')
            }
        }
    } else {
        images.push(`data:${mime};base64,${fileBuffer.toString('base64')}`)
    }

    // Write the image data to a file
    const imagePaths = []
    for (let i = 0; i < images.length; i++) {
        if (currentDeploymentEnv === 'local') {
            fs.writeFileSync(`./public/uploads/${fileHash}_${i}.png`, Buffer.from(images[i].split(',')[1], 'base64'))
            imagePaths.push(`${process.env.NEXT_PUBLIC_URL}/api/static/uploads/${fileHash}_${i}.png`)
        } else {
            const blob = await put(
                `/uploads/${fileHash}_${i}.png`,
                Buffer.from(images[i].split(',')[1], 'base64'),
                {access: 'public', contentType: 'image/png'}
            )
            imagePaths.push(blob.downloadUrl)
        }
    }

    return imagePaths
}

/**
 * Parse the health data
 *
 * @param options
 */
export async function parseHealthData(options: SourceParseOptions) {
    const {file: filePath} = options

    // VisionParser
    const visionParser = options.visionParser || {
        parser: 'Ollama',
        model: 'qwen3:8b',
        apiKey: '',
        apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434'
    }

    // Document Parser (optional)
    // In local/dev environments Docling may not be running outside Docker.
    // If not explicitly provided, treat document parsing as optional and
    // fall back to vision-only inference.
    const documentParser = options.documentParser
        ? options.documentParser
        : undefined

    // prepare images
    const imagePaths = await documentToImages({file: filePath})

    // If no documentParser available, do a vision-only fallback to avoid
    // hard dependency on Docling in local/dev.
    if (!documentParser) {
        const {finalHealthCheckup, mergedTestResultPage} = await inference({
            imagePaths,
            excludeImage: false,
            excludeText: true,
            visionParser
        })

        const healthCheckup = {
            date: finalHealthCheckup.date || "",
            name: finalHealthCheckup.name || "",
            test_result: finalHealthCheckup.test_result || {}
        } as HealthCheckupType

        console.log('FINAL RETURN DATA (vision-only):', JSON.stringify({data: [healthCheckup], pages: [mergedTestResultPage]}, null, 2));
        return {data: [healthCheckup], pages: [mergedTestResultPage], ocrResults: []}
    }

    try {
        // prepare ocr results
        const ocrResults = await documentOCR({
            document: filePath,
            documentParser: documentParser
        })

        // prepare parse results
        await processBatchWithConcurrency(
            imagePaths,
            async (path) => documentParse({document: path, documentParser: documentParser}),
            3
        )

        // Merge the results
        const baseInferenceOptions = {imagePaths, visionParser, documentParser}
        const [
            {finalHealthCheckup: resultTotal, mergedTestResultPage: resultTotalPages},
            {finalHealthCheckup: resultText, mergedTestResultPage: resultTextPages},
            {finalHealthCheckup: resultImage, mergedTestResultPage: resultImagePages}
        ] = await Promise.all([
            inference({...baseInferenceOptions, excludeImage: false, excludeText: false}),
            inference({...baseInferenceOptions, excludeImage: false, excludeText: true}),
            inference({...baseInferenceOptions, excludeImage: true, excludeText: false}),
        ]);

    const resultDictTotal = resultTotal.test_result
    const resultDictText = resultText.test_result
    const resultDictImage = resultImage.test_result

    const mergedTestResult: { [key: string]: any } = {}
    const mergedPageResult: { [key: string]: { page: number } | null } = {}

    // Get all keys that actually exist in any of the result dictionaries
    const allResultKeys = new Set([
        ...Object.keys(resultDictTotal || {}),
        ...Object.keys(resultDictText || {}),
        ...Object.keys(resultDictImage || {})
    ]);
    
    for (const key of Array.from(allResultKeys)) {
        const valueTotal =
            resultDictTotal.hasOwnProperty(key) &&
            resultDictTotal[key] !== null &&
            resultDictTotal[key]!.value !== null
                ? resultDictTotal[key]
                : null;
        const pageTotal = valueTotal !== null ? resultTotalPages[key] : null;

        const valueText =
            resultDictText.hasOwnProperty(key) &&
            resultDictText[key] !== null &&
            resultDictText[key]!.value !== null
                ? resultDictText[key]
                : null;
        const pageText = valueText !== null ? resultTextPages[key] : null;

        const valueImage =
            resultDictImage.hasOwnProperty(key) &&
            resultDictImage[key] !== null &&
            resultDictImage[key]!.value !== null
                ? resultDictImage[key]
                : null;
        const pageImage = valueImage !== null ? resultImagePages[key] : null;

        if (valueTotal === null) {
            if (valueText !== null) {
                mergedTestResult[key] = valueText;
                mergedPageResult[key] = pageText;
            } else if (valueImage !== null) {
                mergedTestResult[key] = valueImage;
                mergedPageResult[key] = pageImage;
            } else {
                mergedTestResult[key] = valueText;
                mergedPageResult[key] = pageText;
            }
        } else {
            mergedTestResult[key] = valueTotal;
            mergedPageResult[key] = pageTotal;
        }
    }

    // remove all null values in mergedTestResult
    for (const key in mergedTestResult) {
        if (mergedTestResult[key] === null) {
            delete mergedTestResult[key]
        }
    }

    // Create the final health checkup object without strict schema validation
    // to preserve Polish test result names that don't match the English schema
    const healthCheckup = {
        date: resultTotal.date || "",
        name: resultTotal.name || "",
        test_result: mergedTestResult
    } as HealthCheckupType

        console.log('FINAL RETURN DATA:', JSON.stringify({data: [healthCheckup], pages: [mergedPageResult]}, null, 2));
        return {data: [healthCheckup], pages: [mergedPageResult], ocrResults: [ocrResults]}
    } catch (error) {
        console.warn('Document parser unavailable or failed, falling back to vision-only:', error)
        const {finalHealthCheckup, mergedTestResultPage} = await inference({
            imagePaths,
            excludeImage: false,
            excludeText: true,
            visionParser
        })
        const healthCheckup = {
            date: finalHealthCheckup.date || "",
            name: finalHealthCheckup.name || "",
            test_result: finalHealthCheckup.test_result || {}
        } as HealthCheckupType
        console.log('FINAL RETURN DATA (fallback vision-only):', JSON.stringify({data: [healthCheckup], pages: [mergedTestResultPage]}, null, 2));
        return {data: [healthCheckup], pages: [mergedTestResultPage], ocrResults: []}
    }
}
