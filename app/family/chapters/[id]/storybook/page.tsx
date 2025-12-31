'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StorybookViewer } from '@/components/StorybookViewer';
import { Sparkles, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function StorybookPage() {
    const params = useParams();
    const chapterId = params.id as string;
    const [storybook, setStorybook] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (chapterId) {
            fetchStorybook();
        }
    }, [chapterId]);

    const fetchStorybook = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/storybooks/generate/${chapterId}`, { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                setStorybook(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const generateStorybook = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/storybooks/generate/${chapterId}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setStorybook(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto p-6">
            {!storybook ? (
                <div className="text-center py-20 bg-amber-50 rounded-xl border-2 border-dashed border-amber-200">
                    <h2 className="text-3xl font-bold text-amber-900 mb-4">Turn this Memory into Magic ✨</h2>
                    <p className="text-amber-800 mb-8 max-w-lg mx-auto">
                        Create a beautifully illustrated children's storybook from this story.
                        Perfect for sharing with grandchildren!
                    </p>
                    <Button
                        size="lg"
                        onClick={generateStorybook}
                        disabled={generating}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Writing Story & Painting Pictures...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate Storybook
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Storybook Preview</h2>
                        <Button variant="ghost" onClick={() => setStorybook(null)}>Close</Button>
                    </div>
                    <StorybookViewer storybook={storybook} />
                </div>
            )}
        </div>
    );
}
