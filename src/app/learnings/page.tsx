

'use client';

import * as React from 'react';
import { getLearningEntriesAction, updateEntryCategoryAction, type LearningEntry, type GetLearningEntriesResult, type UpdateEntryCategoryResult } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Inbox, CalendarDays, Folder, FileText, Code, Lightbulb, Archive, Edit, Save, X, Tag, Loader2 } from 'lucide-react'; // Added Loader2
import Link from 'next/link';
import { format, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useActionState, startTransition } from 'react';


// Updated Markdown-like renderer to handle basic formatting (lists, bold, code)
// Consistent with the one used in TopicDisplay
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    const trimmedLine = line.trim();

    // Render inline code `` `code` ``
    const renderInlineCode = (text: string) => {
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={partIndex} className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-foreground">{part.substring(1, part.length - 1)}</code>;
            }
            return part;
        });
    };

    // Render bold **text**
    const renderBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={partIndex} className="font-semibold">{renderInlineCode(part.substring(2, part.length - 2))}</strong>;
        }
        return renderInlineCode(part);
        });
    };

    if (trimmedLine.startsWith('### ')) {
      return <h3 key={index} className="text-base font-semibold mt-4 mb-2 text-primary">{renderBold(trimmedLine.substring(4))}</h3>;
    }
    // Handle bullet points (* or -)
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      return <li key={index} className="ml-5 list-disc">{renderBold(trimmedLine.substring(2))}</li>;
    }
    // Handle numbered lists (1.)
    if (/^\d+\.\s/.test(trimmedLine)) {
         const match = trimmedLine.match(/^(\d+\.\s)(.*)/);
         if (match) {
            return <li key={index} value={parseInt(match[1], 10)} className="ml-5">{renderBold(match[2])}</li>;
         }
    }
    // Handle code blocks ```python ... ``` (simple display)
    if (trimmedLine.startsWith('```')) {
       return <pre key={index} className="my-2 p-3 text-xs bg-muted text-foreground whitespace-pre-wrap break-words rounded-md border"><code className="font-mono">{line}</code></pre>;
    }
    // Handle empty lines as breaks
    if (trimmedLine === '') {
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
   let listType: 'ul' | 'ol' | null = null;

   elements.forEach((el, index) => {
     const isListItem = React.isValidElement(el) && el.type === 'li';

     if (isListItem) {
       const currentListType = el.props.value === undefined ? 'ul' : 'ol';
       if (listType && listType !== currentListType) {
         const ListComponent = listType === 'ol' ? 'ol' : 'ul';
         const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
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
         const ListComponent = listType === 'ol' ? 'ol' : 'ul';
         const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
         groupedElements.push(<ListComponent key={`list-${index}`} className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
         currentList = [];
         listType = null;
       }
       groupedElements.push(el);
     }
   });

   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }
  // Apply base styling for readability
  return <div className="text-sm text-foreground dark:text-foreground/90">{groupedElements}</div>;
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

  const { toast } = useToast();

  // State for category editing
  const [editingCategoryEntryId, setEditingCategoryEntryId] = React.useState<string | null>(null);
  const [currentEditCategoryValue, setCurrentEditCategoryValue] = React.useState<string>('');
  const [updateCategoryState, updateCategoryFormAction, isUpdateCategoryPending] = useActionState(updateEntryCategoryAction, null);


  const fetchLearnings = React.useCallback(async () => {
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
  }, []);

  React.useEffect(() => {
    fetchLearnings();
  }, [fetchLearnings]);

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
      // Preserve active accordion items if they still exist, otherwise open all new ones
      setActiveAccordionItems(prev => {
        const newActiveItems = Object.keys(grouped);
        if (prev.every(item => newActiveItems.includes(item)) && prev.length === newActiveItems.length) {
          return prev;
        }
        return newActiveItems;
      });


    } else {
      setGroupedLearnings({});
       setActiveAccordionItems([]);
    }
  }, [selectedDate, allLearnings]);

  // Effect to handle category update action result
  React.useEffect(() => {
    if (updateCategoryState) {
        if (updateCategoryState.success && updateCategoryState.info) {
            toast({ title: "Category Updated", description: updateCategoryState.info });
            setEditingCategoryEntryId(null); // Close editor
            setCurrentEditCategoryValue('');
            fetchLearnings(); // Re-fetch to reflect changes
        } else if (updateCategoryState.error) {
            toast({ title: "Update Failed", description: updateCategoryState.error, variant: "destructive" });
        }
    }
  }, [updateCategoryState, toast, fetchLearnings]);


  const handleEditCategory = (entry: LearningEntry) => {
    if (entry.id) {
      setEditingCategoryEntryId(entry.id);
      setCurrentEditCategoryValue(entry.category || '');
    }
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategoryEntryId(null);
    setCurrentEditCategoryValue('');
  };

  const handleSaveCategoryEdit = (entryId: string) => {
    const formData = new FormData();
    formData.append('entryId', entryId);
    formData.append('newCategory', currentEditCategoryValue);
    startTransition(() => {
        updateCategoryFormAction(formData);
    });
  };


  if (isLoading && !allLearnings) { // Only show full page skeleton on initial load
    return (
      <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-background text-foreground">
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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background text-foreground">
        <Card className="w-full max-w-md bg-card text-card-foreground border-destructive shadow-lg">
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
                    <Button variant="outline" className="w-full border-border text-foreground hover:bg-accent hover:text-accent-foreground">
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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background text-foreground">
         <Card className="w-full max-w-md bg-card text-card-foreground border-border shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center justify-center text-foreground">
                     <Inbox className="mr-2 h-8 w-8 text-muted-foreground" />
                     No Learnings Yet
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You haven't saved any learnings. Analyze a conversation and save your insights!</p>
            </CardContent>
            <CardFooter>
                 <Link href="/" passHref className="w-full">
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analyzer
                    </Button>
                </Link>
            </CardFooter>
        </Card>
      </main>
    );
  }


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 lg:p-24 bg-background text-foreground">
      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center mb-8 relative">
            <Link href="/" passHref className="absolute left-0 top-1/2 -translate-y-1/2">
                <Button variant="outline" size="icon" aria-label="Back to Home" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">My Saved Learnings</h1>
          <p className="text-muted-foreground mt-2">Browse your saved entries by category. Use the calendar to filter by date.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Calendar Section */}
          <div className="md:w-auto md:min-w-[280px] lg:min-w-[320px] flex justify-center md:justify-start">
             {/* Apply card styling to calendar container */}
            <Card className="p-0 bg-card text-card-foreground border-border shadow-sm">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                // Ensure calendar styles inherit correctly
                className="rounded-md border-0 shadow-none [&_button]:text-foreground [&_button[aria-selected]]:bg-primary [&_button[aria-selected]]:text-primary-foreground [&_button:disabled]:text-muted-foreground [&_button]:border-border"
                disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                initialFocus
              />
               {selectedDate && (
                    <div className="p-3 border-t border-border text-center">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)} className="text-foreground hover:bg-accent hover:text-accent-foreground">
                            Clear Date Filter
                        </Button>
                    </div>
                )}
            </Card>
          </div>

          {/* Entries Section */}
          <div className="flex-1">
             <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {selectedDate ? `Entries for ${format(selectedDate, "MMMM d, yyyy")}` : "All Entries"} by Category
            </h2>
            {isLoading && <Skeleton className="h-40 w-full" />} 
            {!isLoading && Object.keys(groupedLearnings).length > 0 ? (
                 <Accordion
                    type="multiple"
                    value={activeAccordionItems}
                    onValueChange={setActiveAccordionItems}
                    className="w-full space-y-2"
                >
                {Object.entries(groupedLearnings)
                  .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
                  .map(([category, entries]) => (
                  <AccordionItem value={category} key={category} className="border border-border bg-card rounded-lg shadow-sm overflow-hidden">
                     {/* Style Accordion Trigger */}
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 text-lg font-medium text-foreground [&[data-state=open]>svg]:text-accent">
                       <div className="flex items-center gap-2">
                           <Folder className="h-5 w-5 text-accent" />
                           {category} ({entries.length})
                       </div>
                    </AccordionTrigger>
                    {/* Style Accordion Content */}
                    <AccordionContent className="px-4 pb-4 pt-0 bg-background/50 dark:bg-background/20">
                        <ScrollArea className="h-[500px] pr-3 -mr-3">
                             <div className="space-y-4 pt-2">
                                {entries.map((entry) => (
                                     // Style individual entry card
                                    <Card key={entry.id} className="overflow-hidden shadow-sm bg-card text-card-foreground border border-border/50">
                                        <CardHeader className="bg-muted/50 dark:bg-muted/20 p-3 border-b border-border/50">
                                            <CardTitle className="text-base flex items-center justify-between text-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Archive className="h-4 w-4 text-primary" />
                                                    {entry.topicName}
                                                </div>
                                            </CardTitle>
                                            {entry.createdAtISO && (
                                            <CardDescription className="text-xs pt-1 text-muted-foreground">
                                                Saved at: {format(new Date(entry.createdAtISO), "h:mm a")}
                                                {!selectedDate && ` on ${format(new Date(entry.createdAtISO), "MMM d, yyyy")}`}
                                            </CardDescription>
                                            )}
                                        </CardHeader>
                                        <CardContent className="p-3 space-y-4">
                                            {/* Category Display/Edit */}
                                            <div className="mb-2">
                                                <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                                                {editingCategoryEntryId === entry.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="text"
                                                            value={currentEditCategoryValue}
                                                            onChange={(e) => setCurrentEditCategoryValue(e.target.value)}
                                                            placeholder="Enter category (or leave blank)"
                                                            className="h-8 text-sm"
                                                        />
                                                        <Button size="icon" variant="ghost" onClick={() => handleSaveCategoryEdit(entry.id!)} disabled={isUpdateCategoryPending} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10">
                                                            {isUpdateCategoryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={handleCancelCategoryEdit} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={entry.category ? "secondary" : "outline"} className="text-xs cursor-default">
                                                            <Tag className="h-3 w-3 mr-1.5" />
                                                            {entry.category || 'Uncategorized'}
                                                        </Badge>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditCategory(entry)} className="h-6 w-6 text-muted-foreground hover:text-primary">
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Display Learning Summary */}
                                            {entry.learningSummary && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground"><FileText className="h-4 w-4" /> Learning Summary</h4>
                                                     {/* Ensure rendered content has good contrast */}
                                                    <div className="bg-secondary/30 dark:bg-secondary/10 p-3 rounded-md border border-border/50 text-foreground">
                                                      <SimpleMarkdownRenderer content={entry.learningSummary} />
                                                    </div>
                                                </div>
                                            )}
                                            {/* Display Study Notes */}
                                            {entry.studyNotesContent && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground"><Lightbulb className="h-4 w-4" /> Study Notes</h4>
                                                    <div className="bg-secondary/30 dark:bg-secondary/10 p-3 rounded-md border border-border/50 text-foreground">
                                                      <SimpleMarkdownRenderer content={entry.studyNotesContent} />
                                                    </div>
                                                </div>
                                            )}
                                            {/* Display Code Snippet */}
                                            {entry.codeSnippetContent && (
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-secondary-foreground">
                                                        <Code className="h-4 w-4" /> Code Snippet
                                                        {entry.codeLanguage && <Badge variant="secondary" size="sm" className="ml-auto text-xs">{entry.codeLanguage}</Badge>}
                                                    </h4>
                                                    <ScrollArea className="max-h-[300px] w-full">
                                                         {/* Ensure code block styling has good contrast */}
                                                        <pre className="p-3 text-xs bg-muted/50 dark:bg-muted/30 text-foreground whitespace-pre-wrap break-words rounded-md border border-border/50 font-mono">
                                                            <code>{entry.codeSnippetContent}</code>
                                                        </pre>
                                                    </ScrollArea>
                                                </div>
                                            )}
                                             {/* Fallback message */}
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
               // Style for "No entries found" card
              <Card className="flex flex-col items-center justify-center p-10 text-center bg-card text-card-foreground border-border shadow-sm">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                    {selectedDate ? "No entries found for this date." : "No entries found matching the current filter."}
                </p>
                 {selectedDate && (
                    <Button variant="link" onClick={() => setSelectedDate(undefined)} className="mt-4 text-primary hover:underline">
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


