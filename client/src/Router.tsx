import React from 'react';
import { Routes, Route } from "react-router-dom";
import { Home } from './pages/home';
import { AudioExtractor } from './pages/audio-extractor';
import { ApiTranscribeQroq } from './pages/api-transcribe-qroq';
import { ApiTranscribe } from './pages/api-transcribe';

export const AppRouter = () => {
    return (
        <React.Fragment>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/api-transcribe" element={<ApiTranscribe />} />
                <Route path="/api-transcribe-groq" element={<ApiTranscribeQroq />} />
                <Route path="/audio-extractor" element={<AudioExtractor />} />
            </Routes>
        </React.Fragment>
    )
};