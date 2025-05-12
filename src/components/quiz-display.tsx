'use client';

import * as React from 'react';
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, HelpCircle } from 'lucide-react'; // Import icons

interface QuizDisplayProps {
    topics: QuizTopic[];
    onComplete: (remembered: QuizTopic[], review: QuizTopic[]) => void;
}

export function QuizDisplay({ topics, onComplete }: QuizDisplayProps) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [remembered, setRemembered] = React.useState<QuizTopic[]>([]);
    const [review, setReview] = React.useState<QuizTopic[]>([]);

    const totalTopics = topics.length;
    const currentTopic = topics[currentIndex];
    const progress = totalTopics > 0 ? ((currentIndex + 1) / totalTopics) * 100 : 0;

    const handleNext = (status: 'remembered' | 'review') => {
        if (!currentTopic) return;

        if (status === 'remembered') {
            setRemembered(prev => [...prev, currentTopic]);
        } else {
            setReview(prev => [...prev, currentTopic]);
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex < totalTopics) {
            setCurrentIndex(nextIndex);
        } else {
            // Call onComplete with the final lists *after* state updates
             // Use a temporary variable to pass the most up-to-date lists
            const finalRemembered = status === 'remembered' ? [...remembered, currentTopic] : remembered;
            const finalReview = status === 'review' ? [...review, currentTopic] : review;
            onComplete(finalRemembered, finalReview);
        }
    };

    if (!currentTopic) {
        // Should ideally not happen if topics array is checked before rendering
        return <p>Loading quiz topic...</p>;
    }

    return (
        <Card className="w-full mt-6">
            <CardHeader>
                <CardTitle>Recall Quiz</CardTitle>
                <CardDescription>Review the topic and its context. Do you recall this well?</CardDescription>
                 <div className="pt-2">
                     <Progress value={progress} className="w-full h-2" />
                     <p className="text-xs text-muted-foreground text-right mt-1">Topic {currentIndex + 1} of {totalTopics}</p>
                 </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <h3 className="text-xl font-semibold">{currentTopic.topic}</h3>
                <p className="text-muted-foreground bg-secondary/20 p-3 rounded-md border border-secondary/30">
                    <span className="font-medium text-foreground">Context:</span> {currentTopic.context}
                </p>
            </CardContent>
            <CardFooter className="flex justify-between gap-4">
                <Button variant="outline" onClick={() => handleNext('review')} className="flex-1 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700">
                    <HelpCircle className="mr-2 h-4 w-4" /> Mark for Review
                </Button>
                <Button variant="default" onClick={() => handleNext('remembered')} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                     <Check className="mr-2 h-4 w-4" /> I Remember This
                </Button>
            </CardFooter>
        </Card>
    );
}