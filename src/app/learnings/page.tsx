'use client';

import * as React from 'react';
import { getLearningEntriesAction, type LearningEntry, type GetLearningEntriesResult } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Inbox, CalendarDays, Folder, FileText, Code, Lightbulb, Archive, CheckSquare } from 'lucide-react'; // Added CheckSquare
import Link from 'next/link';
import { format, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Updated Markdown-like renderer to handle checkmark bullets and general styling
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    line = line.trim(); // Trim both ends

    // Render inline code `` `code` ``
    const renderInlineCode = (text: string) => {
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={partIndex} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{part.substring(1, part.length - 1)}</code>;
            }
            return part;
        });
    };

    // Render bold **text**
    const renderBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={partIndex}>{renderInlineCode(part.substring(2, part.length - 2))}</strong>;
        }
        return renderInlineCode(part);
        });
    };

    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{renderBold(line.substring(4))}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-xl font-semibold mt-6 mb-3 border-b pb-1">{renderBold(line.substring(3))}</h2>;
    }
    // Handle checkmark bullets (✔)
    if (line.startsWith('✔ ')) {
        return <li key={index} className="ml-5 flex items-start gap-2"><CheckSquare className="h-4 w-4 text-green-500 mt-1 shrink-0" /><span>{renderBold(line.substring(2))}</span></li>;
    }
    // Handle regular bullets (* or -)
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={index} className="ml-5">{renderBold(line.substring(2))}</li>;
    }
    // Handle numbered lists (1.)
    if (/^\d+\.\s/.test(line)) {
         const match = line.match(/^(\d+\.\s)(.*)/);
         if (match) {
            return <li key={index} value={parseInt(match[1], 10)} className="ml-5">{renderBold(match[2])}</li>;
         }
    }
    // Handle empty lines as breaks
    if (line === '') {
        return <br key={index} />;
    }
    // Default paragraph rendering
    return (
      <p key={index} className="mb-2 last:mb-0">
        {renderBold(line)}
      </p>
    );
  });

   // Group list items correctly
   const groupedElements: React.ReactNode[] = [];
   let currentList: React.ReactNode[] = [];
   let listType: 'ul' | 'ol' | null = null; // Track list type

   elements.forEach((el, index) => {
     const isListItem = React.isValidElement(el) && el.type === 'li';
     const isCheckListItem = isListItem && el.props.children[0]?.type === CheckSquare; // Check if it's our custom checkmark li

     if (isListItem) {
       const currentListType = isCheckListItem || el.props.value === undefined ? 'ul' : 'ol';
       if (listType && listType !== currentListType) {
         // End previous list if type changes
         const ListComponent = listType === 'ol' ? 'ol' : 'ul';
         const listClass = listType === 'ol' ? "list-decimal" : (listType === 'ul' && React.isValidElement(currentList[0]) && currentList[0].props.children[0]?.type === CheckSquare ? "list-none" : "list-disc");
         groupedElements.push(<ListComponent key={`list-${index}-prev`} className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
         currentList = [];
         listType = null;
       }
       if (!listType) {
         listType = currentListType;
       }
       currentList.push(el);
     } else {
       if (currentList.length > 0 && listType) {
         // End current list
         const ListComponent = listType === 'ol' ? 'ol' : 'ul';
          const listClass = listType === 'ol' ? "list-decimal" : (listType === 'ul' && React.isValidElement(currentList[0]) && currentList[0].props.children[0]?.type === CheckSquare ? "list-none" : "list-disc");
         groupedElements.push(<ListComponent key={`list-${index}`} className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
         currentList = [];
         listType = null;
       }
       groupedElements.push(el); // Add non-list element
     }
   });

   // Add any remaining list
   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : (listType === 'ul' && React.isValidElement(currentList[0]) && currentList[0].props.children[0]?.type === CheckSquare ? "list-none" : "list-disc");
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }
  // Apply base prose styling
  return <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-li:marker:text-muted-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-strong:font-semibold text-foreground">{groupedElements}</div>;
};


// Define the type for grouped learnings
type GroupedLearnings = Record<string, LearningEntry[]>;

export default function LearningsPage() {
  const [allLearnings, setAllLearnings] = React.useState<LearningEntry[] | null>(null);
  const [groupedLearnings, setGroupedLearnings] = React.useState<GroupedLearnings>({});
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeAccordionItems, setActiveAccordionItems] = React.useState<string[]>([]);

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
          const sortedLearnings = result.entries?.sort((a, b) => new Date(b.createdAtISO!).getTime() - new Date(a.createdAtISO!).getTime()) ?? [];
          setAllLearnings(sortedLearnings);
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
    if (allLearnings) {
      const dateFilteredLearnings = selectedDate
        ? allLearnings.filter(entry => {
            if (!entry.createdAtISO) return false;
            return isSameDay(new Date(entry.createdAtISO), selectedDate);
          })
        : allLearnings;

      const grouped = dateFilteredLearnings.reduce((acc: GroupedLearnings, entry) => {
        const category = entry.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(entry);
        return acc;
      }, {});

      setGroupedLearnings(grouped);
      setActiveAccordionItems(Object.keys(grouped));

    } else {
      setGroupedLearnings({});
       setActiveAccordionItems([]);
    }
  }, [selectedDate, allLearnings]);


  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-gradient-to-br from-background to-secondary/10 dark:from-zinc-900 dark:to-zinc-800/50">
        <div className="w-full max-w-6xl space-y-8">
          <header className="text-center mb-8">
            <Skeleton className="h-10 w-1/2 mx-auto mb-2" />
            <Skeleton className="h-5 w-3/4 mx-auto" />
          </header>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/3 lg:w-1/4">
              <Skeleton className="h-[300px] w-full" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
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
      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center mb-8 relative">
            <Link href="/" passHref className="absolute left-0 top-1/2 -translate-y-1/2">
                <Button variant="outline" size="icon" aria-label="Back to Home">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">My Saved Learnings</h1>
          <p className="text-muted-foreground mt-2">Browse your saved entries by category. Use the calendar to filter by date.</p>
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
               {selectedDate && (
                    <div className="p-3 border-t text-center">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                            Clear Date Filter
                        </Button>
                    </div>
                )}
            </Card>
          </div>

          <div className="flex-1">
             <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {selectedDate ? `Entries for ${format(selectedDate, "MMMM d, yyyy")}` : "All Entries"} by Category
            </h2>
            {Object.keys(groupedLearnings).length > 0 ? (
                 <Accordion
                    type="multiple"
                    value={activeAccordionItems}
                    onValueChange={setActiveAccordionItems}
                    className="w-full space-y-2"
                >
                {Object.entries(groupedLearnings)
                  .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
                  .map(([category, entries]) => (
                  <AccordionItem value={category} key={category} className="border bg-card rounded-lg shadow-sm overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-lg font-medium">
                       <div className="flex items-center gap-2">
                           <Folder className="h-5 w-5 text-accent" />
                           {category} ({entries.length})
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <ScrollArea className="h-[500px] pr-3 -mr-3">
                             <div className="space-y-4 pt-2">
                                {entries.map((entry) => (
                                    <Card key={entry.id} className="overflow-hidden shadow-sm bg-background/50 dark:bg-background/20 border border-border/50">
                                        <CardHeader className="bg-muted/30 dark:bg-muted/10 p-3 border-b border-border/50">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Archive className="h-4 w-4 text-primary" /> {/* Generic icon for combined entry */}
                                                {entry.topicName}
                                            </CardTitle>
                                            {entry.createdAtISO && (
                                            <CardDescription className="text-xs pt-1">
                                                Saved at: {format(new Date(entry.createdAtISO), "h:mm a")}
                                                {!selectedDate && ` on ${format(new Date(entry.createdAtISO), "MMM d, yyyy")}`}
                                            </CardDescription>
                                            )}
                                        </CardHeader>
                                        <CardContent className="p-3 space-y-4">
                                            {/* Updated to display learningSummary */}
                                            {entry.learningSummary && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground"><FileText className="h-4 w-4" /> Learning Summary</h4>
                                                    <div className="bg-secondary/30 dark:bg-secondary/10 p-2 rounded-md border border-secondary/50 dark:border-secondary/20">
                                                      {/* Use the renderer for the new summary format */}
                                                      <SimpleMarkdownRenderer content={entry.learningSummary} />
                                                    </div>
                                                </div>
                                            )}
                                            {entry.studyNotesContent && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground"><Lightbulb className="h-4 w-4" /> Study Notes</h4>
                                                    <div className="bg-secondary/30 dark:bg-secondary/10 p-2 rounded-md border border-secondary/50 dark:border-secondary/20">
                                                      <SimpleMarkdownRenderer content={entry.studyNotesContent} />
                                                    </div>
                                                </div>
                                            )}
                                            {entry.codeSnippetContent && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground">
                                                        <Code className="h-4 w-4" /> Code Snippet
                                                        {entry.codeLanguage && <Badge variant="outline" size="sm" className="ml-auto text-xs">{entry.codeLanguage}</Badge>}
                                                    </h4>
                                                    <ScrollArea className="max-h-[300px] w-full">
                                                        <pre className="p-3 text-xs bg-background/50 dark:bg-muted/20 text-foreground whitespace-pre-wrap break-words rounded-md border">
                                                            <code>{entry.codeSnippetContent}</code>
                                                        </pre>
                                                    </ScrollArea>
                                                </div>
                                            )}
                                             {/* Fallback if no content fields are present */}
                                            {!entry.learningSummary && !entry.studyNotesContent && !entry.codeSnippetContent && (
                                                <p className="text-sm text-muted-foreground italic">No content saved for this entry.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Card className="flex flex-col items-center justify-center p-10 text-center bg-card">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                    {selectedDate ? "No entries found for this date." : "No entries found matching the current filter."}
                </p>
                 {selectedDate && (
                    <Button variant="link" onClick={() => setSelectedDate(undefined)} className="mt-4">
                        Show all entries
                    </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
