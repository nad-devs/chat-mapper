'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { ChatInputForm } from '@/components/chat-input-form';
import { TopicDisplay } from '@/components/topic-display';
import type { ProcessedConversationResult, GenerateQuizResult } from '@/app/actions';
import { generateQuizTopicsAction } from '@/app/actions'; // Import the new action
import { QuizDisplay } from '@/components/quiz-display'; // Import the new Quiz component
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics'; // Import QuizTopic type
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Loader2, Brain } from 'lucide-react'; // Import icons
import { useToast } from "@/hooks/use-toast"

// Initial state for quiz generation action
const initialQuizState: GenerateQuizResult = { quizTopics: null, error: null };

export default function Home() {
  // State for initial conversation processing
  const [isLoadingAnalysis, setIsLoadingAnalysis] = React.useState(false);
  const [analysisResults, setAnalysisResults] = React.useState<ProcessedConversationResult | null>(null);

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
    console.log('[Page] Analysis Processing started.'); // Log start
    setIsLoadingAnalysis(true);
    setAnalysisResults(null); // Clear previous results
    // Reset quiz state when starting new analysis
    setIsGeneratingQuiz(false);
    setIsQuizzing(false);
    setQuizTopics(null);
    setRememberedTopics([]);
    setReviewTopics([]);
    setShowQuizSummary(false);
  }, []);

  const handleAnalysisComplete = React.useCallback((processedResults: ProcessedConversationResult | null) => {
    console.log('[Page] Analysis Processing complete. Results:', processedResults); // Log completion
    setAnalysisResults(processedResults);
    setIsLoadingAnalysis(false); // Explicitly set loading to false here
  }, []);

  // --- Handler for Starting Quiz Generation ---
  const handleStartQuizGeneration = () => {
    if (!analysisResults?.originalConversationText) {
        toast({ title: "Error", description: "Cannot start quiz without conversation text.", variant: "destructive" });
        return;
    }
    console.log('[Page] Starting quiz generation...');
    setIsGeneratingQuiz(true);
    setShowQuizSummary(false); // Hide previous summary if any
    setRememberedTopics([]);
    setReviewTopics([]);

    // Call the server action using FormData
    const formData = new FormData();
    formData.append('conversationText', analysisResults.originalConversationText);
    // formData.append('count', '5'); // Optional: Specify number of questions
    generateQuizAction(formData);
  };

   // --- Effect to handle Quiz Generation Action Results ---
  React.useEffect(() => {
    // Only react when the action is done (not pending) and the state is not the initial one
    if (!isQuizActionPending && quizState !== initialQuizState) {
      console.log('[Page Effect] Quiz Generation Action state received:', quizState);
      setIsGeneratingQuiz(false); // Generation finished (success or fail)

      if (quizState.error) {
        console.error('[Page Effect] Quiz generation failed:', quizState.error);
        toast({ title: "Quiz Error", description: quizState.error, variant: "destructive" });
        setQuizTopics(null);
        setIsQuizzing(false);
      } else if (quizState.quizTopics && quizState.quizTopics.length > 0) {
        console.log('[Page Effect] Quiz topics generated successfully.');
        setQuizTopics(quizState.quizTopics);
        setIsQuizzing(true); // Start the quiz interface
        setShowQuizSummary(false); // Ensure summary is hidden
      } else {
         console.log('[Page Effect] No quiz topics could be generated.');
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
    setShowQuizSummary(true); // Show the summary view
  }, []);


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center">
             <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mb-2 text-accent">
                <path d="M17.9998 19C17.8898 19.91 17.4898 20.74 16.8998 21.33C15.7398 22.49 13.9498 22.79 12.4098 22.11C12.1498 22 11.8598 22 11.5898 22.11C10.0498 22.79 8.25979 22.49 7.09979 21.33C6.50979 20.74 6.10979 19.91 5.99979 19H17.9998Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 19H6C3.79 19 2 17.21 2 15V10C2 7.79 3.79 6 6 6H18C20.21 6 22 7.79 22 10V15C22 17.21 20.21 19 18 19Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.25 12.75H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 12.75H11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 3.5C11.17 3.5 10.5 2.83 10.5 2C10.5 1.17 11.17 0.5 12 0.5C12.83 0.5 13.5 1.17 13.5 2C13.5 2.83 12.83 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">ChatMapper</h1>
          <p className="text-muted-foreground mt-2">
            Unravel your ChatGPT conversations. Extract topics, map concepts, analyze code, get study notes, and test your recall.
          </p>
        </header>

        {/* Hide input form during quiz */}
        {!isQuizzing && !showQuizSummary && (
            <ChatInputForm
            onProcessingStart={handleAnalysisStart}
            onProcessingComplete={handleAnalysisComplete}
            />
        )}


        {/* Loading/Results Display Logic */}
        {isLoadingAnalysis && <LoadingSkeleton />}

         {/* Display Analysis Results */}
        {!isLoadingAnalysis && analysisResults && !analysisResults.error && !isQuizzing && !showQuizSummary && (
            <>
                <TopicDisplay results={analysisResults} />
                {/* Add button to start quiz */}
                <div className="text-center mt-6">
                    <Button
                        onClick={handleStartQuizGeneration}
                        disabled={isGeneratingQuiz || isQuizActionPending}
                    >
                        {(isGeneratingQuiz || isQuizActionPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                        {(isGeneratingQuiz || isQuizActionPending) ? 'Generating Quiz...' : 'Start Recall Quiz'}
                    </Button>
                 </div>
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
            <QuizSummary remembered={rememberedTopics} review={reviewTopics} onRestart={() => setShowQuizSummary(false)} />
        )}

        {/* Initial State / Error Message */}
        {!isLoadingAnalysis && !analysisResults && !isQuizzing && !showQuizSummary && (
            <div className="text-center text-muted-foreground mt-6">
              Enter a conversation above and click Analyze to see the results.
            </div>
        )}
         {/* Display error from analysis */}
         {!isLoadingAnalysis && analysisResults?.error && !isQuizzing && !showQuizSummary && (
            <div className="text-center text-red-500 mt-6 p-4 border border-red-500/50 bg-red-500/10 rounded-md">
              Analysis Error: {analysisResults.error}
            </div>
        )}


      </div>
    </main>
  );
}


function LoadingSkeleton() {
  return (
    <div className="w-full mt-6 space-y-6">
       {/* Tabs Skeleton */}
       <Skeleton className="h-10 w-full mb-4" />

      {/* Overview Skeleton (Summary + Key Topics) */}
      <div>
        <Skeleton className="h-6 w-1/3 mb-3" /> {/* "Summary" title skeleton */}
        <Skeleton className="h-20 w-full mb-4" /> {/* Summary paragraph skeleton */}
        <Skeleton className="h-5 w-1/4 mb-2" /> {/* "Key Topics" title skeleton */}
        <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
        </div>
      </div>

      {/* Concept Map Skeleton */}
       <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" /> {/* "Concept Map" title skeleton */}
        <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
        </div>
      </div>

      {/* Code Insight Skeleton */}
      <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" /> {/* "Code Insight" title skeleton */}
        <div className="space-y-4">
           {/* Skeleton for Learned Concept */}
          <Skeleton className="h-5 w-1/2 mb-2" /> {/* Concept title skeleton */}
          <Skeleton className="h-16 w-full mb-4" /> {/* Concept description skeleton */}
           {/* Skeleton for Final Code Snippet */}
          <Skeleton className="h-5 w-1/4 mb-2" /> {/* Code title skeleton */}
          <Skeleton className="h-32 w-full" /> {/* Code block skeleton */}
        </div>
      </div>

       {/* Study Notes Skeleton */}
      <div className="pt-4">
        <Skeleton className="h-6 w-1/3 mb-3" /> {/* "Study Notes" title skeleton */}
        <Skeleton className="h-24 w-full" /> {/* Notes content skeleton */}
      </div>
    </div>
  )
}

// --- Quiz Summary Component ---
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react'; // Icons for summary

interface QuizSummaryProps {
    remembered: QuizTopic[];
    review: QuizTopic[];
    onRestart: () => void; // Function to go back to analysis view
}

function QuizSummary({ remembered, review, onRestart }: QuizSummaryProps) {
    return (
        <Card className="w-full mt-6">
            <CardHeader>
                <CardTitle>Quiz Summary</CardTitle>
                <CardDescription>Here's a breakdown of the topics you recalled and those marked for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Remembered Topics */}
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center text-green-600">
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

                {/* Review Topics */}
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-600">
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
                 <Button onClick={onRestart} variant="outline">Back to Analysis</Button>
             </CardFooter>
        </Card>
    );
}
