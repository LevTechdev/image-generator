'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoginButton } from '@/components/auth/LoginButton';
import { UserMenu } from '@/components/auth/UserMenu';
import { PromptInput } from '@/components/generator/PromptInput';
import { SettingsPanel } from '@/components/generator/SettingsPanel';
import { ImageDisplay } from '@/components/generator/ImageDisplay';
import { GenerateButton } from '@/components/generator/GenerateButton';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { Gallery, Sparkles } from 'lucide-react';
import { sleep } from '@/lib/utils';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState({
    model: 'black-forest-labs/flux-schnell',
    aspectRatio: '1:1',
    numOutputs: 1,
    outputFormat: 'jpg',
    outputQuality: 80,
    negativePrompt: '',
  });
  const [prediction, setPrediction] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setPrediction(null);

    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, settings }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate image');
      }

      const data = await response.json();
      setPrediction(data);

      while (data.status !== 'succeeded' && data.status !== 'failed') {
        await sleep(2000);
        const statusResponse = await fetch(`/api/predictions/${data.id}`);
        const statusData = await statusResponse.json();
        setPrediction(statusData);

        if (statusData.status === 'succeeded' || statusData.status === 'failed') {
          setPrediction(statusData);
          break;
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload(url) {
    if (!url && prediction?.output) {
      url = prediction.output[0];
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `generated-image-${Date.now()}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Download error:', err);
    }
  }

  async function handleSave(promptText) {
    try {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, settings, notes: '', tags: [] }),
      });
      alert('Saved to favorites!');
    } catch (err) {
      console.error('Save error:', err);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="text-center mb-8">
            <Sparkles className="w-12 h-12 mx-auto text-blue-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              AI Image Generator
            </h1>
            <p className="text-gray-600">
              Create stunning images with AI
            </p>
          </div>
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold">AI Image Generator</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowGallery(!showGallery)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                showGallery ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Gallery className="w-4 h-4" />
              Gallery
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {showGallery ? (
          <div>
            <h2 className="text-2xl font-bold mb-6">Your Gallery</h2>
            <GalleryGrid onSelect={(p) => {
              setPrompt(p.prompt);
              setSettings(p.settings);
              setShowGallery(false);
            }} />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleGenerate}
                disabled={isGenerating}
              />

              <GenerateButton
                isGenerating={isGenerating}
                onClick={handleGenerate}
                disabled={!prompt.trim()}
              />

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {prediction && prediction.status === 'succeeded' && prediction.output && (
                <ImageDisplay
                  images={prediction.output.map(url => ({ url, format: settings.outputFormat }))}
                  prompt={prompt}
                  onDownload={handleDownload}
                  onSave={handleSave}
                />
              )}

              {prediction && prediction.status === 'failed' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  Generation failed. Please try again.
                </div>
              )}

              {isGenerating && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    <span>Generating your image{prediction?.status === 'processing' && '...'}</span>
                  </div>
                  <p className="text-sm mt-2 text-blue-600">
                    This may take 5-30 seconds depending on model.
                  </p>
                </div>
              )}
            </div>

            <div>
              <SettingsPanel
                settings={settings}
                onChange={setSettings}
                disabled={isGenerating}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}