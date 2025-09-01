/**
 * Multilingual prompts for medical data parsing
 * Supports any language with adaptive parsing instructions
 */

import { detectLanguageFromText } from "./language-detection";

export interface MultilingualPromptOptions {
    excludeImage?: boolean;
    excludeText?: boolean;
    detectedLanguage?: string;
    confidence?: number;
}

/**
 * Language-specific parsing instructions
 */
const LANGUAGE_PROMPTS = {
    'en': {
        systemPrompt: `You are a medical data analyst. Extract test results from medical documents and return them as JSON.`,
        jsonInstructions: `The JSON must follow this exact structure:
{
  "name": "patient name or empty string",
  "date": "date in any format or empty string", 
  "test_result": {
    "test_name_1": {"value": "result_value", "unit": "unit", "reference": "reference_range", "category": "test_category"},
    "test_name_2": {"value": "result_value", "unit": "unit", "reference": "reference_range", "category": "test_category"}
  }
}`,
        instructions: `Instructions:
- Extract ALL medical test results, regardless of test name format
- Keep original test names in their native language
- Include value, unit, reference range, and test category when available
- For dates, preserve the original format
- Only include actual test results, not reference information
- Return valid JSON only, no other text`,
        contextPrefix: `Medical document content:`,
        imagePrefix: `Please analyze the provided medical document image.`
    },
    
    'pl': {
        systemPrompt: `Jesteś analitykiem danych medycznych. Wyciągnij wyniki badań z dokumentów medycznych i zwróć je jako JSON.`,
        jsonInstructions: `JSON musi mieć dokładnie tę strukturę:
{
  "name": "imię i nazwisko pacjenta lub pusty ciąg",
  "date": "data w dowolnym formacie lub pusty ciąg",
  "test_result": {
    "nazwa_badania_1": {"value": "wynik", "unit": "jednostka", "reference": "zakres_referencyjny", "category": "kategoria_badania"},
    "nazwa_badania_2": {"value": "wynik", "unit": "jednostka", "reference": "zakres_referencyjny", "category": "kategoria_badania"}
  }
}`,
        instructions: `Instrukcje:
- Wyciągnij WSZYSTKIE wyniki badań medycznych, niezależnie od formatu nazw
- Zachowaj oryginalne nazwy badań w ich rodzimym języku
- Dołącz wartość, jednostkę, zakres referencyjny i kategorię badania gdy dostępne
- Dla dat, zachowaj oryginalny format
- Dołącz tylko rzeczywiste wyniki badań, nie informacje referencyjne
- Zwróć tylko prawidłowy JSON, bez dodatkowego tekstu`,
        contextPrefix: `Zawartość dokumentu medycznego:`,
        imagePrefix: `Proszę przeanalizować dostarczony obraz dokumentu medycznego.`
    },
    
    'de': {
        systemPrompt: `Sie sind ein medizinischer Datenanalyst. Extrahieren Sie Testergebnisse aus medizinischen Dokumenten und geben Sie sie als JSON zurück.`,
        jsonInstructions: `Das JSON muss genau diese Struktur haben:
{
  "name": "Patientenname oder leerer String",
  "date": "Datum in beliebigem Format oder leerer String",
  "test_result": {
    "test_name_1": {"value": "ergebnis_wert", "unit": "einheit", "reference": "referenz_bereich", "category": "test_kategorie"},
    "test_name_2": {"value": "ergebnis_wert", "unit": "einheit", "reference": "referenz_bereich", "category": "test_kategorie"}
  }
}`,
        instructions: `Anweisungen:
- Extrahieren Sie ALLE medizinischen Testergebnisse, unabhängig vom Format der Testnamen
- Behalten Sie die ursprünglichen Testnamen in ihrer Muttersprache bei
- Fügen Sie Wert, Einheit, Referenzbereich und Testkategorie hinzu, wenn verfügbar
- Behalten Sie bei Datumsangaben das ursprüngliche Format bei
- Fügen Sie nur tatsächliche Testergebnisse ein, keine Referenzinformationen
- Geben Sie nur gültiges JSON zurück, keinen anderen Text`,
        contextPrefix: `Inhalt des medizinischen Dokuments:`,
        imagePrefix: `Bitte analysieren Sie das bereitgestellte Bild des medizinischen Dokuments.`
    },
    
    'fr': {
        systemPrompt: `Vous êtes un analyste de données médicales. Extrayez les résultats de tests des documents médicaux et renvoyez-les au format JSON.`,
        jsonInstructions: `Le JSON doit avoir exactement cette structure:
{
  "name": "nom du patient ou chaîne vide",
  "date": "date dans n'importe quel format ou chaîne vide",
  "test_result": {
    "nom_test_1": {"value": "valeur_résultat", "unit": "unité", "reference": "plage_référence", "category": "catégorie_test"},
    "nom_test_2": {"value": "valeur_résultat", "unit": "unité", "reference": "plage_référence", "category": "catégorie_test"}
  }
}`,
        instructions: `Instructions:
- Extrayez TOUS les résultats de tests médicaux, quel que soit le format des noms de tests
- Conservez les noms de tests originaux dans leur langue native
- Incluez la valeur, l'unité, la plage de référence et la catégorie de test quand disponible
- Pour les dates, conservez le format original
- N'incluez que les résultats de tests réels, pas les informations de référence
- Renvoyez uniquement du JSON valide, aucun autre texte`,
        contextPrefix: `Contenu du document médical:`,
        imagePrefix: `Veuillez analyser l'image du document médical fournie.`
    },
    
    'es': {
        systemPrompt: `Eres un analista de datos médicos. Extrae los resultados de pruebas de documentos médicos y devuélvelos como JSON.`,
        jsonInstructions: `El JSON debe tener exactamente esta estructura:
{
  "name": "nombre del paciente o cadena vacía",
  "date": "fecha en cualquier formato o cadena vacía",
  "test_result": {
    "nombre_prueba_1": {"value": "valor_resultado", "unit": "unidad", "reference": "rango_referencia", "category": "categoría_prueba"},
    "nombre_prueba_2": {"value": "valor_resultado", "unit": "unidad", "reference": "rango_referencia", "category": "categoría_prueba"}
  }
}`,
        instructions: `Instrucciones:
- Extrae TODOS los resultados de pruebas médicas, sin importar el formato de los nombres
- Mantén los nombres originales de las pruebas en su idioma nativo
- Incluye valor, unidad, rango de referencia y categoría de prueba cuando esté disponible
- Para fechas, conserva el formato original
- Solo incluye resultados de pruebas reales, no información de referencia
- Devuelve solo JSON válido, ningún otro texto`,
        contextPrefix: `Contenido del documento médico:`,
        imagePrefix: `Por favor analiza la imagen del documento médico proporcionada.`
    },
    
    'ko': {
        systemPrompt: `당신은 의료 데이터 분석가입니다. 의료 문서에서 검사 결과를 추출하여 JSON으로 반환하세요.`,
        jsonInstructions: `JSON은 정확히 다음 구조를 가져야 합니다:
{
  "name": "환자 이름 또는 빈 문자열",
  "date": "임의 형식의 날짜 또는 빈 문자열",
  "test_result": {
    "검사명_1": {"value": "결과값", "unit": "단위", "reference": "참고범위", "category": "검사분류"},
    "검사명_2": {"value": "결과값", "unit": "단위", "reference": "참고범위", "category": "검사분류"}
  }
}`,
        instructions: `지침:
- 검사명 형식에 관계없이 모든 의료 검사 결과를 추출하세요
- 검사명은 원본 언어 그대로 유지하세요
- 가능할 때 값, 단위, 참고범위, 검사분류를 포함하세요
- 날짜는 원본 형식을 유지하세요
- 실제 검사 결과만 포함하고 참고 정보는 제외하세요
- 다른 텍스트 없이 유효한 JSON만 반환하세요`,
        contextPrefix: `의료 문서 내용:`,
        imagePrefix: `제공된 의료 문서 이미지를 분석해주세요.`
    },
    
    'ru': {
        systemPrompt: `Вы аналитик медицинских данных. Извлеките результаты анализов из медицинских документов и верните их в формате JSON.`,
        jsonInstructions: `JSON должен иметь точно такую структуру:
{
  "name": "имя пациента или пустая строка",
  "date": "дата в любом формате или пустая строка",
  "test_result": {
    "название_теста_1": {"value": "значение_результата", "unit": "единица", "reference": "референсный_диапазон", "category": "категория_теста"},
    "название_теста_2": {"value": "значение_результата", "unit": "единица", "reference": "референсный_диапазон", "category": "категория_теста"}
  }
}`,
        instructions: `Инструкции:
- Извлеките ВСЕ результаты медицинских анализов, независимо от формата названий
- Сохраняйте оригинальные названия анализов на их родном языке
- Включайте значение, единицу измерения, референсный диапазон и категорию теста когда доступно
- Для дат сохраняйте оригинальный формат
- Включайте только фактические результаты анализов, не справочную информацию
- Возвращайте только валидный JSON, никакого другого текста`,
        contextPrefix: `Содержимое медицинского документа:`,
        imagePrefix: `Пожалуйста, проанализируйте предоставленное изображение медицинского документа.`
    }
};

/**
 * Generate multilingual parsing prompt based on detected language
 */
export function getMultilingualPrompt(options: MultilingualPromptOptions = {}): {
    systemPrompt: string;
    userPrompt: string;
    detectedLanguage: string;
    confidence: number;
} {
    const { excludeImage = false, excludeText = false, detectedLanguage = 'en', confidence = 1.0 } = options;
    
    // Get language-specific prompts
    const prompts = LANGUAGE_PROMPTS[detectedLanguage as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS['en'];
    
    // Build system prompt
    const systemPrompt = prompts.systemPrompt + '\n\n' + prompts.jsonInstructions + '\n\n' + prompts.instructions;
    
    // Build user prompt based on input types
    let userPrompt = '';
    
    if (!excludeText && !excludeImage) {
        userPrompt = `${prompts.contextPrefix}\n{context}\n\n${prompts.imagePrefix}`;
    } else if (!excludeText && excludeImage) {
        userPrompt = `${prompts.contextPrefix}\n{context}`;
    } else if (excludeText && !excludeImage) {
        userPrompt = prompts.imagePrefix;
    } else {
        // Both excluded - shouldn't happen, but fallback
        userPrompt = `${prompts.contextPrefix}\n{context}`;
    }
    
    return {
        systemPrompt,
        userPrompt,
        detectedLanguage,
        confidence
    };
}

/**
 * Generate adaptive prompt based on text content analysis
 */
export function getAdaptivePrompt(textContent: string, options: MultilingualPromptOptions = {}): {
    systemPrompt: string;
    userPrompt: string;
    detectedLanguage: string;
    confidence: number;
} {
    // Detect language from content
    const languageDetection = detectLanguageFromText(textContent);
    
    console.log(`Language detection: ${languageDetection.primaryLanguage} (confidence: ${languageDetection.confidence})`);
    console.log(`Reference keywords: ${languageDetection.referenceKeywords.join(', ')}`);
    
    return getMultilingualPrompt({
        ...options,
        detectedLanguage: languageDetection.primaryLanguage,
        confidence: languageDetection.confidence
    });
}

/**
 * Get supported languages for prompts
 */
export function getSupportedPromptLanguages(): string[] {
    return Object.keys(LANGUAGE_PROMPTS);
}

/**
 * Check if language has dedicated prompt support
 */
export function hasPromptSupport(language: string): boolean {
    return language in LANGUAGE_PROMPTS;
}
