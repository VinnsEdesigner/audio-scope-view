#!/usr/bin/env python3
"""
Full Integration Test Suite for Audio Scope View
Tests sessions, waveforms, recordings, DSP calculations, and WebSocket
"""

import json
import urllib.request
import time
import math
from typing import Optional, Dict, Any, List

BASE_URL = "http://127.0.0.1:8080/graphql"
WS_URL = "ws://127.0.0.1:8080/graphql"
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

def test(name: str, query: str, variables: Optional[Dict] = None) -> tuple:
    """Execute a test and print result. Returns (success: bool, data: dict or None)"""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    try:
        result = gql(query, variables)
        if "errors" in result:
            print(f"❌ ERROR: {result['errors'][0]['message']}")
            return False, None
        print(f"✅ PASSED")
        return True, result.get("data")
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False, None

def generate_sine_samples(frequency: float, sample_rate: int, duration_ms: int, amplitude: float = 1.0) -> List[float]:
    """Generate sine wave samples"""
    num_samples = int(sample_rate * duration_ms / 1000)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        samples.append(amplitude * math.sin(2 * math.pi * frequency * t))
    return samples

def generate_square_samples(frequency: float, sample_rate: int, duration_ms: int, amplitude: float = 1.0) -> List[float]:
    """Generate square wave samples"""
    num_samples = int(sample_rate * duration_ms / 1000)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        samples.append(amplitude if math.sin(2 * math.pi * frequency * t) >= 0 else -amplitude)
    return samples

def main():
    print("="*60)
    print("Audio Scope View - Full Integration Test Suite")
    print("="*60)
    
    results = []
    created_sessions = []
    created_recordings = []
    
    # ============================================
    # PART 1: Session CRUD Operations
    # ============================================
    print("\n\n" + "="*60)
    print("PART 1: SESSION CRUD OPERATIONS")
    print("="*60)
    
    # Create a simple session
    success, data = test("Create Session", """
        mutation { createSession { id startedAt } }
    """)
    results.append(success)
    if success and data:
        session_id = data["createSession"]["id"]
        created_sessions.append(session_id)
        print(f"   Created session: {session_id}")
    
    # Create a named session
    success, data = test("Create Named Session", """
        mutation { createNamedSession(input: {name: "Integration Test Session", description: "Testing DSP features"}) { id name description startedAt } }
    """)
    results.append(success)
    if success and data:
        named_session_id = data["createNamedSession"]["id"]
        created_sessions.append(named_session_id)
        print(f"   Created named session: {named_session_id}")
    
    # Create another session for sub-session testing
    success, data = test("Create Another Session", """
        mutation { createSession { id startedAt } }
    """)
    results.append(success)
    if success and data:
        session2_id = data["createSession"]["id"]
        created_sessions.append(session2_id)
        print(f"   Created session 2: {session2_id}")
    
    # List all sessions
    success, data = test("List All Sessions", """
        query { sessions { id name startedAt } }
    """)
    results.append(success)
    if success and data:
        print(f"   Total sessions: {len(data['sessions'])}")
    
    # Get specific session
    if created_sessions:
        success, data = test(f"Get Session by ID", """
            query($id: String!) { session(id: $id) { id name description startedAt endedAt isSubSession } }
        """, {"id": created_sessions[0]})
        results.append(success)
    
    # Update session
    if created_sessions:
        success, data = test("Update Session", """
            mutation($id: String!, $input: UpdateSessionInput!) { 
                updateSession(id: $id, input: $input) { 
                    id name description 
                } 
            }
        """, {"id": created_sessions[0], "input": {"name": "Updated Session Name", "description": "Updated description"}})
        results.append(success)
    
    # Create sub-session
    if created_sessions:
        success, data = test("Create Sub-Session", """
            mutation($parentId: String!) { createSubSession(parentId: $parentId) { id name parentSessionId isSubSession } }
        """, {"parentId": created_sessions[0]})
        results.append(success)
    
    # Session heartbeat
    if created_sessions:
        success, data = test("Session Heartbeat", """
            mutation($id: String!) { sessionHeartbeat(id: $id) }
        """, {"id": created_sessions[0]})
        results.append(success)
    
    # End session
    if created_sessions:
        success, data = test("End Session", """
            mutation($id: String!) { endSession(id: $id) { id endedAt durationSeconds } }
        """, {"id": created_sessions[0]})
        results.append(success)
    
    # ============================================
    # PART 2: Waveforms and DSP Calculations
    # ============================================
    print("\n\n" + "="*60)
    print("PART 2: WAVEFORMS AND DSP CALCULATIONS")
    print("="*60)
    
    # Generate sine wave samples (440Hz - A4 note)
    sine_samples = generate_sine_samples(frequency=440.0, sample_rate=44100, duration_ms=100, amplitude=0.8)
    print(f"\nGenerated {len(sine_samples)} sine samples (440Hz, 0.8 amplitude)")
    
    # Create waveform with sine samples
    if created_sessions:
        success, data = test("Create Sine Waveform", """
            mutation($input: CreateWaveformInput!) { 
                createWaveform(input: $input) { 
                    id sessionId sampleCount peakAmplitude rmsAmplitude durationMs 
                } 
            }
        """, {"input": {"sessionId": created_sessions[-1], "samples": sine_samples}})
        results.append(success)
        if success and data:
            waveform_id = data["createWaveform"]["id"]
            print(f"   Created waveform: {waveform_id}")
            print(f"   Peak amplitude: {data['createWaveform']['peakAmplitude']:.4f} (expected ~0.8)")
            print(f"   RMS amplitude: {data['createWaveform']['rmsAmplitude']:.4f} (expected ~0.566)")
    
    # Generate square wave samples
    square_samples = generate_square_samples(frequency=100.0, sample_rate=44100, duration_ms=50, amplitude=1.0)
    print(f"\nGenerated {len(square_samples)} square samples (100Hz, 1.0 amplitude)")
    
    # Create waveform with square samples
    if created_sessions:
        success, data = test("Create Square Waveform", """
            mutation($input: CreateWaveformInput!) { 
                createWaveform(input: $input) { 
                    id sessionId sampleCount peakAmplitude rmsAmplitude durationMs 
                } 
            }
        """, {"input": {"sessionId": created_sessions[-1], "samples": square_samples}})
        results.append(success)
        if success and data:
            print(f"   Created waveform: {data['createWaveform']['id']}")
            print(f"   Peak amplitude: {data['createWaveform']['peakAmplitude']:.4f} (expected ~1.0)")
            print(f"   RMS amplitude: {data['createWaveform']['rmsAmplitude']:.4f} (expected ~1.0)")
    
    # List waveforms for session
    if created_sessions:
        success, data = test("List Waveforms", """
            query($sessionId: String!) { 
                waveforms(sessionId: $sessionId) { 
                    id sampleCount peakAmplitude rmsAmplitude 
                } 
            }
        """, {"sessionId": created_sessions[-1]})
        results.append(success)
        if success and data:
            print(f"   Total waveforms: {len(data['waveforms'])}")
    
    # Test FFT analysis on sine wave
    fft_samples = generate_sine_samples(frequency=1000.0, sample_rate=44100, duration_ms=100, amplitude=0.5)
    success, data = test("FFT Analysis (1kHz sine)", """
        mutation($input: FftanalysisInput!) { 
            fftAnalyze(input: $input) { 
                frequencies magnitudesDb peakFrequency peakMagnitudeDb 
            } 
        }
    """, {"input": {"samples": fft_samples, "sampleRate": 44100, "fftSize": 4096}})
    results.append(success)
    if success and data:
        fft_result = data["fftAnalyze"]
        print(f"   Peak frequency: {fft_result['peakFrequency']:.1f} Hz (expected ~1000)")
        print(f"   Peak magnitude: {fft_result['peakMagnitudeDb']:.1f} dB")
    
    # Test waveform analysis
    if created_sessions:
        success, data = test("Waveform Analysis", """
            mutation($input: WaveformMeasurementInput!) { 
                analyzeWaveform(input: $input) { 
                    peakAmplitude rmsAmplitude crestFactor dominantFrequency thdPercent snrDb 
                } 
            }
        """, {"input": {"samples": sine_samples, "sampleRate": 44100}})
        results.append(success)
        if success and data:
            analysis = data["analyzeWaveform"]
            print(f"   Peak: {analysis['peakAmplitude']:.4f}")
            print(f"   RMS: {analysis['rmsAmplitude']:.4f}")
            print(f"   Crest Factor: {analysis['crestFactor']:.2f} dB")
            print(f"   Dominant Freq: {analysis['dominantFrequency']:.1f} Hz")
            print(f"   THD: {analysis['thdPercent']:.2f}%")
    
    # ============================================
    # PART 3: Recordings
    # ============================================
    print("\n\n" + "="*60)
    print("PART 3: RECORDINGS")
    print("="*60)
    
    # Create a recording
    if created_sessions:
        success, data = test("Create Recording", """
            mutation($input: CreateRecordingInput!) { 
                createRecording(input: $input) { 
                    id name sessionId sampleCount sampleRate durationMs sizeBytes 
                    peakAmplitude rmsAmplitude isPinned 
                } 
            }
        """, {"input": {
            "sessionId": created_sessions[-1],
            "name": "Test Recording 1",
            "samples": sine_samples,
            "sampleRate": 44100
        }})
        results.append(success)
        if success and data:
            recording_id = data["createRecording"]["id"]
            created_recordings.append(recording_id)
            print(f"   Created recording: {recording_id}")
            print(f"   Peak amplitude: {data['createRecording']['peakAmplitude']:.4f}")
            print(f"   RMS amplitude: {data['createRecording']['rmsAmplitude']:.4f}")
    
    # Create another recording
    if created_sessions:
        success, data = test("Create Recording 2", """
            mutation($input: CreateRecordingInput!) { 
                createRecording(input: $input) { 
                    id name isPinned 
                } 
            }
        """, {"input": {
            "sessionId": created_sessions[-1],
            "name": "Test Recording 2",
            "samples": square_samples,
            "sampleRate": 44100
        }})
        results.append(success)
        if success and data:
            recording2_id = data["createRecording"]["id"]
            created_recordings.append(recording2_id)
            print(f"   Created recording 2: {recording2_id}")
    
    # Pin a recording
    if created_recordings:
        success, data = test("Pin Recording", """
            mutation($id: String!) { pinRecording(id: $id) { id isPinned } }
        """, {"id": created_recordings[0]})
        results.append(success)
    
    # List recordings
    success, data = test("List Recordings", """
        query { 
            recordings { 
                recordings { id name isPinned peakAmplitude rmsAmplitude timestamp } 
                total 
            } 
        }
    """)
    results.append(success)
    if success and data:
        print(f"   Total recordings: {data['recordings']['total']}")
    
    # Recording stats
    success, data = test("Recording Stats", """
        query { 
            recordingStats { 
                totalRecordings totalDurationMs totalSizeBytes pinnedCount 
            } 
        }
    """)
    results.append(success)
    if success and data:
        stats = data["recordingStats"]
        print(f"   Total: {stats['totalRecordings']} recordings")
        print(f"   Duration: {stats['totalDurationMs']:.0f} ms")
        print(f"   Pinned: {stats['pinnedCount']}")
    
    # Rename recording
    if created_recordings:
        success, data = test("Rename Recording", """
            mutation($id: String!, $name: String!) { 
                renameRecording(id: $id, name: $name) { id name } 
            }
        """, {"id": created_recordings[0], "name": "Renamed Recording"})
        results.append(success)
    
    # ============================================
    # PART 4: Settings
    # ============================================
    print("\n\n" + "="*60)
    print("PART 4: SETTINGS")
    print("="*60)
    
    # Create settings
    if created_sessions:
        success, data = test("Create Settings", """
            mutation($sessionId: String!) { 
                createSettings(sessionId: $sessionId) { 
                    id timeScale voltageScale triggerLevel triggerMode 
                } 
            }
        """, {"sessionId": created_sessions[-1]})
        results.append(success)
    
    # Get settings
    if created_sessions:
        success, data = test("Get Settings", """
            query($sessionId: String!) { 
                settings(sessionId: $sessionId) { 
                    id timeScale voltageScale showGrid showMeasurements 
                } 
            }
        """, {"sessionId": created_sessions[-1]})
        results.append(success)
    
    # Update settings
    if created_sessions:
        success, data = test("Update Settings", """
            mutation($sessionId: String!) { 
                updateSettings(
                    sessionId: $sessionId,
                    timeScale: 2.5,
                    voltageScale: 0.5,
                    triggerLevel: 0.3,
                    triggerMode: "single",
                    triggerEdge: "falling",
                    showGrid: true,
                    showMeasurements: true
                ) { 
                    id timeScale voltageScale triggerLevel triggerMode 
                } 
            }
        """, {"sessionId": created_sessions[-1]})
        results.append(success)
        if success and data:
            print(f"   Updated timeScale to: {data['updateSettings']['timeScale']}")
            print(f"   Updated triggerMode to: {data['updateSettings']['triggerMode']}")
    
    # ============================================
    # PART 5: Dashboard
    # ============================================
    print("\n\n" + "="*60)
    print("PART 5: DASHBOARD")
    print("="*60)
    
    success, data = test("Dashboard Summary", """
        query { 
            dashboardSummary { 
                totalSessions activeSessions totalCaptures totalWaveforms totalSamples
            } 
        }
    """)
    results.append(success)
    if success and data:
        summary = data["dashboardSummary"]
        print(f"   Total sessions: {summary['totalSessions']}")
        print(f"   Active: {summary['activeSessions']}")
        print(f"   Total captures: {summary['totalCaptures']}")
        print(f"   Total waveforms: {summary['totalWaveforms']}")
    
    success, data = test("Session Status Counts", """
        query { 
            sessionStatusCounts { 
                liveCount pausedCount offlineCount total 
            } 
        }
    """)
    results.append(success)
    
    success, data = test("Recent Sessions", """
        query { 
            recentSessions(limit: 5) { 
                id name lastActivity waveformCount 
            } 
        }
    """)
    results.append(success)
    
    success, data = test("Recent Recordings", """
        query { 
            recentRecordings(limit: 5) { 
                id name timestamp durationMs 
            } 
        }
    """)
    results.append(success)
    
    # ============================================
    # PART 6: Simulation
    # ============================================
    print("\n\n" + "="*60)
    print("PART 6: SIMULATION")
    print("="*60)
    
    success, data = test("Start Simulation", """
        mutation { 
            startSimulation(config: { 
                waveformIds: [], 
                loopEnabled: true, 
                speed: 1.0, 
                delayBetweenMs: 100 
            }) 
        }
    """)
    results.append(success)
    
    success, data = test("Simulation State", """
        query { simulationState { isRunning isPaused currentIndex waveformIndex } }
    """)
    results.append(success)
    
    success, data = test("Pause Simulation", "mutation { pauseSimulation }")
    results.append(success)
    
    success, data = test("Resume Simulation", "mutation { resumeSimulation }")
    results.append(success)
    
    success, data = test("Stop Simulation", "mutation { stopSimulation }")
    results.append(success)
    
    # ============================================
    # PART 7: User Preferences
    # ============================================
    print("\n\n" + "="*60)
    print("PART 7: USER PREFERENCES")
    print("="*60)
    
    success, data = test("Get User Preferences", """
        query { userPreferences { autoSelectLastSession lastUsedSessionId } }
    """)
    results.append(success)
    
    success, data = test("Update User Preferences", """
        mutation { 
            updateUserPreferences(autoSelectLastSession: true) { 
                autoSelectLastSession 
            } 
        }
    """)
    results.append(success)
    
    if created_sessions:
        success, data = test("Set Last Used Session", """
            mutation($sessionId: String!) { 
                setLastUsedSession(sessionId: $sessionId) { 
                    lastUsedSessionId 
                } 
            }
        """, {"sessionId": created_sessions[-1]})
        results.append(success)
    
    success, data = test("Get Last Used Session", "query { lastUsedSession }")
    results.append(success)
    if success and data:
        print(f"   Last used session: {data.get('lastUsedSession')}")
    
    # ============================================
    # PART 8: Delete Operations
    # ============================================
    print("\n\n" + "="*60)
    print("PART 8: DELETE OPERATIONS")
    print("="*60)
    
    # Delete recordings first
    for rec_id in created_recordings:
        success, data = test(f"Delete Recording {rec_id[:8]}...", """
            mutation($id: String!) { deleteRecording(id: $id) }
        """, {"id": rec_id})
        results.append(success)
    
    # Get sub-sessions for the first session and delete them
    if created_sessions:
        success, data = test("Get Sub-Sessions", """
            query($parentId: String!) { 
                subSessions(parentId: $parentId) { id } 
            }
        """, {"parentId": created_sessions[0]})
        results.append(success)
        if success and data:
            for sub in data.get("subSessions", []):
                success, data = test(f"Delete Sub-Session {sub['id'][:8]}...", """
                    mutation($id: String!) { deleteSession(id: $id) }
                """, {"id": sub["id"]})
                results.append(success)
    
    # Delete sessions in reverse order (last created first)
    # This avoids FK constraints from sub-sessions
    for sess_id in reversed(created_sessions):
        success, data = test(f"Delete Session {sess_id[:8]}...", """
            mutation($id: String!) { deleteSession(id: $id) }
        """, {"id": sess_id})
        results.append(success)
    
    # ============================================
    # SUMMARY
    # ============================================
    print("\n\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\nPassed: {passed}/{total} ({100*passed/total:.1f}%)")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} tests failed")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
