#!/usr/bin/env python3
import sys
import json

# Test UTF-8 encoding
print("Testing UTF-8 encoding...", file=sys.stderr)

# Read from stdin
stdin_data = sys.stdin.buffer.read().decode('utf-8')
print(f"Raw stdin data: {repr(stdin_data)}", file=sys.stderr)

try:
    input_data = json.loads(stdin_data)
    text = input_data.get('text', '')
    print(f"Parsed text: {repr(text)}", file=sys.stderr)
    print(f"Text length: {len(text)}", file=sys.stderr)
    
    # Test if we can encode it back
    result = {
        "originalText": text,
        "encoded": text.encode('utf-8').decode('utf-8'),
        "success": True
    }
    print(json.dumps(result, ensure_ascii=False))
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    result = {"error": str(e), "success": False}
    print(json.dumps(result))
