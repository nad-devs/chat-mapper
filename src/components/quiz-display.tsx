
'use client';

import * as React from 'react';
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, HelpCircle, XCircle, ArrowRight, CheckCircle } from 'lucide-react'; // Import more icons

interface QuizDisplayProps {
    topics: QuizTopic[];
    onComplete: (remembered: QuizTopic[], review: QuizTopic[]) => void;
}

export function QuizDisplay({ topics, onComplete }: QuizDisplayProps) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [remembered, setRemembered] = React.useState<QuizTopic[]>([]);
    const [review, setReview] = React.useState<QuizTopic[]>([]);
    const [showAnswer, setShowAnswer] = React.useState(false); // State for showing answer

    const totalTopics = topics.length;
    const currentTopic = topics[currentIndex];
    const isLastQuestion = currentIndex === totalTopics - 1;

    const handleRemembered = () => {
        if (!currentTopic) return;
        setRemembered(prev => [...prev, currentTopic]);
        moveToNext();
    };

    const handleNeedsReview = () => {
        if (!currentTopic) return;
        setReview(prev => [...prev, currentTopic]);
        moveToNext();
    };

    const moveToNext = () => {
        setShowAnswer(false); // Hide answer for the next question

        if (isLastQuestion) {
            // Call onComplete with the final lists *after* state updates
            // Use temporary variables to pass the most up-to-date lists immediately
            const finalRemembered = remembered.includes(currentTopic) ? remembered : [...remembered, currentTopic]; // Ensure current state is captured if just decided
            const finalReview = review.includes(currentTopic) ? review : [...review, currentTopic]; // Ensure current state is captured if just decided

            // Need to filter based on the *last* action taken if the user clicks multiple times before moving
            let finalRememberedFiltered = finalRemembered;
            let finalReviewFiltered = finalReview;
             if (remembered.includes(currentTopic)) { // Check if remembered includes the current topic due to the last action
                finalReviewFiltered = finalReview.filter(t => t !== currentTopic);
            } else if (review.includes(currentTopic)) { // Check if review includes the current topic due to the last action
                 finalRememberedFiltered = finalRemembered.filter(t => t !== currentTopic);
            }

            onComplete(finalRememberedFiltered, finalReviewFiltered);
        } else {
            setCurrentIndex(currentIndex + 1);
        }
    };

     const toggleShowAnswer = () => {
        setShowAnswer(!showAnswer);
    };

     // Skip to next (called when showAnswer is false and button is clicked)
     const handleSkip = () => {
         if (!currentTopic) return;
         // Treat skip as needing review
         setReview(prev => [...prev, currentTopic]);
         moveToNext();
     }

    if (!currentTopic) {
        // Should ideally not happen if topics array is checked before rendering
        return <p>Loading quiz topic...</p>;
    }

    return (
         <div className="space-y-6">
             <div className="flex justify-between items-center mb-4">
                 <div className="text-sm text-muted-foreground">
                 Question {currentIndex + 1} of {totalTopics}
                 </div>
                 <div className="flex space-x-1">
                 {topics.map((_, i) => (
                     <div
                     key={i}
                     className={`h-1.5 w-6 rounded-full ${
                         i < currentIndex ? "bg-primary" : i === currentIndex ? "bg-primary/70 animate-pulse" : "bg-muted"
                     }`}
                     />
                 ))}
                 </div>
             </div>

             <Card className="border-2 border-border/50"> {/* Adjusted border */}
                 <CardContent className="pt-6">
                 <h3 className="text-xl font-medium mb-4">{currentTopic.topic}</h3>

                 {!showAnswer ? (
                     <div className="flex justify-center my-8">
                     <Button variant="outline" onClick={toggleShowAnswer} className="flex items-center">
                         <HelpCircle className="mr-2 h-4 w-4" />
                         Show Answer / Context
                     </Button>
                     </div>
                 ) : (
                     <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-md my-4 border border-border/50"> {/* Adjusted background and border */}
                     <p className="whitespace-pre-wrap text-sm text-foreground/90">{currentTopic.context}</p> {/* Adjusted text color */}
                     </div>
                 )}
                 </CardContent>
             </Card>

             <div className="flex justify-between pt-4">
                 {showAnswer ? (
                 <>
                     <Button
                         variant="outline"
                         onClick={handleNeedsReview}
                         className="flex-1 mr-2 border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                     >
                     <XCircle className="mr-2 h-4 w-4" />
                     Need to Review
                     </Button>
                     <Button
                         variant="outline" // Changed to outline to match Needs Review style
                         onClick={handleRemembered}
                         className="flex-1 ml-2 border-green-500/50 hover:bg-green-500/10 text-green-600 dark:text-green-400" // Adjusted classes
                     >
                     <CheckCircle className="mr-2 h-4 w-4" />I Remember This
                     </Button>
                 </>
                 ) : (
                 <Button variant="ghost" onClick={handleSkip} className="ml-auto"> {/* Changed onClick to handleSkip */}
                     Skip to Next
                     <ArrowRight className="ml-2 h-4 w-4" />
                 </Button>
                 )}
             </div>
         </div>
    );
}
