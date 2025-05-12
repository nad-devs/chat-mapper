'use client';

import * as React from 'react';
import { useActionState, startTransition } from 'react';
import { ChatInputForm } from '@/components/chat-input-form';
import { TopicDisplay } from '@/components/topic-display';
import type { ProcessedConversationResult, GenerateQuizResult } from '@/app/actions';
import { generateQuizTopicsAction } from '@/app/actions';
import { QuizDisplay } from '@/components/quiz-display';
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, ArrowLeft, BookOpen } from 'lucide-react'; // Added BookOpen
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link'; // Import Link for navigation

// Initial state for quiz generation action
const initialQuizState: GenerateQuizResult = { quizTopics: null, error: null };

// Define initial analysis state explicitly
const initialAnalysisState: ProcessedConversationResult = {
    topicsSummary: null,
    keyTopics: null,
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    error: null,
    originalConversationText: '',
};


export default function Home() {
  // State for initial conversation processing
  const [isLoadingAnalysis, setIsLoadingAnalysis] = React.useState(false);
  const [analysisResults, setAnalysisResults] = React.useState<ProcessedConversationResult | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null); // Separate state for error display

  // State for quiz generation and interaction
  const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
  const [isQuizzing, setIsQuizzing] = React.useState(false);
  const [quizTopics, setQuizTopics] = React.useState<QuizTopic[] | null>(null);
  const [rememberedTopics, setRememberedTopics] = React.useState<QuizTopic[]>([]);
  const [reviewTopics, setReviewTopics] = React.useState<QuizTopic[]>([]);
  const [showQuizSummary, setShowQuizSummary] = React.useState(false);


  const { toast } = useToast();

  // Quiz Generation Action State
  const [quizState, generateQuizAction, isQuizActionPending] = useActionState(generateQuizTopicsAction, initialQuizState);

  // --- Handlers for Analysis ---
  const handleAnalysisStart = React.useCallback(() => {
    console.log('[Page] Analysis Processing started.');
    setIsLoadingAnalysis(true);
    setAnalysisResults(null); // Clear previous results
    setAnalysisError(null); // Clear previous errors
    // Reset quiz states as well
    setIsGeneratingQuiz(false);
    setIsQuizzing(false);
    setQuizTopics(null);
    setRememberedTopics([]);
    setReviewTopics([]);
    setShowQuizSummary(false);
  }, []);

  const handleAnalysisComplete = React.useCallback((processedResults: ProcessedConversationResult | null) => {
    console.log('[Page] Analysis Processing complete.');
    setIsLoadingAnalysis(false); // Stop loading indicator

    if (processedResults) {
        console.log('[Page] Received analysis results:', JSON.stringify(processedResults, null, 2));
        setAnalysisResults(processedResults); // Store results (even if they contain an error field)
        setAnalysisError(processedResults.error ?? null); // Store potential processing error message for display

        if (processedResults.error) {
            console.error(`[Page] Analysis completed with processing error: ${processedResults.error}`);
             toast({
                title: "Analysis Partially Complete",
                description: `There was an error during analysis: ${processedResults.error}. Some results might be missing.`,
                variant: "destructive",
                duration: 9000
             });
        } else if (processedResults.studyNotes && processedResults.studyNotes.trim().length > 0) {
            console.log("[Page] Analysis completed successfully. Notes generated.");
            toast({
                title: "Analysis Complete",
                description: "Conversation analyzed. You can now review insights.",
                duration: 5000
            });
        } else {
             console.log("[Page] Analysis completed successfully, but no study notes were generated.");
             toast({
                title: "Analysis Complete",
                description: "Conversation analyzed, but no specific study notes were generated this time.",
                duration: 5000
             });
        }
    } else {
        const errorMsg = "Processing finished, but no results were returned. Please check logs or try again.";
        console.error('[Page] Analysis processing returned null or invalid results.');
        setAnalysisResults(null);
        setAnalysisError(errorMsg); // Set error message for display
        toast({
           title: "Processing Error",
           description: errorMsg,
           variant: "destructive",
           duration: 9000
        });
    }
  }, [toast]);


  // --- Handler for Starting Quiz Generation ---
  const handleStartQuizGeneration = () => {
    if (!analysisResults?.originalConversationText) {
        toast({ title: "Error", description: "Cannot start quiz without conversation text.", variant: "destructive" });
        return;
    }
    console.log('[Page] Starting quiz generation...');
    setIsGeneratingQuiz(true);
    setShowQuizSummary(false);
    setRememberedTopics([]);
    setReviewTopics([]);

    const formData = new FormData();
    formData.append('conversationText', analysisResults.originalConversationText);
    startTransition(() => {
        generateQuizAction(formData);
    });
  };

   // --- Effect to handle Quiz Generation Action Results ---
  React.useEffect(() => {
    if (!isQuizActionPending && quizState !== initialQuizState) {
      console.log('[Page Effect] Quiz Generation Action state received:', quizState);
      setIsGeneratingQuiz(false);

      if (quizState.error) {
        console.error('[Page Effect] Quiz generation failed:', quizState.error);
        toast({ title: "Quiz Generation Info", description: quizState.error, variant: "destructive" });
        setQuizTopics(null);
        setIsQuizzing(false);
      } else if (quizState.quizTopics && quizState.quizTopics.length > 0) {
        console.log('[Page Effect] Quiz topics generated successfully.');
        setQuizTopics(quizState.quizTopics);
        setIsQuizzing(true);
        setShowQuizSummary(false);
      } else {
         console.log('[Page Effect] No quiz topics could be generated from this conversation.');
         toast({ title: "Quiz Info", description: "Could not generate specific quiz topics from this conversation." });
         setQuizTopics(null);
         setIsQuizzing(false);
      }
    }
  }, [quizState, isQuizActionPending, toast]);


   // --- Handlers for Quiz Interaction ---
  const handleQuizComplete = React.useCallback((remembered: QuizTopic[], review: QuizTopic[]) => {
    console.log('[Page] Quiz completed.');
    setRememberedTopics(remembered);
    setReviewTopics(review);
    setIsQuizzing(false);
    setShowQuizSummary(true);
  }, []);


  // --- Handler for going back from Quiz Summary ---
  const handleRestartQuizFlow = () => {
    setShowQuizSummary(false);
    setIsQuizzing(false);
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center relative">
             <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mb-2 text-accent">
                <path d="M17.9998 19C17.8898 19.91 17.4898 20.74 16.8998 21.33C15.7398 22.49 13.9498 22.79 12.4098 22.11C12.1498 22 11.8598 22 11.5898 22.11C10.0498 22.79 8.25979 22.49 7.09979 21.33C6.50979 20.74 6.10979 19.91 5.99979 19H17.9998Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 19H6C3.79 19 2 17.21 2 15V10C2 7.79 3.79 6 6 6H18C20.21 6 22 7.79 22 10V15C22 17.21 20.21 19 18 19Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.25 12.75H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 12.75H11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 3.5C11.17 3.5 10.5 2.83 10.5 2C10.5 1.17 11.17 0.5 12 0.5C12.83 0.5 13.5 1.17 13.5 2C13.5 2.83 12.83 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">ChatMapper</h1>
          <p className="text-muted-foreground mt-2">
            Unravel your ChatGPT conversations. Extract topics, analyze code, get study notes, and test your recall.
          </p>
            <div className="mt-4">
                <Link href="/learnings" passHref>
                    <Button variant="outline">
                        <BookOpen className="mr-2 h-4 w-4" />
                        View My Learnings
                    </Button>
                </Link>
            </div>
        </header>

        {/* Hide input form during quiz or summary */}
        {!isQuizzing && !showQuizSummary && (
            <ChatInputForm
            onProcessingStart={handleAnalysisStart}
            onProcessingComplete={handleAnalysisComplete}
            isProcessing={isLoadingAnalysis}
            initialText={analysisError && analysisResults?.originalConversationText ? analysisResults.originalConversationText : ''}
            />
        )}


        {/* Loading Skeleton */}
        {isLoadingAnalysis && <LoadingSkeleton />}

         {!isLoadingAnalysis && analysisError && !isQuizzing && !showQuizSummary && (
             <div className="text-center text-red-500 dark:text-red-400 mt-6 p-4 border border-red-500/50 dark:border-red-400/50 bg-red-500/10 dark:bg-red-900/20 rounded-md">
                 Analysis Error: {analysisError}
             </div>
         )}


         {!isLoadingAnalysis && analysisResults && !isQuizzing && !showQuizSummary && (
             <>
                 <TopicDisplay
                    results={analysisResults}
                 />
                 {!analysisError && (analysisResults.topicsSummary || (analysisResults.keyTopics && analysisResults.keyTopics.length > 0)) && (
                    <div className="text-center mt-6">
                        <Button
                            onClick={handleStartQuizGeneration}
                            disabled={isGeneratingQuiz || isQuizActionPending}
                        >
                            {(isGeneratingQuiz || isQuizActionPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                            {(isGeneratingQuiz || isQuizActionPending) ? 'Generating Quiz...' : 'Start Recall Quiz'}
                        </Button>
                    </div>
                 )}
            </>
         )}


        {/* Display Quiz Interface */}
        {isQuizzing && quizTopics && (
            <QuizDisplay
                topics={quizTopics}
                onComplete={handleQuizComplete}
            />
        )}

        {/* Display Quiz Summary */}
        {showQuizSummary && (
            <QuizSummary
                remembered={rememberedTopics}
                review={reviewTopics}
                onRestart={handleRestartQuizFlow}
            />
        )}

        {!isLoadingAnalysis && !analysisResults && !isQuizzing && !showQuizSummary && (
            <div className="text-center text-muted-foreground mt-6">
              Enter a conversation above and click Analyze to generate insights.
            </div>
        )}

      </div>
    </main>
  );
}


function LoadingSkeleton() {
  return (
    <div className="w-full mt-6 space-y-6">
       <Skeleton className="h-10 w-full mb-4" />
      <div>
        <Skeleton className="h-6 w-1/3 mb-3" />
        <Skeleton className="h-20 w-full mb-4" />
        <Skeleton className="h-5 w-1/4 mb-2" />
        <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
        </div>
      </div>
       <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" />
        <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
        </div>
      </div>
      <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-1/2 mb-2" />
          <Skeleton className="h-16 w-full mb-4" />
          <Skeleton className="h-5 w-1/4 mb-2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
      <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

// --- Quiz Summary Component ---

interface QuizSummaryProps {
    remembered: QuizTopic[];
    review: QuizTopic[];
    onRestart: () => void;
}

function QuizSummary({ remembered, review, onRestart }: QuizSummaryProps) {
    return (
        <Card className="w-full mt-6">
            <CardHeader>
                <CardTitle>Quiz Summary</CardTitle>
                <CardDescription>Here's a breakdown of the topics you recalled and those marked for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="mr-2 h-5 w-5" /> Remembered Topics ({remembered.length})
                    </h3>
                    {remembered.length > 0 ? (
                        <ul className="space-y-2 list-disc pl-5 text-sm">
                            {remembered.map((item, index) => (
                                <li key={`remembered-${index}`}>
                                    <span className="font-medium">{item.topic}:</span> {item.context}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-sm italic">No topics marked as remembered.</p>
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="mr-2 h-5 w-5" /> Needs Review ({review.length})
                    </h3>
                    {review.length > 0 ? (
                        <ul className="space-y-2 list-disc pl-5 text-sm">
                            {review.map((item, index) => (
                                <li key={`review-${index}`}>
                                    <span className="font-medium">{item.topic}:</span> {item.context}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-sm italic">No topics marked for review.</p>
                    )}
                </div>
            </CardContent>
             <CardFooter>
                 <Button onClick={onRestart} variant="outline">
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analysis Results
                 </Button>
             </CardFooter>
        </Card>
    );
}
