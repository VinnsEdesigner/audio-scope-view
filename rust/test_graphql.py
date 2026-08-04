#!/usr/bin/env python3
"""Test script for Audio Scope View GraphQL API"""

import json
import urllib.request
from typing import Dict, List, Any, Optional

BASE_URL = "http://127.0.0.1:8080/graphql"
AUTH_KEY = "6lRvhH1mErjnndtdmxvvNazSD8V7Kysv"

def gql(query: str, variables: Optional[Dict] = None) -> Dict:
    """Execute a GraphQL query"""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AUTH_KEY}"
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_query(name: str, query: str, expected_success: bool = True, expected_error: str = None) -> bool:
    """Test a query and report result"""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"Query: {query[:100]}..." if len(query) > 100 else f"Query: {query}")
    try:
        result = gql(query)
        has_errors = "errors" in result
        
        if has_errors:
            error_msg = result["errors"][0]["message"]
            if expected_error and expected_error in error_msg:
                print(f"✅ SUCCESS (expected error: {error_msg})")
                return True
            print(f"❌ FAILED: {error_msg}")
            return False
        else:
            if expected_error:
                print(f"❌ FAILED: Expected error '{expected_error}' but query succeeded")
                return False
            print(f"✅ SUCCESS")
            return True
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False

def main():
    print("="*60)
    print("Audio Scope View - GraphQL API Test Suite")
    print("="*60)
    
    results = []
    
    # ============ QUERIES ============
    
    # Dashboard queries
    results.append(test_query(
        "dashboardSummary",
        "{ dashboardSummary { totalSessions activeSessions } }"
    ))
    
    results.append(test_query(
        "sessionCount",
        "{ sessionCount }"
    ))
    
    results.append(test_query(
        "activeSessions",
        "{ activeSessions { id } }"
    ))
    
    results.append(test_query(
        "sessions (empty)",
        "{ sessions { id } }"
    ))
    
    results.append(test_query(
        "recentSessions",
        "{ recentSessions { id } }"
    ))
    
    results.append(test_query(
        "sessionsWithStatus",
        "{ sessionsWithStatus { sessions { id } total hasMore } }"
    ))
    
    results.append(test_query(
        "activeSessionsWithStatus",
        "{ activeSessionsWithStatus { id } }"
    ))
    
    results.append(test_query(
        "sessionStatusCounts",
        "{ sessionStatusCounts { liveCount pausedCount offlineCount total } }"
    ))
    
    results.append(test_query(
        "dspCapabilities",
        "{ dspCapabilities { supportedWindows } }"
    ))
    
    results.append(test_query(
        "audioInfo",
        "{ audioInfo { supportedSampleRates maxSamplesPerSubmit supportedChannels } }"
    ))
    
    results.append(test_query(
        "simulationState",
        "{ simulationState { isRunning } }"
    ))
    
    results.append(test_query(
        "recordingStats",
        "{ recordingStats { totalRecordings totalDurationMs } }"
    ))
    
    results.append(test_query(
        "recentRecordings",
        "{ recentRecordings { id name } }"
    ))
    
    results.append(test_query(
        "recordings",
        "{ recordings { recordings { id name } total } }"
    ))
    
    results.append(test_query(
        "apiKeys",
        "{ apiKeys { id name } }"
    ))
    
    results.append(test_query(
        "userPreferences",
        "{ userPreferences { autoSelectLastSession } }"
    ))
    
    results.append(test_query(
        "lastUsedSession",
        "{ lastUsedSession }"
    ))
    
    # ============ MUTATIONS ============
    
    # Session mutations
    results.append(test_query(
        "createSession",
        "mutation { createSession { id startedAt } }"
    ))
    
    results.append(test_query(
        "getOrCreateSession",
        "mutation { getOrCreateSession { id startedAt } }"
    ))
    
    results.append(test_query(
        "createNamedSession",
        "mutation { createNamedSession(input: {name: \"Test Session\"}) { id name startedAt } }"
    ))
    
    results.append(test_query(
        "endSession (invalid id)",
        "mutation { endSession(id: \"invalid-id\") { id } }",
        expected_error="NotFound"
    ))
    
    results.append(test_query(
        "sessionHeartbeat (invalid id)",
        "mutation { sessionHeartbeat(id: \"invalid-id\") }"
    ))
    
    results.append(test_query(
        "deleteSession (invalid id)",
        "mutation { deleteSession(id: \"invalid-id\") }"
    ))
    
    results.append(test_query(
        "updateSession (invalid id)",
        "mutation { updateSession(id: \"invalid-id\", input: {name: \"Updated\"}) { id } }",
        expected_error="NotFound"
    ))
    
    # Settings mutations
    results.append(test_query(
        "createSettings (invalid session)",
        "mutation { createSettings(sessionId: \"invalid-session\") { id timeScale } }"
    ))
    
    results.append(test_query(
        "settings (invalid session)",
        "{ settings(sessionId: \"invalid-session\") { id timeScale } }"
    ))
    
    # Waveform mutations
    results.append(test_query(
        "createWaveform",
        """mutation { createWaveform(input: {
            sessionId: \"invalid-session\",
            samples: [1.0, 2.0, 3.0]
        }) { id sampleCount } }"""
    ))
    
    # Recording mutations
    results.append(test_query(
        "createRecording",
        """mutation { createRecording(input: {
            sessionId: \"invalid-session\",
            name: \"Test Recording\",
            samples: [1.0, 2.0, 3.0],
            sampleRate: 44100
        }) { id name } }"""
    ))
    
    results.append(test_query(
        "deleteRecording (invalid id)",
        "mutation { deleteRecording(id: \"invalid-id\") }"
    ))
    
    results.append(test_query(
        "pinRecording (invalid id)",
        "mutation { pinRecording(id: \"invalid-id\") { id isPinned } }"
    ))
    
    results.append(test_query(
        "renameRecording (invalid id)",
        "mutation { renameRecording(id: \"invalid-id\", name: \"New Name\") { id name } }"
    ))
    
    # API Key mutations
    results.append(test_query(
        "createApiKey",
        """mutation { createApiKey(input: { name: \"Test Key\", rateLimitPerMinute: 60 }) { id key name } }"""
    ))
    
    # Simulation mutations
    results.append(test_query(
        "startSimulation",
        """mutation { startSimulation(config: { waveformIds: [\"test-id\"], loopEnabled: true, speed: 1.0, delayBetweenMs: 100 }) }"""
    ))
    
    results.append(test_query(
        "stopSimulation",
        "mutation { stopSimulation }"
    ))
    
    results.append(test_query(
        "pauseSimulation",
        "mutation { pauseSimulation }"
    ))
    
    results.append(test_query(
        "resumeSimulation",
        "mutation { resumeSimulation }"
    ))
    
    # DSP mutations
    results.append(test_query(
        "fftAnalyze",
        """mutation { fftAnalyze(input: { samples: [1.0, 2.0, 3.0, 4.0], sampleRate: 44100 }) { frequencies magnitudesDb } }"""
    ))
    
    # User preferences mutations
    results.append(test_query(
        "setLastUsedSession",
        "mutation { setLastUsedSession(sessionId: \"invalid-id\") { lastUsedSessionId } }"
    ))
    
    results.append(test_query(
        "setAutoSelectLastSession",
        "mutation { setAutoSelectLastSession(autoSelect: true) { autoSelectLastSession } }"
    ))
    
    results.append(test_query(
        "updateUserPreferences",
        "mutation { updateUserPreferences(autoSelectLastSession: true) { autoSelectLastSession } }"
    ))
    
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
        print("\n✅ All tests passed!")

if __name__ == "__main__":
    main()
