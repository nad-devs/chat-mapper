
'use client';

import * as React from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { ProcessedConversationResult } from '@/app/actions';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TopicDisplay } from '@/components/topic-display'; // Reuse TopicDisplay
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, History } from 'lucide-react';

type GroupedAnalyses = {
    [date: string]: ProcessedConversationResult[];
};

export default function HistoryPage() {
    const [groupedAnalyses, setGroupedAnalyses] = React.useState<GroupedAnalyses>({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchAnalyses = async () => {
            setLoading(true);
            setError(null);
            try {
                const analysesCol = collection(db, 'analyses');
                const q = query(analysesCol, orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(q);

                const analyses: ProcessedConversationResult[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as ProcessedConversationResult;
                    // Convert Firestore Timestamp to JS Date for client-side processing
                    if (data.timestamp instanceof Timestamp) {
                        data.timestamp = data.timestamp.toDate();
                    }
                    analyses.push({ id: doc.id, ...data });
                });

                // Group analyses by date
                const grouped: GroupedAnalyses = analyses.reduce((acc, analysis) => {
                    const dateStr = analysis.timestamp instanceof Date
                        ? format(analysis.timestamp, 'yyyy-MM-dd') // Format date as YYYY-MM-DD
                        : 'Unknown Date'; // Fallback for invalid dates
                    if (!acc[dateStr]) {
                        acc[dateStr] = [];
                    }
                    acc[dateStr].push(analysis);
                    return acc;
                }, {} as GroupedAnalyses);

                setGroupedAnalyses(grouped);
            } catch (err) {
                console.error("Error fetching analyses: ", err);
                setError("Failed to load analysis history.");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyses();
    }, []);

     // Dummy function for notes update in TopicDisplay (not needed here)
    const handleNotesUpdate = () => {
        // In a real app, you might implement editing historical notes
        console.log("Note update triggered on history page (no-op)");
    };

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10">
            <div className="w-full max-w-4xl space-y-8">
                 <div className="flex justify-between items-center mb-6">
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analyzer
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <History className="h-7 w-7"/> Analysis History
                    </h1>
                    {/* Placeholder for potential actions like Delete All */}
                    <div></div>
                </div>


                {loading && <HistoryLoadingSkeleton />}

                {error && (
                    <Card className="w-full border-destructive bg-destructive/10">
                        <CardHeader>
                            <CardTitle className="text-destructive">Error Loading History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>{error}</p>
                        </CardContent>
                    </Card>
                )}

                {!loading && !error && Object.keys(groupedAnalyses).length === 0 && (
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle>No History Found</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">You haven't analyzed any conversations yet. Go back to the <Link href="/" className="underline text-primary">analyzer</Link> to get started.</p>
                        </CardContent>
                    </Card>
                )}

                {!loading && !error && Object.keys(groupedAnalyses).length > 0 && (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {Object.entries(groupedAnalyses)
                           .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort dates descending
                           .map(([date, analyses]) => (
                            <AccordionItem value={date} key={date} className="border bg-card rounded-lg shadow-sm">
                                <AccordionTrigger className="px-6 py-4 text-lg font-semibold hover:no-underline">
                                    {format(new Date(date + 'T00:00:00'), 'MMMM d, yyyy')} {/* Format date nicely */}
                                    <span className="ml-2 text-sm font-normal text-muted-foreground">({analyses.length} {analyses.length === 1 ? 'entry' : 'entries'})</span>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-0">
                                     <div className="space-y-4">
                                        {analyses
                                            .sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime()) // Sort entries within the day
                                            .map((analysis) => (
                                            <Card key={analysis.id} className="overflow-hidden">
                                                <CardHeader className="bg-muted/50 p-4">
                                                    <CardTitle className="text-base">
                                                        Analysis from {analysis.timestamp instanceof Date ? format(analysis.timestamp, 'p') : 'Unknown Time'}
                                                    </CardTitle>
                                                    {analysis.category && <CardDescription>Category: {analysis.category}</CardDescription>}
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                     {/* Reuse TopicDisplay - Pass a dummy onNotesUpdate */}
                                                    <TopicDisplay results={analysis} onNotesUpdate={handleNotesUpdate} />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </main>
    );
}


function HistoryLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="w-full">
          <CardHeader className="flex flex-row justify-between items-center">
             <Skeleton className="h-6 w-1/3" />
             <Skeleton className="h-4 w-1/5" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
