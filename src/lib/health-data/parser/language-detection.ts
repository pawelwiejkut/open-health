/**
 * Universal Language Detection for Medical Documents
 * Detects document language and provides appropriate OCR/parsing settings
 */

export interface LanguageDetectionResult {
    primaryLanguage: string;
    confidence: number;
    ocrLanguages: string[];
    dateFormats: string[];
    referenceKeywords: string[];
    medicalTerms: string[];
}

/**
 * Language-specific configurations for medical document processing
 */
const LANGUAGE_CONFIGS: Record<string, {
    ocrCode: string[];
    dateFormats: string[];
    referenceKeywords: string[];
    commonMedicalTerms: string[];
}> = {
    'en': {
        ocrCode: ['eng'],
        dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
        referenceKeywords: ['reference', 'normal', 'range', 'ref', 'normal range'],
        commonMedicalTerms: ['blood', 'glucose', 'cholesterol', 'hemoglobin', 'creatinine', 'test', 'result', 'lab', 'laboratory']
    },
    'pl': {
        ocrCode: ['pol'],
        dateFormats: ['DD.MM.YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['norma', 'zakres', 'ref', 'odniesienie', 'wartości referencyjne'],
        commonMedicalTerms: ['krew', 'glukoza', 'cholesterol', 'hemoglobina', 'kreatynina', 'badanie', 'wynik', 'laboratorium']
    },
    'de': {
        ocrCode: ['deu'],
        dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['referenz', 'normal', 'bereich', 'ref', 'normbereich'],
        commonMedicalTerms: ['blut', 'glukose', 'cholesterin', 'hämoglobin', 'kreatinin', 'test', 'ergebnis', 'labor']
    },
    'fr': {
        ocrCode: ['fra'],
        dateFormats: ['DD/MM/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['référence', 'normal', 'gamme', 'réf', 'valeurs de référence'],
        commonMedicalTerms: ['sang', 'glucose', 'cholestérol', 'hémoglobine', 'créatinine', 'test', 'résultat', 'laboratoire']
    },
    'es': {
        ocrCode: ['spa'],
        dateFormats: ['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['referencia', 'normal', 'rango', 'ref', 'valores de referencia'],
        commonMedicalTerms: ['sangre', 'glucosa', 'colesterol', 'hemoglobina', 'creatinina', 'prueba', 'resultado', 'laboratorio']
    },
    'it': {
        ocrCode: ['ita'],
        dateFormats: ['DD/MM/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['riferimento', 'normale', 'intervallo', 'rif', 'valori di riferimento'],
        commonMedicalTerms: ['sangue', 'glucosio', 'colesterolo', 'emoglobina', 'creatinina', 'test', 'risultato', 'laboratorio']
    },
    'ru': {
        ocrCode: ['rus'],
        dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        referenceKeywords: ['референс', 'норма', 'диапазон', 'реф', 'референсные значения'],
        commonMedicalTerms: ['кровь', 'глюкоза', 'холестерин', 'гемоглобин', 'креатинин', 'тест', 'результат', 'лаборатория']
    },
    'ko': {
        ocrCode: ['kor'],
        dateFormats: ['YYYY-MM-DD', 'YYYY.MM.DD', 'YYYY/MM/DD'],
        referenceKeywords: ['참고치', '정상', '범위', '참고', '참고기준치'],
        commonMedicalTerms: ['혈액', '혈당', '콜레스테롤', '헤모글로빈', '크레아티닌', '검사', '결과', '임상']
    },
    'ja': {
        ocrCode: ['jpn'],
        dateFormats: ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD'],
        referenceKeywords: ['基準値', '正常', '範囲', '参考', '基準範囲'],
        commonMedicalTerms: ['血液', '血糖', 'コレステロール', 'ヘモグロビン', 'クレアチニン', '検査', '結果', '臨床']
    },
    'zh': {
        ocrCode: ['chi_sim', 'chi_tra'],
        dateFormats: ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD'],
        referenceKeywords: ['参考值', '正常', '范围', '参考', '参考范围'],
        commonMedicalTerms: ['血液', '血糖', '胆固醇', '血红蛋白', '肌酐', '检查', '结果', '临床']
    }
};

/**
 * Detect language from text content using keyword matching
 */
export function detectLanguageFromText(text: string): LanguageDetectionResult {
    const normalizedText = text.toLowerCase();
    const scores: Record<string, number> = {};
    
    // Calculate scores based on medical term matches
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
        let score = 0;
        const totalTerms = config.commonMedicalTerms.length + config.referenceKeywords.length;
        
        // Check medical terms
        for (const term of config.commonMedicalTerms) {
            if (normalizedText.includes(term.toLowerCase())) {
                score += 2; // Medical terms are more important
            }
        }
        
        // Check reference keywords
        for (const keyword of config.referenceKeywords) {
            if (normalizedText.includes(keyword.toLowerCase())) {
                score += 3; // Reference keywords are very important
            }
        }
        
        scores[lang] = score / totalTerms;
    }
    
    // Find the language with the highest score
    const sortedLanguages = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .filter(([, score]) => score > 0);
    
    // Default to English if no matches found
    const primaryLanguage = sortedLanguages.length > 0 ? sortedLanguages[0][0] : 'en';
    const confidence = sortedLanguages.length > 0 ? sortedLanguages[0][1] : 0.1;
    
    const config = LANGUAGE_CONFIGS[primaryLanguage];
    
    return {
        primaryLanguage,
        confidence,
        ocrLanguages: config.ocrCode,
        dateFormats: config.dateFormats,
        referenceKeywords: config.referenceKeywords,
        medicalTerms: config.commonMedicalTerms
    };
}

/**
 * Get OCR language codes for multiple detected languages
 */
export function getMultiLanguageOcrCodes(detectedLanguages: string[]): string[] {
    const ocrCodes = new Set<string>();
    
    for (const lang of detectedLanguages) {
        const config = LANGUAGE_CONFIGS[lang];
        if (config) {
            config.ocrCode.forEach(code => ocrCodes.add(code));
        }
    }
    
    // Always include English as fallback
    ocrCodes.add('eng');
    
    return Array.from(ocrCodes);
}

/**
 * Detect language from filename patterns
 */
export function detectLanguageFromFilename(filename: string): string | null {
    const lower = filename.toLowerCase();
    
    if (lower.includes('_pl') || lower.includes('_pol') || lower.includes('polska')) return 'pl';
    if (lower.includes('_de') || lower.includes('_deu') || lower.includes('deutsch')) return 'de';
    if (lower.includes('_fr') || lower.includes('_fra') || lower.includes('french')) return 'fr';
    if (lower.includes('_es') || lower.includes('_spa') || lower.includes('spanish')) return 'es';
    if (lower.includes('_it') || lower.includes('_ita') || lower.includes('italian')) return 'it';
    if (lower.includes('_ru') || lower.includes('_rus') || lower.includes('russian')) return 'ru';
    if (lower.includes('_ko') || lower.includes('_kor') || lower.includes('korean')) return 'ko';
    if (lower.includes('_ja') || lower.includes('_jpn') || lower.includes('japanese')) return 'ja';
    if (lower.includes('_zh') || lower.includes('_chi') || lower.includes('chinese')) return 'zh';
    
    return null;
}

/**
 * Get comprehensive language configuration
 */
export function getLanguageConfig(language: string) {
    return LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS['en'];
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIGS);
}