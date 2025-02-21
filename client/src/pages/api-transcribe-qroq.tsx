import { useEffect, useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import { LANGUAGES } from '../data/languages';

export const ApiTranscribeQroq = () => {

    const [apiKey, setApiKey] = useState<string | undefined>(() => {
        // Check localStorage for existing API key
        return localStorage.getItem('api-key') || undefined;
    });
    const [language, setLanguage] = useState('en');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [srtContent, setSrtContent] = useState('');
    const [videoSrc, setVideoSrc] = useState('');
    const [showVideo, setShowVideo] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [subtitleTracks, setSubtitleTracks] = useState<string[]>([]);

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const currentSRTRef = useRef<HTMLTextAreaElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | any>(null);

    useEffect(() => {
        if (apiKey) {
            localStorage.setItem('api-key', apiKey);
        }
    }, [apiKey]);  // This will run when apiKey is updated

    // Function to convert float seconds to SRT timestamp
    const secondsToSrtTime = (seconds: number): string => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const secs = String(date.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
        return `${hours}:${minutes}:${secs},${milliseconds}`;
    }

    // Function to convert data to SRT format
    const convertToSrt = (data: any) => {
        return data.map((item: any, index: number) => {
            const startTime = secondsToSrtTime(item.start);
            const endTime = secondsToSrtTime(item.end);
            return `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n`;
        }).join('\n');
    }

    const handleWhisperAPI = async (audioData: any) => {
        try {
            setMessage('Sending audio to groq transcription API...');
            const formData = new FormData();
            formData.append('file', new Blob([audioData.buffer], { type: 'audio/mpeg' }), 'output.mp3');
            formData.append('model', language === 'en' ? 'distil-whisper-large-v3-en' : 'whisper-large-v3');
            formData.append('temperature', '0');
            formData.append('language', language);
            formData.append('response_format', 'verbose_json');

            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData
            });

            if (!response.ok) throw new Error('API Error: ' + await response.text());

            const json = await response.json();
            const srt = convertToSrt(json.segments);
            currentSRTRef.current = srt;
            setSrtContent(srt);
            setMessage('Transcription complete!, you can now download or preview the subtitles.');
            return srt;
        } catch (err: any) {
            setError('API Error: ' + err.message);
            throw err;
        }
    };

    function srtToVtt(data: any) {
        let vtt = 'WEBVTT\n\n';
        vtt += data
            .replace(/^\d+$/gm, '')
            .replace(/,/g, '.')
            .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1.$2')
            // Remove the extra dot in timestamps
            .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})\.(\d{3})/g, '$1.$2');
        console.log("Converted VTT:", vtt);
        const subtitleBlob = new Blob([vtt], { type: 'text/vtt' });
        return URL.createObjectURL(subtitleBlob);
    }

    const handleTranscode = async (file: any) => {
        try {
            setMessage('Loading ffmpeg...');
            if (!ffmpegRef.current) {
                const ffmpeg = new FFmpeg();
                ffmpegRef.current = ffmpeg;

                ffmpeg.on('log', ({ message }) => console.log(message));
                ffmpeg.on('progress', ({ progress }) => {
                    setMessage(`Preparing file: ${Math.round(progress * 100)}%`);
                });

                await ffmpeg.load();
            }

            setMessage('Opening file...');
            await ffmpegRef.current?.writeFile(file.name, await fetchFile(file));

            setMessage('Converting to audio...');
            await ffmpegRef.current?.exec([
                '-i', file.name, '-ar', '16000', '-ac', '1', '-map', '0:a', 'output.mp3'
            ]);

            const data = await ffmpegRef.current.readFile('output.mp3');
            const subs = await handleWhisperAPI(data);

            // Generate new VTT URL
            const vttUrl = srtToVtt(subs);
            console.log(vttUrl);

            // Update video and subtitle tracks states first
            setSubtitleTracks([vttUrl]);

            const videoData: any = await ffmpegRef.current.readFile(file.name);
            setVideoSrc(URL.createObjectURL(
                new Blob([videoData.buffer], { type: 'video/mp4' })
            ));

            // Wait until both videoSrc and subtitleTracks are updated
            setShowVideo(true);

            return subs;

        } catch (err: any) {
            setError('Error processing file: ' + err.message);
            throw err;
        }
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setError('');
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setError('Please select a file');
            return;
        }
        if (!apiKey) {
            setError('Please enter API key');
            return;
        }

        try {
            setIsTranscribing(true);
            await handleTranscode(file);
            localStorage.setItem("api-key", apiKey);
        } catch (err) {
            console.error(err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleDownload = () => {
        if (!srtContent) {
            setError('No subtitle content available to download.');
            return;
        }

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'subs.srt';
        link.click();
    };

    return (
        <div>
            <a href="/">Home</a>
            <h3>Generate subtitles with Groq OpenAI Whisper API</h3>
            <p>Webapp to generate subtitles for video/audio files</p>

            <form onSubmit={handleSubmit}>
                <label>
                    Groq API Key:
                    <input
                        type="text"
                        value={apiKey}
                        onChange={(e: any) => setApiKey(e.target.value)}
                    />
                </label>

                <label>
                    Language:
                    <select
                        value={language}
                        onChange={(e: any) => setLanguage(e.target.value)}
                    >
                        {LANGUAGES.map((lang: any) => (
                            <option key={lang.value} value={lang.value}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Upload File:
                    <input
                        type="file"
                        ref={fileInputRef}
                    />
                </label>

                {error && <div className="error">{error}</div>}
                {message && <div>{message}</div>}

                <button type="submit" disabled={isTranscribing}>
                    {isTranscribing ? 'Transcribing...' : 'Start Transcription'}
                </button>
            </form>

            {showVideo && (
                <video
                    ref={videoRef}
                    controls
                    src={videoSrc}
                    style={{ display: 'block', marginTop: '1rem' }}
                >
                    {subtitleTracks?.map((trackUrl, index) => {
                        console.log(`Index: ${index}, Track URL: ${trackUrl}`); // This will log each track URL and its index
                        return (
                            <track
                                key={index}
                                kind="subtitles"
                                label="Subtitles"
                                srcLang={language}
                                src={trackUrl}
                                default
                            />
                        );
                    })}
                </video>
            )}

            {srtContent && (
                <>
                    <button onClick={handleDownload} style={{ marginTop: '1rem' }}>
                        Download SRT
                    </button>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{srtContent}</pre>
                </>
            )}

            <div>
                <h4>How it works</h4>
                <p>Files are processed locally using FFmpeg WASM and sent to Groq's API.</p>
                <p>Get API key at <a target='_blank' href="https://console.groq.com/keys">Groq Console</a></p>
            </div>
        </div>
    )
}