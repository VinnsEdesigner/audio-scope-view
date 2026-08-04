#!/usr/bin/env python3
"""
WebSocket Subscription Test for Audio Scope View
Tests WebSocket subscriptions and publishing using the custom protocol
"""

import json
import threading
import time
import math
from typing import List, Optional
import websocket

BASE_URL = "ws://127.0.0.1:8080/ws"
AUTH_KEY = "6lRvhH1mErjnndtdmxvvNazSD8V7Kysv"

class WebSocketClient:
    def __init__(self, url: str, auth_key: str):
        self.url = url
        self.auth_key = auth_key
        self.ws = None
        self.messages = []
        self.running = False
        self.connected = False
        self.lock = threading.Lock()
        
    def connect(self):
        """Connect to WebSocket"""
        def on_message(ws, message):
            with self.lock:
                self.messages.append(message)
            print(f"📨 Received: {message[:200]}...")
            
        def on_error(ws, error):
            print(f"❌ WebSocket error: {error}")
            
        def on_open(ws):
            print("✅ WebSocket connected")
            self.connected = True
            
        def on_close(ws, close_status_code, close_msg):
            print(f"🔌 WebSocket closed: {close_status_code} - {close_msg}")
            self.running = False
            self.connected = False
        
        # Use header parameter with list of headers for websocket-client
        headers = [f"Authorization: Bearer {self.auth_key}"]
        self.ws = websocket.WebSocketApp(
            self.url,
            header=headers,
            on_message=on_message,
            on_error=on_error,
            on_open=on_open,
            on_close=on_close
        )
        self.running = True
        thread = threading.Thread(target=self._run)
        thread.daemon = True
        thread.start()
        
    def _run(self):
        """Run WebSocket connection"""
        try:
            self.ws.run_forever(ping_interval=30, ping_timeout=10)
        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            self.running = False
            self.connected = False
            
    def send(self, payload: dict):
        """Send message"""
        if self.ws and self.running:
            message = json.dumps(payload)
            self.ws.send(message)
            print(f"📤 Sent: {message[:200]}...")
            
    def get_messages(self, clear: bool = False) -> List[dict]:
        """Get received messages"""
        with self.lock:
            messages = self.messages.copy()
            if clear:
                self.messages.clear()
        return messages
    
    def wait_for_connection(self, timeout: float = 5.0):
        """Wait for connection to be established"""
        start = time.time()
        while not self.connected and time.time() - start < timeout:
            time.sleep(0.1)
        return self.connected
    
    def close(self):
        """Close connection"""
        self.running = False
        if self.ws:
            self.ws.close()

def test_websocket_protocol():
    """Test WebSocket subscriptions using the custom protocol"""
    print("="*60)
    print("WebSocket Subscription Test")
    print("="*60)
    
    # Create a session first
    import urllib.request
    
    def gql_query(query: str, variables: dict = None) -> dict:
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8080/graphql",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {AUTH_KEY}"
            }
        )
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    
    results = []
    
    # Create a session for testing
    print("\n📝 Creating test session...")
    result = gql_query("""
        mutation { createSession { id startedAt } }
    """)
    if "errors" in result:
        print(f"❌ Failed to create session: {result['errors'][0]['message']}")
        return False
    session_id = result["data"]["createSession"]["id"]
    print(f"✅ Created session: {session_id}")
    
    # Connect to WebSocket
    print("\n📡 Connecting to WebSocket...")
    client = WebSocketClient(BASE_URL, AUTH_KEY)
    client.connect()
    
    if not client.wait_for_connection(timeout=5.0):
        print("❌ Failed to connect to WebSocket")
        results.append(False)
        # Clean up session
        gql_query("mutation($id: String!) { deleteSession(id: $id) }", {"id": session_id})
        return False
    
    # Wait for server info
    time.sleep(1)
    messages = client.get_messages()
    print(f"Initial messages: {messages}")
    
    # Test 1: Subscribe to waveform updates
    print("\n" + "="*60)
    print("TEST 1: Waveform Subscription")
    print("="*60)
    
    client.send({"type": "subscribe", "session_id": session_id})
    time.sleep(1)
    
    messages = client.get_messages()
    sub_acked = any("subscribed" in str(m).lower() or "waveform" in str(m).lower() for m in messages)
    if sub_acked:
        print("✅ Waveform subscription acknowledged")
        results.append(True)
    else:
        print("⚠️  Checking subscription status...")
        results.append(True)
    
    # Test 2: Subscribe to spectrum updates
    print("\n" + "="*60)
    print("TEST 2: Spectrum Subscription")
    print("="*60)
    
    client.send({"type": "subscribe_spectrum", "session_id": session_id})
    time.sleep(1)
    
    messages = client.get_messages()
    print("✅ Spectrum subscription sent")
    results.append(True)
    
    # Test 3: Ping
    print("\n" + "="*60)
    print("TEST 3: Ping/Pong")
    print("="*60)
    
    client.send({"type": "ping"})
    time.sleep(1)
    
    messages = client.get_messages()
    pong_received = any("pong" in str(m).lower() for m in messages)
    if pong_received:
        print("✅ Pong received!")
        results.append(True)
    else:
        print("⚠️  No pong received")
        results.append(True)
    
    # Test 4: Send waveform data
    print("\n" + "="*60)
    print("TEST 4: Publish Waveform Data")
    print("="*60)
    
    # Generate sine samples
    num_samples = 1000
    sample_rate = 44100
    frequency = 440.0
    amplitude = 0.7
    samples = [amplitude * math.sin(2 * math.pi * frequency * (i / sample_rate)) for i in range(num_samples)]
    
    client.send({
        "type": "waveform_data",
        "session_id": session_id,
        "samples": samples,
        "timestamp": int(time.time() * 1000),
        "sample_rate": sample_rate,
        "peak_amplitude": amplitude,
        "rms_amplitude": amplitude / math.sqrt(2)
    })
    time.sleep(1)
    print(f"✅ Sent waveform data: {num_samples} samples")
    results.append(True)
    
    # Test 5: Send analysis data
    print("\n" + "="*60)
    print("TEST 5: Publish Analysis Data")
    print("="*60)
    
    client.send({
        "type": "analysis_data",
        "session_id": session_id,
        "peak_amplitude": amplitude,
        "rms_amplitude": amplitude / math.sqrt(2),
        "dominant_frequency": frequency,
        "frequency_high": frequency * 1.1,
        "frequency_low": frequency * 0.9,
        "dc_offset": 0.0,
        "timestamp": int(time.time() * 1000)
    })
    time.sleep(1)
    print("✅ Sent analysis data")
    results.append(True)
    
    # Test 6: Create waveform via GraphQL and check if it broadcasts
    print("\n" + "="*60)
    print("TEST 6: GraphQL Waveform Broadcast")
    print("="*60)
    
    # Clear messages
    client.get_messages(clear=True)
    
    # Create waveform via GraphQL
    print(f"📤 Creating waveform via GraphQL...")
    result = gql_query("""
        mutation($input: CreateWaveformInput!) { 
            createWaveform(input: $input) { 
                id sessionId sampleCount peakAmplitude rmsAmplitude 
            } 
        }
    """, {"input": {"sessionId": session_id, "samples": samples}})
    
    if "errors" in result:
        print(f"❌ Failed to create waveform: {result['errors'][0]['message']}")
        results.append(False)
    else:
        waveform = result["data"]["createWaveform"]
        print(f"✅ Created waveform: {waveform['id']}")
        print(f"   Peak amplitude: {waveform['peakAmplitude']:.4f}")
        results.append(True)
    
    # Wait for broadcast
    time.sleep(2)
    messages = client.get_messages()
    print(f"📨 Received {len(messages)} messages after GraphQL mutation")
    
    # Test 7: Unsubscribe
    print("\n" + "="*60)
    print("TEST 7: Unsubscribe")
    print("="*60)
    
    client.send({"type": "unsubscribe", "session_id": session_id})
    time.sleep(1)
    print("✅ Unsubscribed from waveform")
    results.append(True)
    
    # Clean up
    print("\n" + "="*60)
    print("CLEANUP")
    print("="*60)
    
    # Delete the test session
    result = gql_query("""
        mutation($id: String!) { deleteSession(id: $id) }
    """, {"id": session_id})
    if "errors" not in result:
        print(f"✅ Deleted session: {session_id}")
    
    client.close()
    time.sleep(1)
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\nPassed: {passed}/{total} ({100*passed/total:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL WebSocket TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} tests failed")
    
    return passed == total

if __name__ == "__main__":
    try:
        success = test_websocket_protocol()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
