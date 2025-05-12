
import * as React from 'react';
import type { ProcessedConversationResult, SaveEntryResult } from '@/app/actions';
import { saveEntryAction } from '@/app/actions';
import { startTransition, useActionState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Folder, Archive, Loader2, Edit, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

// Simple renderer for plain text or basic markdown (like bullet points)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    line = line.trim();

    // Render inline code `` `code` ``
    const renderInlineCode = (text: string) => {
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            // Added styling for inline code
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

    // Handle bullet points (* or -)
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={index} className="ml-5 list-disc">{renderBold(line.substring(2))}</li>;
    }
     // Handle numbered lists (1.)
    if (/^\d+\.\s/.test(line)) {
         const match = line.match(/^(\d+\.\s)(.*)/);
         if (match) {
            return <li key={index} value={parseInt(match[1], 10)} className="ml-5">{renderBold(match[2])}</li>;
         }
    }
    // Handle empty lines as paragraph breaks
    if (line === '') {
        return <br key={index} />;
    }
    // Default paragraph rendering
    return <p key={index} className="mb-2 last:mb-0">{renderBold(line)}</p>;
  });

  // Group list items
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
       groupedElements.push(el); // Add non-list element
     }
   });

   // Add any remaining list
   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }

  // Apply base text styling
  return <div className="text-sm text-foreground dark:text-foreground/90">{groupedElements}</div>;
};

// Enhanced renderer for Study Notes (handles H3, lists, code)
const StudyNotesRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    const trimmedLine = line.trim();

    // Render inline code `` `code` ``
    const renderInlineCode = (text: string) => {
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            // Added styling for inline code
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
      return <h3 key={index} className="text-base font-semibold mt-4 mb-2 text-primary">{renderBold(trimmedLine.substring(4))}</h3>; // Use primary color for headings
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
    // Handle code blocks ```python ... ```
    if (trimmedLine.startsWith('```')) {
       // This is overly simplified, assumes single block. Need state for multi-line blocks.
       // For now, just render the line itself. A proper parser is needed for full support.
       // Consider using a markdown library for better code block handling if needed
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
         const listClass = listType === 'ol' ? "list-decimal" : "list-disc"; // Simplified list class
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
         const listClass = listType === 'ol' ? "list-decimal" : "list-disc"; // Simplified list class
         groupedElements.push(<ListComponent key={`list-${index}`} className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
         currentList = [];
         listType = null;
       }
       groupedElements.push(el);
     }
   });

   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : "list-disc"; // Simplified list class
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }
   // Apply base styling for readability
   return <div className="text-sm text-foreground dark:text-foreground/90">{groupedElements}</div>;
};


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { toast } = useToast();
  const [saveState, saveFormAction, isSaving] = useActionState(saveEntryAction, null);

  const { learningSummary, keyTopics, category, conceptsMap, codeAnalysis, studyNotes } = results;

  // Use category as title if available, otherwise a default
  const displayTitle = category || "Analysis Results";

  // Determine a topic name suitable for saving
  const topicNameToSave = codeAnalysis?.learnedConcept || (keyTopics && keyTopics.length > 0 ? keyTopics[0] : null) || category || "Untitled Learning";

  // State for editing Study Notes
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [editedNotes, setEditedNotes] = React.useState(studyNotes || '');

  // State for editing Learning Summary
  const [isEditingSummary, setIsEditingSummary] = React.useState(false);
  const [editedSummary, setEditedSummary] = React.useState(learningSummary || '');

  // Update local state if the results prop changes (e.g., new analysis)
  React.useEffect(() => {
    setEditedNotes(studyNotes || '');
    setEditedSummary(learningSummary || '');
    setIsEditingNotes(false); // Reset editing state on new analysis
    setIsEditingSummary(false);
  }, [studyNotes, learningSummary]);

  React.useEffect(() => {
    if (saveState) {
      if (saveState.success && saveState.info) {
        toast({ title: "Success", description: saveState.info });
      } else if (saveState.error) {
        toast({ title: "Error Saving", description: saveState.error, variant: "destructive" });
      }
    }
  }, [saveState, toast]);


  const handleSaveAllInsights = () => {
    // Use the potentially EDITED notes and summary, but original code
    const summaryToSave = editedSummary; // Use edited summary
    const codeSnippetToSave = results.codeAnalysis?.finalCodeSnippet;
    const codeLangToSave = results.codeAnalysis?.codeLanguage;
    const notesToSave = editedNotes; // Use edited notes

    const formData = new FormData();
    formData.append('topicName', topicNameToSave); // Use the derived topic name
    if (category) { // Use the original category for saving
      formData.append('category', category);
    }
    if (summaryToSave && summaryToSave.trim().length > 0) {
      formData.append('learningSummary', summaryToSave); // Changed field name
    }
    if (codeSnippetToSave && codeSnippetToSave.trim().length > 0) {
      formData.append('codeSnippetContent', codeSnippetToSave);
      if (codeLangToSave) {
        formData.append('codeLanguage', codeLangToSave);
      }
    }
    if (notesToSave && notesToSave.trim().length > 0) {
      formData.append('studyNotesContent', notesToSave);
    }

    // Check if at least one content field has data
    if (!formData.has('learningSummary') && !formData.has('codeSnippetContent') && !formData.has('studyNotesContent')) {
        toast({ title: "Nothing to Save", description: "No content available to save from this analysis." });
        return;
    }

    startTransition(() => {
        saveFormAction(formData);
    });
  };

  // --- Handlers for Editing ---

  // Study Notes Edit
  const handleEditNotes = () => {
    setEditedNotes(studyNotes || '');
    setIsEditingNotes(true);
  };
  const handleSaveNotesEdit = () => setIsEditingNotes(false);
  const handleCancelNotesEdit = () => {
    setEditedNotes(studyNotes || '');
    setIsEditingNotes(false);
  };

  // Learning Summary Edit
  const handleEditSummary = () => {
    setEditedSummary(learningSummary || '');
    setIsEditingSummary(true);
  };
  const handleSaveSummaryEdit = () => setIsEditingSummary(false);
  const handleCancelSummaryEdit = () => {
    setEditedSummary(learningSummary || '');
    setIsEditingSummary(false);
  };

  // --- Content Checks ---
  // Check content based on *original* results and edited states
  const originalSummaryExists = !!learningSummary && learningSummary.trim().length > 0;
  const originalNotesExist = !!studyNotes && studyNotes.trim().length > 0;
  const originalCodeExists = !!codeAnalysis?.finalCodeSnippet && codeAnalysis.finalCodeSnippet.trim().length > 0;

  const hasOverviewContent = originalSummaryExists || (keyTopics && keyTopics.length > 0) || isEditingSummary;
  const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || originalCodeExists);
  const hasStudyNotesContent = originalNotesExist || isEditingNotes;

  const availableTabs = [
    hasOverviewContent && { value: 'overview', label: 'Overview', icon: FileText },
    hasConceptsContent && { value: 'concepts', label: 'Concept Map', icon: Shapes },
    hasCodeAnalysisContent && { value: 'code', label: 'Code Insight', icon: Code },
    hasStudyNotesContent && { value: 'notes', label: 'Study Notes', icon: Lightbulb },
  ].filter(Boolean) as { value: string, label: string, icon: React.ElementType }[]; // Filter out false values and assert type

  // Check if anything needs saving (considering edits)
  const anythingToSave = (editedSummary && editedSummary.trim().length > 0) ||
                         originalCodeExists ||
                         (editedNotes && editedNotes.trim().length > 0);


  if (availableTabs.length === 0 && !category) { // Also check category for minimal display
    return (
      <Card className="w-full mt-6 bg-card text-card-foreground border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Analysis Results</CardTitle> {/* Display default title */}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No significant topics, concepts, code insights, or study notes were generated from this conversation.</p>
        </CardContent>
      </Card>
    );
  }

  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : 'overview'; // Default to first available tab

  return (
    <Card className="w-full mt-6 bg-card text-card-foreground border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-foreground">{displayTitle}</CardTitle> {/* Use simplified title logic */}
        <CardDescription className="text-muted-foreground">Explore the insights extracted from the conversation. You can edit the summary and notes before saving.</CardDescription>
         {/* Display Category Badge if it exists and is different from Title (e.g., if title is default) */}
         {category && category !== displayTitle && (
            <Badge variant="outline" className="mt-2 w-fit flex items-center gap-1 text-sm border-border text-muted-foreground">
                <Folder className="h-3 w-3" /> {category}
            </Badge>
           )}
         {/* If title IS category, show first key topic as a hint if available */}
         {category && category === displayTitle && keyTopics && keyTopics.length > 0 && (
             <p className="text-xs text-muted-foreground mt-1">(Main Topic: {keyTopics[0]})</p>
         )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4 bg-muted text-muted-foreground">
             {availableTabs.map((tab) => (
                 <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                     <tab.icon className="mr-2 h-4 w-4" />
                     {tab.label}
                 </TabsTrigger>
             ))}
          </TabsList>

          {/* Overview Tab */}
          {hasOverviewContent && (
            <TabsContent value="overview" className="space-y-4">
                {/* Learning Summary Section - Now Editable */}
                <Card className="bg-secondary/30 dark:bg-secondary/10 border border-border/50">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-md flex items-center gap-2 text-secondary-foreground"><FileText className="h-4 w-4"/>Learning Summary</CardTitle>
                        {/* Edit/Save/Cancel Buttons for Summary */}
                         {!isEditingSummary ? (
                            <Button variant="ghost" size="icon" onClick={handleEditSummary} className="h-7 w-7" disabled={!originalSummaryExists && !isEditingSummary}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit Learning Summary</span>
                            </Button>
                        ) : (
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={handleSaveSummaryEdit} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10">
                                    <Save className="h-4 w-4" />
                                    <span className="sr-only">Save Summary Edit</span>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleCancelSummaryEdit} className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10">
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Cancel Edit Summary</span>
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isEditingSummary ? (
                             <Textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                rows={5} // Adjust rows as needed
                                className="w-full text-sm bg-background dark:bg-background/80 border-input"
                                placeholder="Enter learning summary..."
                            />
                        ) : (editedSummary && editedSummary.trim().length > 0) || originalSummaryExists ? (
                            <div className="text-foreground dark:text-foreground/90 text-sm">
                                <SimpleMarkdownRenderer content={editedSummary} />
                            </div>
                         ) : (
                            <span className="italic text-muted-foreground text-sm">No learning summary generated.</span>
                        )}
                    </CardContent>
                </Card>

                {/* Key Topics Section */}
                {keyTopics && keyTopics.length > 0 && (
                    <div className="bg-secondary/30 dark:bg-secondary/10 p-4 rounded-md border border-border/50">
                      <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-secondary-foreground"><Tags className="h-4 w-4"/>Key Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {keyTopics.map((topic, index) => (
                          <Badge key={`keytopic-${index}`} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                )}
            </TabsContent>
          )}

          {/* Concept Map Tab */}
          {hasConceptsContent && conceptsMap && (
             <TabsContent value="concepts" className="space-y-4">
                {conceptsMap.subtopics && conceptsMap.subtopics.length > 0 && (
                  <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-border/50">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><ListTree className="h-4 w-4"/>Subtopics</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.subtopics.map((subtopic, index) => (
                        <Badge key={`subtopic-${index}`} variant="outline" className="border-muted-foreground/50 text-muted-foreground">{subtopic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.concepts && conceptsMap.concepts.length > 0 && (
                   <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-border/50">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><BrainCircuit className="h-4 w-4"/>Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.concepts.map((concept, index) => (
                        <Badge key={`concept-${index}`} variant="outline" className="border-accent text-accent">{concept}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.relationships && conceptsMap.relationships.length > 0 && (
                   <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-border/50">
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-muted-foreground"><LinkIcon className="h-4 w-4"/>Relationships</h3>
                    <ScrollArea className="h-[200px] w-full">
                        <ul className="space-y-2 pr-4">
                        {conceptsMap.relationships.map((rel, index) => (
                            <li key={`rel-${index}`} className="text-sm flex items-center flex-wrap gap-1 p-2 border rounded-md bg-background dark:bg-background/50 border-border/50">
                              <Badge variant="secondary" className="shrink-0">{rel.from}</Badge>
                              <span className="text-muted-foreground mx-1 text-xs">&rarr;</span>
                              <Badge variant="outline" className="italic text-xs shrink-0 border-border/50 text-muted-foreground">{rel.type}</Badge>
                              <span className="text-muted-foreground mx-1 text-xs">&rarr;</span>
                              <Badge variant="secondary" className="shrink-0">{rel.to}</Badge>
                            </li>
                        ))}
                        </ul>
                    </ScrollArea>
                  </div>
                )}
             </TabsContent>
          )}

          {/* Code Insight Tab */}
           {hasCodeAnalysisContent && codeAnalysis && (
             <TabsContent value="code" className="space-y-4">
               {codeAnalysis.learnedConcept && (
                 <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-md border border-primary/20 dark:border-primary/30">
                   <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-primary dark:text-primary-foreground/90"><BrainCircuit className="h-4 w-4"/>Concept Learned / Problem Solved</h3>
                   {/* Apply text-foreground to ensure visibility */}
                   <p className="whitespace-pre-wrap text-sm text-foreground dark:text-foreground/90">{codeAnalysis.learnedConcept}</p>
                 </div>
               )}
               {codeAnalysis.finalCodeSnippet && (
                 <Card className="bg-muted/10 dark:bg-muted/20 overflow-hidden border border-border/50">
                   <CardHeader className="p-3 pb-2 bg-muted/20 dark:bg-muted/30 border-b border-border/50">
                     <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                       <CardTitle className="text-sm font-medium text-foreground">Final Code Example</CardTitle>
                       {codeAnalysis.codeLanguage && <Badge variant="secondary" className="text-xs mt-1 md:mt-0">{codeAnalysis.codeLanguage}</Badge>}
                     </div>
                   </CardHeader>
                   <CardContent className="p-0">
                     <ScrollArea className="max-h-[400px] w-full">
                       <pre className="p-4 text-xs bg-background/50 dark:bg-background/20 text-foreground dark:text-foreground/90 whitespace-pre-wrap break-words font-mono">
                         <code>{codeAnalysis.finalCodeSnippet}</code>
                       </pre>
                     </ScrollArea>
                   </CardContent>
                 </Card>
               )}
               {codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                 <div className="text-muted-foreground text-sm p-4 border border-dashed border-border/50 rounded-md">
                   No specific code snippet identified for this concept.
                 </div>
               )}
                {!codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                 <div className="text-muted-foreground text-sm p-4 border border-dashed border-border/50 rounded-md">
                   No code concepts or snippets were identified.
                 </div>
               )}
             </TabsContent>
           )}

           {/* Study Notes Tab - Editable */}
           {hasStudyNotesContent && (
                <TabsContent value="notes">
                    <Card className="bg-secondary/10 dark:bg-secondary/20 border border-border/50">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-md flex items-center gap-2 text-secondary-foreground">
                                <Lightbulb className="h-4 w-4" /> Study Notes
                            </CardTitle>
                            {/* Edit/Save/Cancel Buttons for Notes */}
                            {!isEditingNotes ? (
                                <Button variant="ghost" size="icon" onClick={handleEditNotes} className="h-7 w-7" disabled={!originalNotesExist && !isEditingNotes}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit Study Notes</span>
                                </Button>
                            ) : (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleSaveNotesEdit} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10">
                                        <Save className="h-4 w-4" />
                                        <span className="sr-only">Save Notes Edit</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleCancelNotesEdit} className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10">
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Cancel Edit Notes</span>
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isEditingNotes ? (
                                <Textarea
                                    value={editedNotes}
                                    onChange={(e) => setEditedNotes(e.target.value)}
                                    rows={10}
                                    className="w-full text-sm bg-background dark:bg-background/80 border-input"
                                    placeholder="Enter study notes here..."
                                />
                             ) : (editedNotes && editedNotes.trim().length > 0) || originalNotesExist ? ( // Show edited notes even if original was empty
                                <StudyNotesRenderer content={editedNotes} />
                            ) : (
                                <p className="text-muted-foreground text-sm italic p-4">No study notes were generated for this conversation.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
      {/* Save All Insights Button */}
      <CardFooter className="border-t border-border pt-6">
        <Button
            onClick={handleSaveAllInsights}
            disabled={isSaving || !anythingToSave} // Disable if nothing to save or currently saving
            aria-label="Save All Insights"
            className={cn(
                "w-full md:w-auto",
                 !anythingToSave && "cursor-not-allowed opacity-50" // Add disabled style visually
            )}
        >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Insights to My Learnings'}
        </Button>
        {saveState?.error && <p className="text-xs text-destructive ml-4">{saveState.error}</p>}
        {saveState?.success && saveState.info && <p className="text-xs text-green-600 dark:text-green-400 ml-4">{saveState.info}</p>}
      </CardFooter>
    </Card>
  );
}
