'use client';

import * as React from 'react';
import { getLearningEntriesAction, type LearningEntry, type GetLearningEntriesResult } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIconLucide, AlertTriangle, ArrowLeft, FileText, Code, Edit3, Inbox, CalendarDays } from 'lucide-react'; // Inbox for empty state, CalendarDays
import Link from 'next/link';
import { format, isSameDay } from 'date-fns'; // For formatting dates and comparing days
import { Calendar } from '@/components/ui/calendar'; // ShadCN Calendar
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Simple Markdown-like renderer (copied from topic-display for consistency)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    line = line.trimStart().trimEnd();

    const renderInlineCode = (text: string) => {
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={partIndex} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{part.substring(1, part.length - 1)}</code>;
            }
            return part;
        });
    };

    const renderBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={partIndex}>{renderInlineCode(part.substring(2, part.length - 2))}</strong>;
        }
        return renderInlineCode(part);
        });
    };

    if (line.startsWith('### ')) { // Adjusted to H3 as in topic-display
      return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{renderBold(line.substring(4))}</h3>;
    }
     if (line.startsWith('## ')) { // H2
      return <h2 key={index} className="text-2xl font-semibold mt-6 mb-3 border-b pb-1">{renderBold(line.substring(3))}</h2>;
    }
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={index} className="ml-4">{renderBold(line.substring(2))}</li>;
    }
    if (line === '') {
        return <br key={index} />;
    }
    return (
      <p key={index} className="mb-2 last:mb-0">
        {renderBold(line)}
      </p>
    );
  });

   const groupedElements: React.ReactNode[] = [];
   let currentList: React.ReactNode[] = [];

   elements.forEach((el, index) => {
     const isListItem = React.isValidElement(el) && el.type === 'li';
     if (isListItem) {
       currentList.push(el);
     } else {
       if (currentList.length > 0) {
         groupedElements.push(<ul key={`ul-${index}`} className="space-y-1 mb-2 list-disc pl-5">{currentList}</ul>);
         currentList = [];
       }
       groupedElements.push(el);
     }
   });

   if (currentList.length > 0) {
     groupedElements.push(<ul key="ul-last" className="space-y-1 mb-2 list-disc pl-5">{currentList}</ul>);
   }
  return <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-2 prose-ul:my-2 prose-li:my-0 prose-li:marker:text-muted-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-strong:font-semibold text-foreground">{groupedElements}</div>;
};


export default function LearningsPage() {
  const [allLearnings, setAllLearnings] = React.useState<LearningEntry[] | null>(null);
  const [filteredLearnings, setFilteredLearnings] = React.useState<LearningEntry[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchLearnings() {
      setIsLoading(true);
      setError(null);
      try {
        const result: GetLearningEntriesResult = await getLearningEntriesAction();
        if (result.error) {
          setError(result.error);
          setAllLearnings(null);
        } else {
          setAllLearnings(result.entries);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to fetch learning entries.');
        setAllLearnings(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLearnings();
  }, []);

  React.useEffect(() => {
    if (selectedDate && allLearnings) {
      const newFilteredLearnings = allLearnings.filter(entry => {
        if (!entry.createdAtISO) return false;
        return isSameDay(new Date(entry.createdAtISO), selectedDate);
      }).sort((a, b) => new Date(b.createdAtISO!).getTime() - new Date(a.createdAtISO!).getTime()); // Sort by time, newest first
      setFilteredLearnings(newFilteredLearnings);
    } else {
      setFilteredLearnings([]); // Clear if no date selected or no allLearnings
    }
  }, [selectedDate, allLearnings]);


  const getEntryIcon = (type: LearningEntry['type']) => {
    switch (type) {
      case 'study-notes':
        return <Edit3 className="h-4 w-4 text-blue-500" />;
      case 'code-snippet':
        return <Code className="h-4 w-4 text-green-500" />;
      case 'summary':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getEntryTitle = (type: LearningEntry['type']) => {
    switch (type) {
      case 'study-notes':
        return "Study Notes";
      case 'code-snippet':
        return "Code Snippet";
      case 'summary':
        return "Conversation Summary";
      default:
        return "Entry";
    }
  };


  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
        <div className="w-full max-w-6xl space-y-8"> {/* Increased max-width */}
          <header className="text-center mb-8">
            <Skeleton className="h-10 w-1/2 mx-auto mb-2" />
            <Skeleton className="h-5 w-3/4 mx-auto" />
          </header>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/3 lg:w-1/4">
              <Skeleton className="h-[300px] w-full" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center justify-center">
                    <AlertTriangle className="mr-2 h-6 w-6" /> Error Fetching Learnings
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-destructive-foreground">{error}</p>
            </CardContent>
            <CardFooter>
                 <Link href="/" passHref className="w-full">
                    <Button variant="outline" className="w-full">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back Home
                    </Button>
                </Link>
            </CardFooter>
        </Card>
      </main>
    );
  }

  if (!isLoading && !allLearnings?.length) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
         <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center justify-center">
                     <Inbox className="mr-2 h-8 w-8 text-muted-foreground" />
                     No Learnings Yet
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You haven't saved any learnings. Analyze a conversation and save your insights!</p>
            </CardContent>
            <CardFooter>
                 <Link href="/" passHref className="w-full">
                    <Button className="w-full">
                         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analyzer
                    </Button>
                </Link>
            </CardFooter>
        </Card>
      </main>
    );
  }


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
      <div className="w-full max-w-6xl space-y-8"> {/* Increased max-width */}
        <header className="text-center mb-8 relative">
            <Link href="/" passHref className="absolute left-0 top-1/2 -translate-y-1/2">
                <Button variant="outline" size="icon" aria-label="Back to Home">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">My Saved Learnings</h1>
          <p className="text-muted-foreground mt-2">Select a date from the calendar to view your entries.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-auto md:min-w-[280px] lg:min-w-[320px] flex justify-center md:justify-start">
            <Card className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border shadow"
                disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                initialFocus
              />
            </Card>
          </div>

          <div className="flex-1">
            {selectedDate ? (
              <>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Entries for {format(selectedDate, "MMMM d, yyyy")}
                </h2>
                {filteredLearnings.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4"> {/* Added ScrollArea */}
                    <div className="space-y-4">
                      {filteredLearnings.map((entry) => (
                        <Card key={entry.id} className="overflow-hidden shadow-sm bg-card">
                          <CardHeader className="bg-muted/30 p-4 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {getEntryIcon(entry.type)}
                              {entry.topicName || getEntryTitle(entry.type)}
                            </CardTitle>
                            {entry.createdAtISO && (
                               <CardDescription className="text-xs pt-1">
                                 Saved at: {format(new Date(entry.createdAtISO), "h:mm a")}
                               </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="p-4">
                            {entry.type === 'code-snippet' ? (
                              <ScrollArea className="max-h-[300px] w-full">
                                <pre className="p-3 text-xs bg-background/50 text-foreground whitespace-pre-wrap break-words rounded-md border">
                                  <code>{entry.content}</code>
                                </pre>
                              </ScrollArea>
                            ) : (
                              <SimpleMarkdownRenderer content={entry.content} />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Card className="flex flex-col items-center justify-center p-10 text-center bg-card">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No entries found for this date.</p>
                  </Card>
                )}
              </>
            ) : (
              <Card className="flex flex-col items-center justify-center p-10 text-center bg-card">
                 <CalendarIconLucide className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Please select a date from the calendar to view your learning entries.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

