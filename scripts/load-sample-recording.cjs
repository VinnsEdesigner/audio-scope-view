#!/usr/bin/env node

const { randomUUID } = require('crypto');

const API_URL = process.env.API_URL || 'http://localhost:8080/graphql';
const API_KEY = process.env.BOOTSTRAP_KEY;
const SESSION_ID = process.env.SESSION_ID || 'd1628fbc-66aa-48ad-a41a-c17f04e310fe';

if (!API_KEY) {
 console.error('Error: BOOTSTRAP_KEY environment variable is required');
 console.error('Set it with: export BOOTSTRAP_KEY=your-secure-key');
 process.exit(1);
}

function generateAudioSamples(sampleCount, sampleRate = 44100, frequency = 440) {
 const samples = [];
 const amplitude = 0.7;
 const noiseLevel = 0.05;
 
 for (let i = 0; i < sampleCount; i++) {
 const t = i / sampleRate;
 
 const sine = Math.sin(2 * Math.PI * frequency * t);
 const harmonic = 0.3 * Math.sin(2 * Math.PI * frequency * 2 * t); 
 const noise = (Math.random() - 0.5) * noiseLevel;
 const sample = (amplitude * sine + 0.3 * harmonic + noise);
 samples.push(parseFloat(sample.toFixed(6)));
 }
 
 return samples;
}

async function createRecording() {
 
 
 const sampleRate = 44100;
 const targetSizeMB = 10;
 const targetSizeBytes = targetSizeMB * 1024 * 1024;
 const sampleCount = Math.floor(targetSizeBytes / 4); 
 const durationSeconds = Math.floor(sampleCount / sampleRate);
 
 console.log(`Generating audio sample:`);
 console.log(` - Target size: ${targetSizeMB} MB`);
 console.log(` - Sample count: ${sampleCount.toLocaleString()}`);
 console.log(` - Duration: ${durationSeconds} seconds (${(durationSeconds / 60).toFixed(1)} minutes)`);
 console.log(` - Actual size: ${(sampleCount * 4 / 1024 / 1024).toFixed(2)} MB`);
 console.log('');
 console.log('Generating samples (this may take a moment)...');
 
 const samples = generateAudioSamples(sampleCount, sampleRate, 440); 
 
 console.log('Samples generated!');
 console.log('');

 const name = `Full Audio Sample - ${targetSizeMB}MB`;

 
 const mutation = `
 mutation CreateRecording($input: CreateRecordingInput!) {
 createRecording(input: $input) {
 id
 name
 sizeBytes
 sampleCount
 durationMs
 }
 }
 `;

 const variables = {
 input: {
 sessionId: SESSION_ID,
 name: name,
 samples: samples,
 sampleRate: sampleRate
 }
 };

 console.log(`API URL: ${API_URL}`);
 console.log('');

 try {
 console.log('Sending request to GraphQL API...');
 const response = await fetch(API_URL, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${API_KEY}`
 },
 body: JSON.stringify({
 query: mutation,
 variables: variables
 })
 });

 const result = await response.json();

 if (result.errors) {
 console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
 process.exit(1);
 }

 if (result.data?.createRecording) {
 const recording = result.data.createRecording;
 console.log('✅ Recording created successfully!');
 console.log('');
 console.log('Recording details:');
 console.log(` ID: ${recording.id}`);
 console.log(` Name: ${recording.name}`);
 console.log(` Size: ${(recording.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
 console.log(` Sample count: ${recording.sampleCount.toLocaleString()}`);
 console.log(` Duration: ${(recording.durationMs / 1000).toFixed(1)} seconds`);
 console.log('');
 console.log(`To view this recording, navigate to:`);
 console.log(`http://localhost:3003/oscilloscope?recording=${recording.id}`);
 } else {
 console.error('❌ Failed to create recording - no data returned');
 console.log('Response:', JSON.stringify(result, null, 2));
 process.exit(1);
 }
 } catch (error) {
 console.error('❌ Error creating recording:', error.message);
 process.exit(1);
 }
}

createRecording();
