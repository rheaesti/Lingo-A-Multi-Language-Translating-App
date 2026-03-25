# Sarvam-Translate Integration Setup

This document explains how to set up and use the Sarvam-Translate model for local translation in your Lingo application.

## Overview

The Lingo application now supports local translation using the Sarvam-Translate model, which provides high-quality translation across 22 Indian languages. The integration supports both mock translations (for testing) and actual model inference.

## Features

- **22 Indian Languages**: Support for all official Indian languages including Hindi, Tamil, Malayalam, Bengali, Gujarati, Telugu, Kannada, Punjabi, Marathi, Odia, and more
- **Local Model Inference**: No API calls required - runs entirely on your local machine
- **Auto-translation**: Messages are automatically translated based on user language preferences
- **Fallback Support**: Graceful fallback to mock translations if the model is not available

## Setup Options

### Option 1: Mock Translation (Default)

The application currently uses mock translations by default, which is perfect for testing and development.

**No additional setup required** - the application will work immediately with mock translations.

### Option 2: Actual Sarvam-Translate Model

To use the actual Sarvam-Translate model, follow these steps:

#### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### 2. Enable Python Script Mode

Edit `translationService.js` and change:

```javascript
this.usePythonScript = false; // Change to true
```

#### 3. Test the Setup

```bash
# Test the Python script directly
python sarvam_translate.py --text "Hello, how are you?" --target-language "Hindi"

# Test the Node.js integration
node test_translation.js
```

## Supported Languages

The following languages are supported:

- English
- Hindi
- Bengali
- Tamil
- Telugu
- Gujarati
- Kannada
- Malayalam
- Marathi
- Punjabi
- Odia
- Assamese
- Bodo
- Dogri
- Kashmiri
- Konkani
- Maithili
- Manipuri
- Nepali
- Sanskrit
- Santali
- Sindhi
- Urdu

## How It Works

### 1. User Language Selection

When users log in, they select their preferred language from the dropdown menu.

### 2. Automatic Translation

When a user sends a message to another user with a different language preference:

1. The message is sent to the translation service
2. The service translates the message from the sender's language to the recipient's language
3. The recipient receives the translated message
4. The original message is also stored for reference

### 3. Translation Service

The translation service (`translationService.js`) handles:

- Language mapping between display names and model codes
- Model loading and initialization
- Translation requests
- Fallback to mock translations if needed

## API Endpoints

### POST /translate

Translates text from one language to another.

**Request:**
```json
{
  "text": "Hello, how are you?",
  "sourceLanguage": "English",
  "targetLanguage": "Hindi"
}
```

**Response:**
```json
{
  "translatedText": "[Hindi] Hello, how are you?",
  "sourceLanguage": "English",
  "targetLanguage": "Hindi",
  "isTranslated": true
}
```

## Testing

### Test Translation Service

```bash
node test_translation.js
```

### Test API Endpoint

```bash
# Using PowerShell
Invoke-WebRequest -Uri "http://localhost:5000/translate" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"text": "Hello, how are you?", "sourceLanguage": "English", "targetLanguage": "Hindi"}'

# Using curl (if available)
curl -X POST http://localhost:5000/translate -H "Content-Type: application/json" -d "{\"text\": \"Hello, how are you?\", \"sourceLanguage\": \"English\", \"targetLanguage\": \"Hindi\"}"
```

## Configuration

### Environment Variables

No additional environment variables are required for the basic setup.

### Model Configuration

The model configuration can be modified in `sarvam_translate.py`:

- `max_new_tokens`: Maximum number of tokens to generate (default: 1024)
- `temperature`: Sampling temperature (default: 0.01)
- `do_sample`: Whether to use sampling (default: True)

## Troubleshooting

### Common Issues

1. **Python script not found**: Make sure Python is installed and the script is executable
2. **Model loading fails**: Check if you have enough disk space and memory
3. **Translation errors**: Check the console logs for detailed error messages

### Logs

The application provides detailed logging:

- `🔄` - Translation in progress
- `✅` - Successful translation
- `❌` - Translation failed
- `⚠️` - Warning or fallback

## Performance Considerations

### Memory Usage

The Sarvam-Translate model requires significant memory:
- Model size: ~4.3B parameters
- Recommended RAM: 8GB+ for smooth operation
- GPU: Optional but recommended for faster inference

### Response Time

- Mock translations: < 1ms
- Actual model inference: 1-5 seconds (depending on hardware)

## Future Enhancements

- [ ] Model quantization for reduced memory usage
- [ ] Caching for frequently translated phrases
- [ ] Batch translation for multiple messages
- [ ] Real-time translation indicators
- [ ] Translation quality metrics

## Support

For issues related to:

- **Lingo Application**: Check the main README.md
- **Sarvam-Translate Model**: Refer to the official documentation
- **Python Integration**: Check the Python script logs

## License

This integration follows the same license as the main Lingo application and respects the Sarvam-Translate model's licensing terms.
