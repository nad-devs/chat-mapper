
'use client';

import * as React from 'react';
import { useActionState, startTransition } from 'react';
import { motion } from 'framer-motion'; // Import motion
import Link from 'next/link';
import { ChatInputForm } from '@/components/chat-input-form';
import { TopicDisplay } from '@/components/topic-display';
import type { ProcessedConversationResult, GenerateQuizResult } from '@/app/actions';
import { generateQuizTopicsAction } from '@/app/actions';
import { QuizDisplay } from '@/components/quiz-display';
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, ArrowLeft, BookOpen, Sparkles, CheckCircle, AlertCircle, Send, Code, Map, Tag, HelpCircle, ArrowRight, XCircle } from 'lucide-react'; // Added more icons
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// Initial state for quiz generation action
const initialQuizState: GenerateQuizResult = { quizTopics: null, error: null };

// Define initial analysis state explicitly
const initialAnalysisState: ProcessedConversationResult = {
    learningSummary: null,
    mainProblemOrTopicName: null, // Added
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
        // Ensure results are JSON serializable before setting state
         try {
            const serializableResult = JSON.parse(JSON.stringify(processedResults));
            setAnalysisResults(serializableResult);
            setAnalysisError(serializableResult.error ?? null); // Store potential processing error message for display

            if (serializableResult.error) {
                console.error(`[Page] Analysis completed with processing error: ${serializableResult.error}`);
                 toast({
                    title: "Analysis Partially Complete",
                    description: `There was an error during analysis: ${serializableResult.error}. Some results might be missing.`,
                    variant: "destructive",
                    duration: 9000
                 });
            // Check if either learningSummary or studyNotes were generated
            } else if ((serializableResult.learningSummary && serializableResult.learningSummary.trim().length > 0) || (serializableResult.studyNotes && serializableResult.studyNotes.trim().length > 0)) {
                console.log("[Page] Analysis completed successfully. Summary or Notes generated.");
                toast({
                    title: "Analysis Complete",
                    description: "Conversation analyzed. You can now review insights.",
                    duration: 5000
                });
            } else {
                 console.log("[Page] Analysis completed successfully, but no summary or study notes were generated.");
                 toast({
                    title: "Analysis Complete",
                    description: "Conversation analyzed, but no specific summary or study notes were generated this time.",
                    duration: 5000
                 });
            }
        } catch (stringifyError) {
            const errorMsg = "Failed to process and display analysis results due to serialization error.";
            console.error('[Page] Error serializing analysis results:', stringifyError);
            setAnalysisResults(null);
            setAnalysisError(errorMsg);
            toast({
               title: "Display Error",
               description: errorMsg,
               variant: "destructive",
               duration: 9000
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
         // Ensure quiz topics are serializable
         try {
             const serializableTopics = JSON.parse(JSON.stringify(quizState.quizTopics));
             setQuizTopics(serializableTopics);
             setIsQuizzing(true);
             setShowQuizSummary(false);
         } catch (stringifyError) {
             console.error('[Page Effect] Error serializing quiz topics:', stringifyError);
             toast({ title: "Quiz Error", description: "Failed to load quiz topics.", variant: "destructive" });
             setQuizTopics(null);
             setIsQuizzing(false);
         }

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
    // Ensure topics are serializable
    try {
        const serializableRemembered = JSON.parse(JSON.stringify(remembered));
        const serializableReview = JSON.parse(JSON.stringify(review));
        setRememberedTopics(serializableRemembered);
        setReviewTopics(serializableReview);
        setIsQuizzing(false);
        setShowQuizSummary(true);
     } catch (stringifyError) {
        console.error('[Page] Error serializing quiz results:', stringifyError);
        toast({ title: "Quiz Error", description: "Failed to save quiz results.", variant: "destructive" });
        // Optionally reset quiz state or show error
        setIsQuizzing(false);
        setShowQuizSummary(false); // Don't show summary if results can't be saved
     }
  }, [toast]);


  // --- Handler for going back from Quiz Summary ---
  const handleRestartQuizFlow = () => {
    setShowQuizSummary(false);
    setIsQuizzing(false);
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12 bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
       <div className="w-full max-w-4xl space-y-8">
         <motion.header
           className="text-center relative"
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
         >
           <div className="flex justify-center mb-4">
             <div className="relative">
               <svg
                 width="70"
                 height="70"
                 viewBox="0 0 24 24"
                 fill="none"
                 xmlns="http://www.w3.org/2000/svg"
                 className="text-primary"
               >
                 <path
                   d="M17.9998 19C17.8898 19.91 17.4898 20.74 16.8998 21.33C15.7398 22.49 13.9498 22.79 12.4098 22.11C12.1498 22 11.8598 22 11.5898 22.11C10.0498 22.79 8.25979 22.49 7.09979 21.33C6.50979 20.74 6.10979 19.91 5.99979 19H17.9998Z"
                   stroke="currentColor"
                   strokeWidth="1.5"
                   strokeMiterlimit="10"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
                 <path
                   d="M18 19H6C3.79 19 2 17.21 2 15V10C2 7.79 3.79 6 6 6H18C20.21 6 22 7.79 22 10V15C22 17.21 20.21 19 18 19Z"
                   stroke="currentColor"
                   strokeWidth="1.5"
                   strokeMiterlimit="10"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
                 <path
                   d="M14.25 12.75H16.5"
                   stroke="currentColor"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
                 <path
                   d="M7.5 12.75H11.25"
                   stroke="currentColor"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
                 <path
                   d="M12 3.5C11.17 3.5 10.5 2.83 10.5 2C10.5 1.17 11.17 0.5 12 0.5C12.83 0.5 13.5 1.17 13.5 2C13.5 2.83 12.83 3.5 12 3.5Z"
                   stroke="currentColor"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
               </svg>
               <motion.div
                 className="absolute -top-2 -right-2"
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 transition={{ delay: 0.3, duration: 0.5 }}
               >
                 <Sparkles className="h-6 w-6 text-yellow-500" />
               </motion.div>
             </div>
           </div>
           <h1 className="text-5xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
             ChatMapper
           </h1>
           <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-lg">
             Unravel your ChatGPT conversations. Extract topics, analyze code, get study notes, and test your recall.
           </p>
           <div className="mt-6">
             <Link href="/learnings" passHref>
               <Button variant="outline" size="lg" className="shadow-sm hover:shadow transition-all">
                 <BookOpen className="mr-2 h-5 w-5" />
                 View My Learnings
               </Button>
             </Link>
           </div>
         </motion.header>

         {/* Hide input form during quiz or summary */}
         {!isQuizzing && !showQuizSummary && (
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2, duration: 0.5 }}
           >
             <Card className="shadow-md border-border/50">
               <CardContent className="pt-6">
                 <ChatInputForm
                   onProcessingStart={handleAnalysisStart}
                   onProcessingComplete={handleAnalysisComplete}
                   isProcessing={isLoadingAnalysis}
                   initialText={
                     analysisError && analysisResults?.originalConversationText
                       ? analysisResults.originalConversationText
                       : ""
                   }
                 />
               </CardContent>
             </Card>
           </motion.div>
         )}

         {/* Loading Skeleton */}
         {isLoadingAnalysis && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
             <LoadingSkeleton />
           </motion.div>
         )}

         {!isLoadingAnalysis && analysisError && !isQuizzing && !showQuizSummary && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.3 }}
             className="text-center text-red-500 dark:text-red-400 mt-6 p-6 border border-red-500/50 dark:border-red-400/50 bg-red-500/10 dark:bg-red-900/20 rounded-md shadow-sm"
           >
             <AlertCircle className="h-8 w-8 mx-auto mb-2" />
             <h3 className="text-lg font-semibold mb-2">Analysis Error</h3>
             <p>{analysisError}</p>
           </motion.div>
         )}

         {!isLoadingAnalysis && analysisResults && !isQuizzing && !showQuizSummary && (
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1, duration: 0.5 }}
           >
             <TopicDisplay
                results={analysisResults} // Pass the results down
             />

             {/* Conditionally render quiz button */}
              {/* Check if results exist and are not errored, and have content */}
             {!analysisError &&
               analysisResults && // Ensure results object exists
               (analysisResults.learningSummary || (analysisResults.keyTopics && analysisResults.keyTopics.length > 0)) && (
                 <div className="text-center mt-8">
                   <Button
                     onClick={handleStartQuizGeneration}
                     disabled={isGeneratingQuiz || isQuizActionPending}
                     size="lg"
                     className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all"
                   >
                     {isGeneratingQuiz || isQuizActionPending ? (
                       <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     ) : (
                       <Brain className="mr-2 h-5 w-5" />
                     )}
                     {isGeneratingQuiz || isQuizActionPending ? "Generating Quiz..." : "Start Recall Quiz"}
                   </Button>
                 </div>
               )}
           </motion.div>
         )}

         {/* Display Quiz Interface */}
         {isQuizzing && quizTopics && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
             <Card className="shadow-lg border-border/50">
               <CardHeader>
                 <CardTitle className="text-2xl">Knowledge Recall Quiz</CardTitle>
                 <CardDescription>Test your understanding of the key concepts from this conversation</CardDescription>
               </CardHeader>
               <CardContent>
                 <QuizDisplay topics={quizTopics} onComplete={handleQuizComplete} />
               </CardContent>
             </Card>
           </motion.div>
         )}

         {/* Display Quiz Summary */}
         {showQuizSummary && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
             <QuizSummary remembered={rememberedTopics} review={reviewTopics} onRestart={handleRestartQuizFlow} />
           </motion.div>
         )}

          {/* Initial state message */}
         {!isLoadingAnalysis && !analysisResults && !isQuizzing && !showQuizSummary && (
           <motion.div
             className="text-center mt-12"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.3, duration: 0.5 }}
           >
             <Card className="bg-secondary/20 border-dashed border-2 border-border/50 p-8">
               <div className="flex flex-col items-center justify-center space-y-4">
                 <Brain className="h-12 w-12 text-muted-foreground/60" />
                 <h3 className="text-xl font-medium text-foreground">Ready to Map Your Conversations</h3>
                 <p className="text-muted-foreground max-w-md">
                   Paste a ChatGPT conversation above and click Analyze to extract key topics, generate study notes, and
                   create recall quizzes.
                 </p>
               </div>
             </Card>
           </motion.div>
         )}

       </div>
     </main>
  );
}

// Define LoadingSkeleton component here (copied from provided code, adjusted wrapping Card)
function LoadingSkeleton() {
  return (
    <Card className="w-full mt-6 space-y-6 p-6 shadow-md border-border/50">
       <div className="flex items-center justify-center mb-4">
         <Loader2 className="h-8 w-8 text-primary animate-spin" />
       </div>
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
    </Card>
  )
}

// --- Quiz Summary Component --- (Copied from provided code)
interface QuizSummaryProps {
    remembered: QuizTopic[];
    review: QuizTopic[];
    onRestart: () => void;
}

function QuizSummary({ remembered, review, onRestart }: QuizSummaryProps) {
    return (
        <Card className="w-full mt-6 shadow-lg border-border/50 overflow-hidden">
           <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-1"></div>
            <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                     <Brain className="mr-3 h-6 w-6 text-primary" /> Quiz Summary
                </CardTitle>
                <CardDescription>Here's a breakdown of the topics you recalled and those marked for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="mr-2 h-5 w-5" /> Remembered Topics ({remembered.length})
                    </h3>
                    {remembered.length > 0 ? (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                            <ul className="space-y-3 list-disc pl-5">
                                {remembered.map((item, index) => (
                                    <li key={`remembered-${index}`} className="text-sm">
                                        <span className="font-medium">{item.topic}:</span> {item.context}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-muted/30 rounded-lg p-4 text-center">
                           <p className="text-muted-foreground text-sm italic">No topics marked as remembered.</p>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-amber-600 dark:text-amber-400">
                        <AlertCircle className="mr-2 h-5 w-5" /> Needs Review ({review.length})
                    </h3>
                    {review.length > 0 ? (
                         <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                            <ul className="space-y-3 list-disc pl-5">
                                {review.map((item, index) => (
                                    <li key={`review-${index}`} className="text-sm">
                                        <span className="font-medium">{item.topic}:</span> {item.context}
                                    </li>
                                ))}
                            </ul>
                         </div>
                    ) : (
                         <div className="bg-muted/30 rounded-lg p-4 text-center">
                             <p className="text-muted-foreground text-sm italic">No topics marked for review.</p>
                         </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t bg-muted/20 p-4">
                 <p className="text-sm text-muted-foreground">
                     {remembered.length > 0 && review.length === 0
                         ? "Great job! You've remembered all topics."
                         : "Keep practicing the topics marked for review."}
                 </p>
                 <Button onClick={onRestart} variant="outline" className="shadow-sm">
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analysis Results
                 </Button>
             </CardFooter>
        </Card>
    );
}
