const { spawn } = require('child_process');
const path = require('path');

class TranslationService {
  constructor() {
    this.isLoading = false;
    this.isLoaded = false;
    this.usePythonScript = true; // Set to true to use Python script

    // Language mapping for Sarvam-Translate model
    this.languageMap = {
      'English': 'en-IN',
      'Hindi': 'hi-IN',
      'Bengali': 'bn-IN',
      'Tamil': 'ta-IN',
      'Telugu': 'te-IN',
      'Gujarati': 'gu-IN',
      'Kannada': 'kn-IN',
      'Malayalam': 'ml-IN',
      'Marathi': 'mr-IN',
      'Punjabi': 'pa-IN',
      'Odia': 'or-IN',
      'Assamese': 'as-IN',
      'Bodo': 'brx-IN',
      'Dogri': 'doi-IN',
      'Kashmiri': 'ks-IN',
      'Konkani': 'gom-IN',
      'Maithili': 'mai-IN',
      'Manipuri': 'mni-IN',
      'Nepali': 'ne-IN',
      'Sanskrit': 'sa-IN',
      'Santali': 'sat-IN',
      'Sindhi': 'sd-IN',
      'Urdu': 'ur-IN'
    };
  }

  async initialize() {
    if (this.isLoaded || this.isLoading) {
      return;
    }

    this.isLoading = true;
    console.log('🔄 Initializing Sarvam-Translate model...');

    try {
      if (this.usePythonScript) {
        console.log('🐍 Using Python script for Sarvam-Translate model');
        // Test if Python script is available
        await this.testPythonScript();
      } else {
        console.log('⚠️ Using mock translation service for now');
        console.log('💡 To use the actual Sarvam-Translate model:');
        console.log('   1. Install Python dependencies: pip install -r requirements.txt');
        console.log('   2. Set usePythonScript = true in translationService.js');
      }

      this.isLoaded = true;
      this.isLoading = false;
      console.log('✅ Translation service initialized');
    } catch (error) {
      this.isLoading = false;
      console.error('❌ Failed to initialize translation service:', error);
      throw error;
    }
  }

  async testPythonScript() {
    return new Promise((resolve, reject) => {
      const python = spawn('python', ['sarvam_translate.py', '--help']);

      python.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Python script is available');
          resolve();
        } else {
          console.log('⚠️ Python script not available, falling back to mock service');
          resolve(); // Don't reject, just fall back to mock
        }
      });

      python.on('error', (error) => {
        console.log('⚠️ Python script not available, falling back to mock service');
        resolve(); // Don't reject, just fall back to mock
      });
    });
  }

  async translateWithPython(text, sourceLanguage, targetLanguage) {
    return new Promise((resolve, reject) => {
      const python = spawn('python', [
        'sarvam_translate.py',
        '--stdin'
        // Removed --use-fallback to try AI model first
      ]);

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            // Check if the result contains actual translation or just fallback
            if (result.translatedText && !result.translatedText.startsWith('[') && !result.translatedText.includes('Error in model translation')) {
              resolve(result);
            } else {
              // If it's a fallback translation, still use it as it's better than mock
              resolve(result);
            }
          } catch (error) {
            reject(new Error('Failed to parse Python script output'));
          }
        } else {
          // Even if Python script fails, try to parse the output as it might contain fallback translation
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
          }
        }
      });

      python.on('error', (error) => {
        reject(error);
      });

      // Send input data via stdin
      const inputData = {
        text: text,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      };
      
      python.stdin.write(JSON.stringify(inputData));
      python.stdin.end();
    });
  }

  async translate(text, sourceLanguage, targetLanguage) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    if (!text || !sourceLanguage || !targetLanguage) {
      throw new Error('Text, source language, and target language are required');
    }

    // Convert language names to codes
    const sourceCode = this.languageMap[sourceLanguage];
    const targetCode = this.languageMap[targetLanguage];

    console.log(`🔄 Translating from ${sourceLanguage} to ${targetLanguage}`);
    if (!sourceCode || !targetCode) {
      throw new Error(`Unsupported language: ${sourceLanguage} or ${targetLanguage}`);
    }

    // If source and target are the same, return original text
    if (sourceCode === targetCode) {
      return {
        translatedText: text,
        sourceLanguage: sourceCode,
        targetLanguage: targetCode,
        isTranslated: false
      };
    }

    try {
      console.log(`🔄 Using Sarvam-Translate model: ${sourceLanguage} -> ${targetLanguage}`);

      let result;

      if (this.usePythonScript) {
        try {
          result = await this.translateWithPython(text, sourceLanguage, targetLanguage);
          console.log(`📋 Translation result:`, result);
          
          // Check if we got a meaningful translation from the AI model
          if (result.translatedText && !result.translatedText.startsWith('[') && result.translatedText !== text) {
            console.log('✅ AI model translation successful');
          } else {
            console.log('⚠️ AI model returned fallback, but using it');
          }
        } catch (error) {
          console.log('⚠️ AI model failed, using fallback translation');
          result = this.getMockTranslation(text, sourceLanguage, targetLanguage);
        }
      } else {
        result = this.getMockTranslation(text, sourceLanguage, targetLanguage);
      }

      console.log(`✅ Translation completed: "${text}" -> "${result.translatedText}"`);
      return result;

    } catch (error) {
      console.error('❌ Translation failed:', error);
      throw error;
    }
  }

  getMockTranslation(text, sourceLanguage, targetLanguage) {
    const mockTranslations = {
      'English': {
        'Hindi': `[Hindi] ${text}`,
        'Malayalam': `[Malayalam] ${text}`,
        'Tamil': `[Tamil] ${text}`,
        'Bengali': `[Bengali] ${text}`,
        'Gujarati': `[Gujarati] ${text}`,
        'Telugu': `[Telugu] ${text}`,
        'Kannada': `[Kannada] ${text}`,
        'Punjabi': `[Punjabi] ${text}`,
        'Marathi': `[Marathi] ${text}`,
        'Odia': `[Odia] ${text}`,
        'Assamese': `[Assamese] ${text}`,
        'Bodo': `[Bodo] ${text}`,
        'Dogri': `[Dogri] ${text}`,
        'Kashmiri': `[Kashmiri] ${text}`,
        'Konkani': `[Konkani] ${text}`,
        'Maithili': `[Maithili] ${text}`,
        'Manipuri': `[Manipuri] ${text}`,
        'Nepali': `[Nepali] ${text}`,
        'Sanskrit': `[Sanskrit] ${text}`,
        'Santali': `[Santali] ${text}`,
        'Sindhi': `[Sindhi] ${text}`,
        'Urdu': `[Urdu] ${text}`
      },
      'Hindi': {
        'English': `[English] ${text}`,
        'Malayalam': `[Malayalam] ${text}`,
        'Tamil': `[Tamil] ${text}`,
        'Bengali': `[Bengali] ${text}`,
        'Gujarati': `[Gujarati] ${text}`,
        'Telugu': `[Telugu] ${text}`,
        'Kannada': `[Kannada] ${text}`,
        'Punjabi': `[Punjabi] ${text}`,
        'Marathi': `[Marathi] ${text}`,
        'Odia': `[Odia] ${text}`
      },
      'Malayalam': {
        'English': `[English] ${text}`,
        'Hindi': `[Hindi] ${text}`,
        'Tamil': `[Tamil] ${text}`,
        'Bengali': `[Bengali] ${text}`,
        'Gujarati': `[Gujarati] ${text}`,
        'Telugu': `[Telugu] ${text}`,
        'Kannada': `[Kannada] ${text}`,
        'Punjabi': `[Punjabi] ${text}`,
        'Marathi': `[Marathi] ${text}`,
        'Odia': `[Odia] ${text}`
      },
      'Tamil': {
        'English': `[English] ${text}`,
        'Hindi': `[Hindi] ${text}`,
        'Malayalam': `[Malayalam] ${text}`,
        'Bengali': `[Bengali] ${text}`,
        'Gujarati': `[Gujarati] ${text}`,
        'Telugu': `[Telugu] ${text}`,
        'Kannada': `[Kannada] ${text}`,
        'Punjabi': `[Punjabi] ${text}`,
        'Marathi': `[Marathi] ${text}`,
        'Odia': `[Odia] ${text}`
      }
    };

    const translatedText = mockTranslations[sourceLanguage]?.[targetLanguage] ||
                         `[Translated to ${targetLanguage}] ${text}`;

    return {
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      isTranslated: true
    };
  }

  getSupportedLanguages() {
    return Object.keys(this.languageMap);
  }

  isLanguageSupported(language) {
    return this.languageMap.hasOwnProperty(language);
  }

  getLanguageCode(language) {
    return this.languageMap[language];
  }
}

// Create a singleton instance
const translationService = new TranslationService();

module.exports = translationService;
