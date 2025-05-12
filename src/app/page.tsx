
'use client';

import * as React from 'react';
import { ChatInputForm } from '@/components/chat-input-form';
import { TopicDisplay } from '@/components/topic-display';
import type { ProcessedConversationResult } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<ProcessedConversationResult | null>(null);

 const handleProcessingStart = React.useCallback(() => {
    console.log('[Page] Processing started.'); // Log start
    setIsLoading(true);
    setResults(null); // Clear previous results
  }, []);

  const handleProcessingComplete = React.useCallback((processedResults: ProcessedConversationResult | null) => {
    console.log('[Page] Processing complete. Results:', processedResults); // Log completion
    setResults(processedResults);
    setIsLoading(false); // Ensure loading is set to false
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
            Unravel your ChatGPT conversations. Extract topics, map concepts, analyze code, and see the connections.
          </p>
        </header>

        <ChatInputForm
          onProcessingStart={handleProcessingStart}
          onProcessingComplete={handleProcessingComplete}
        />

        {isLoading && <LoadingSkeleton />}
        {/* Ensure results are only displayed when not loading AND results exist */}
        {!isLoading && results && <TopicDisplay results={results} />}
        {/* Optional: Handle case where not loading but results are null/empty explicitly */}
        {/* {!isLoading && !results && <div>Enter a conversation above and click Analyze.</div>} */}
        {/* {!isLoading && results && !results.topicsSummary && !(results.keyTopics?.length > 0) && !results.conceptsMap && !(results.codeAnalysis?.codeExamples?.length > 0) && <div>Analysis complete, but no specific information found.</div>} */}


      </div>
    </main>
  );
}


function LoadingSkeleton() {
  return (
    <div className="w-full mt-6 space-y-6">
      {/* Summary Skeleton */}
      <div>
        <Skeleton className="h-8 w-1/3 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
       {/* Key Topics Skeleton */}
      <div>
        <Skeleton className="h-6 w-1/4 mb-3" />
        <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
        </div>
      </div>
      {/* Concept Map Skeleton */}
       <div>
        <Skeleton className="h-8 w-1/3 mb-3" />
        <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
        </div>
      </div>
      {/* Code Analysis Skeleton */}
      <div>
        <Skeleton className="h-8 w-1/3 mb-3" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  )
}
