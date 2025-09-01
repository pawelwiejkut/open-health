import {
    BaseVisionParser,
    VisionModelOptions,
    VisionParseOptions,
    VisionParserModel
} from "@/lib/health-data/parser/vision/base-vision";
import fetch from 'node-fetch'
import {HealthCheckupType} from "@/lib/health-data/parser/schema";
import {ChatOllama} from "@langchain/ollama";
// import {ChatPromptTemplate} from "@langchain/core/prompts";
import {currentDeploymentEnv} from "@/lib/current-deployment-env";
import {getAdaptivePrompt} from "@/lib/health-data/parser/multilingual-prompts";

interface OllamaTags { models: { name: string; model: string }[] }

export class OllamaVisionParser extends BaseVisionParser {

    private _apiUrl: string = process.env.OLLAMA_API_URL || 'http://localhost:11434';

    get apiKeyRequired(): boolean {
        return false
    }

    get enabled(): boolean {
        return currentDeploymentEnv === 'local';
    }

    get apiUrlRequired(): boolean {
        return true;
    }

    get name(): string {
        return 'Ollama'
    }

    get apiUrl(): string {
        return this._apiUrl;
    }

    async models(options?: VisionModelOptions): Promise<VisionParserModel[]> {
        try {
            const apiUrl = options?.apiUrl || this._apiUrl
            const response = await fetch(`${apiUrl}/api/tags`)
            const {models} = await response.json() as OllamaTags
            
            // Return all available models - let user choose
            const supportedModels = models
            
            return supportedModels.map((m: { name: string, model: string }) => ({id: m.model, name: m.name}))
        } catch (e) {
            console.error(e)
            return []
        }
    }

    async parse(options: VisionParseOptions): Promise<HealthCheckupType> {
        const apiUrl = options.apiUrl || this._apiUrl
        console.log('Ollama parse options:', {
            modelId: options.model.id,
            modelName: options.model.name,
            apiUrl: apiUrl
        })
        const llm = new ChatOllama({
            model: options.model.id, 
            baseUrl: apiUrl,
            format: "json"
        });
        
        // Use adaptive multilingual prompts with language detection
        const textContent = options.input.context || '';
        const excludeImage = !options.input.image_data;
        const excludeText = !textContent;
        
        const adaptivePrompt = getAdaptivePrompt(textContent, {
            excludeImage,
            excludeText
        });
        
        console.log(`Detected language: ${adaptivePrompt.detectedLanguage} (confidence: ${adaptivePrompt.confidence})`);
        
        // Build user prompt with context substitution
        let userPrompt = adaptivePrompt.userPrompt;
        if (textContent && userPrompt.includes('{context}')) {
            userPrompt = userPrompt.replace('{context}', textContent);
        }
        
        // const fullPrompt = `${adaptivePrompt.systemPrompt}\n\nUser Input:\n${userPrompt}`;
        
        try {
            let result;
            if (options.input.image_data) {
                // For image input, use the image directly
                const messages = [
                    { role: "system", content: adaptivePrompt.systemPrompt },
                    { role: "user", content: [
                        { type: "text", text: userPrompt },
                        { type: "image_url", image_url: { url: options.input.image_data } }
                    ]}
                ];
                result = await llm.invoke(messages);
            } else {
                // For text-only input
                const messages = [
                    { role: "system", content: adaptivePrompt.systemPrompt },
                    { role: "user", content: userPrompt }
                ];
                result = await llm.invoke(messages);
            }
            
            const jsonContent = result.content.toString();
            console.log('Raw Ollama response:', jsonContent);
            
            const parsed = JSON.parse(jsonContent);
            console.log('Parsed JSON:', parsed);
            
            // For Ollama, preserve all test results regardless of schema validation
            // Create a relaxed validation that keeps the original test_result structure
            const relaxedHealthCheckup = {
                date: parsed.date || "",
                name: parsed.name || "",
                test_result: parsed.test_result || {}
            };
            
            console.log('Final result before return:', JSON.stringify(relaxedHealthCheckup, null, 2));
            return relaxedHealthCheckup as HealthCheckupType;
        } catch (error) {
            console.error('Error parsing Ollama response:', error);
            throw error;
        }
    }
}
