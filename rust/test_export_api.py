#!/usr/bin/env python3
"""Test script for Audio Scope View Export API endpoints"""

import json
import urllib.request
from typing import Dict, Optional

BASE_URL = "http://127.0.0.1:8080"
AUTH_KEY = "osWuuGWVlOLbO3ZNY9Ro911h0eJcdk2P6DvA2GVy9Ro="

def make_request(path: str, expected_status: int = 200) -> Dict:
    """Make a request to the API and return the response"""
    url = f"{BASE_URL}{path}"
    print(f"\n{'='*60}")
    print(f"Testing: GET {path}")
    
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {AUTH_KEY}"})
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            status = resp.status
            print(f"Status: {status}")
            print(f"Content-Type: {content_type}")
            
            if "json" in content_type:
                data = json.loads(resp.read().decode("utf-8"))
                print(f"Response: {json.dumps(data, indent=2)[:500]}")
                return {"status": status, "data": data}
            else:
                content = resp.read()
                print(f"Content-Length: {len(content)}")
                if len(content) < 500:
                    print(f"Content: {content[:200]}")
                return {"status": status, "content_length": len(content)}
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        error_body = e.read().decode("utf-8")[:500] if e.fp else "No body"
        print(f"Error body: {error_body}")
        return {"status": e.code, "error": error_body}
    except Exception as e:
        print(f"Exception: {e}")
        return {"error": str(e)}

def main():
    print("="*60)
    print("Audio Scope View - Export API Test Suite")
    print("="*60)
    
    results = []
    
    # Test health endpoint first
    results.append(make_request("/health")["status"] == 200)
    
    # Test export API endpoints with non-existent recording
    # These should return 404 or proper error responses
    
    # CSV Export
    result = make_request("/api/recordings/nonexistent-id/csv")
    # Should return 404 for non-existent recording
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # WAV Export
    result = make_request("/api/recordings/nonexistent-id/wav")
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # JSON Export
    result = make_request("/api/recordings/nonexistent-id/json")
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # Test recording samples endpoint
    result = make_request("/api/recordings/nonexistent-id/samples")
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # Test recording metadata endpoint
    result = make_request("/api/recordings/nonexistent-id/metadata")
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # Test recording stream endpoint
    result = make_request("/api/recordings/nonexistent-id/stream")
    results.append(result.get("status") == 404 or "not found" in result.get("error", "").lower())
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total} ({100*passed/total:.1f}%)")
    print(f"Failed: {total - passed}/{total}")
    
    if passed < total:
        print("\n⚠️  Some tests failed - needs investigation")
    else:
        print("\n✅ All export API endpoint tests passed!")

if __name__ == "__main__":
    main()
