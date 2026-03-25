#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sarvam-Translate Python script for local model inference
This script can be called from Node.js to perform translations
"""

import sys
import json
import argparse
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Set UTF-8 encoding for stdout and stderr
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def load_model():
    """Load the Sarvam-Translate model and tokenizer"""
    model_name = "sarvamai/sarvam-translate"
    
    print("Loading tokenizer...", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    print("Loading model...", file=sys.stderr)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto"
    )
    
    return model, tokenizer

def translate_text(text, target_language, model, tokenizer):
    """Translate text to target language using Sarvam-Translate"""
    
    # Create the prompt for Sarvam-Translate
    messages = [
        {"role": "system", "content": f"Translate the text below to {target_language}."},
        {"role": "user", "content": text}
    ]
    
    # Apply chat template
    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    
    # Tokenize input
    model_inputs = tokenizer([prompt], return_tensors="pt").to(model.device)
    
    # Generate translation
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            do_sample=True,
            temperature=0.01,
            num_return_sequences=1,
            pad_token_id=tokenizer.eos_token_id
        )
    
    # Decode output
    output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist()
    translated_text = tokenizer.decode(output_ids, skip_special_tokens=True)
    
    return translated_text

def main():
    parser = argparse.ArgumentParser(description='Sarvam-Translate CLI')
    parser.add_argument('--text', help='Text to translate')
    parser.add_argument('--target-language', help='Target language')
    parser.add_argument('--source-language', default='English', help='Source language')
    parser.add_argument('--model-path', help='Path to local model (optional)')
    parser.add_argument('--stdin', action='store_true', help='Read from stdin instead of command line')
    
    args = parser.parse_args()
    
    try:
        # Handle input from stdin or command line
        if args.stdin:
            # Read from stdin with proper UTF-8 encoding
            stdin_data = sys.stdin.buffer.read().decode('utf-8')
            input_data = json.loads(stdin_data)
            text = input_data.get('text', '')
            target_language = input_data.get('targetLanguage', '')
            source_language = input_data.get('sourceLanguage', 'English')
        else:
            # Read from command line arguments
            text = args.text
            target_language = args.target_language
            source_language = args.source_language
        
        if not text or not target_language:
            raise ValueError("Text and target language are required")
        
        # Load model
        model, tokenizer = load_model()
        
        # Translate text
        translated_text = translate_text(
            text, 
            target_language, 
            model, 
            tokenizer
        )
        
        # Return result as JSON
        result = {
            "translatedText": translated_text,
            "sourceLanguage": source_language,
            "targetLanguage": target_language,
            "isTranslated": True
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "translatedText": f"[Translation failed] {text if 'text' in locals() else 'Unknown'}",
            "sourceLanguage": source_language if 'source_language' in locals() else 'Unknown',
            "targetLanguage": target_language if 'target_language' in locals() else 'Unknown',
            "isTranslated": False
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()