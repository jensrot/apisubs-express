import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { LANGUAGES } from '../data/languages';

export const ApiTranscribe = () => {
    const [apiKey, setApiKey] = useState('');
    const [language, setLanguage] = useState('en');
    const [message, setMessage] = useState('');
    const [subtitles, setSubtitles] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [showDownload, setShowDownload] = useState(false);
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const initFFmpeg = async () => {
            const ffmpeg = new FFmpeg();
            await ffmpeg.load({
                coreURL: '/assets/core/package/dist/umd/ffmpeg-core.js',
            });
            ffmpegRef.current = ffmpeg;
        };

        if (!ffmpegRef.current) {
            initFFmpeg();
        }
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !ffmpegRef.current) return;

        try {
            const ffmpeg = ffmpegRef.current;
            await ffmpeg.writeFile(file.name, await fetchFile(file));

            setMessage('Locally converting video to audio...');
            await ffmpeg.exec([
                '-i', file.name,
                'output.mp3',
                '-ar', '16000',
                '-ac', '1',
                '-map', '0:a'
            ]);

            const audioData: any = await ffmpeg.readFile('output.mp3');
            const originalVideo: any = await ffmpeg.readFile(file.name);

            setVideoUrl(URL.createObjectURL(
                new Blob([originalVideo.buffer], { type: 'video/mp4' })
            ));

            await processAudioWithWhisper(audioData);
        } catch (error) {
            setMessage(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const processAudioWithWhisper = async (audioData: Uint8Array) => {
        setMessage('Sending audio to OpenAI transcription API...');

        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });

        const formData = new FormData();
        formData.append('file', audioBlob, 'output.mp3');
        formData.append('model', 'whisper-1');
        formData.append('language', language);
        formData.append('response_format', 'srt');

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${await response.text()}`);
            }

            const srtData = await response.text();
            setSubtitles(srtData);
            setShowDownload(true);
            setMessage('Transcription complete. You can preview or download subtitles.');

            if (videoRef.current) {
                addSubtitlesToVideo(srtData);
            }
        } catch (error) {
            setMessage(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const addSubtitlesToVideo = (srtData: string) => {
        const vttUrl = srtToVtt(srtData);
        const video: any = videoRef.current;

        if (video) {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = 'Subtitles';
            track.srclang = language;
            track.src = vttUrl;
            track.default = true;

            video.textTracks.add(track);
            video.load();
        }
    };

    const srtToVtt = (srt: string) => {
        let vtt = 'WEBVTT\n\n';
        vtt += srt
            .replace(/^\d+$/gm, '')
            .replace(/,/g, '.')
            .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1.$2')
            .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})\.(\d{3})/g, '$1.$2');

        return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    };

    const handleDownload = () => {
        const blob = new Blob([subtitles], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subtitles.srt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container">
            <h3>Generate subtitles for video with OpenAI Whisper</h3>
            <p>This app generates subtitles for video/audio files using OpenAI's Whisper API.</p>

            <div className="form-group">
                <label htmlFor="apiKey">OpenAI API key</label>
                <input
                    id="apiKey"
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="language">Language</label>
                <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                            {lang.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="fileUpload">File upload</label>
                <input
                    id="fileUpload"
                    type="file"
                    accept="video/*,audio/*"
                    onChange={handleFileUpload}
                />
            </div>

            {videoUrl && (
                <video
                    ref={videoRef}
                    controls
                    src={videoUrl}
                    style={{ display: 'block', margin: '20px 0' }}
                />
            )}

            <p className="message">{message}</p>

            {showDownload && (
                <button onClick={handleDownload} className="download-btn">
                    Download Subtitles
                </button>
            )}

            {subtitles && (
                <div className="subtitles">
                    <h4>Generated Subtitles:</h4>
                    <pre>{subtitles}</pre>
                </div>
            )}

            <div className="how-it-works">
                <h4>How does it work?</h4>
                <p>
                    The app converts your file to audio locally using FFmpeg in the browser,
                    then sends the audio to OpenAI's Whisper API for transcription.
                    No data is stored on any server. API costs: $0.006/minute.
                </p>
                <p>
                    Get API keys at:
                    <a href="https://platform.openai.com/api-keys">https://platform.openai.com/api-keys</a>
                </p>
            </div>
        </div>
    );
};
