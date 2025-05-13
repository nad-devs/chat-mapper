
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Use Tabs from UI
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Folder, Archive, Loader2, Edit, Save, X, Map, BookOpen, Tag } from 'lucide-react'; // Import more icons
import { cn } from '@/lib/utils';

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

// Simple renderer for plain text or basic markdown (like bullet points)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
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

    // Handle H3 (###)
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
    // Handle code blocks ``` ... ``` (simple display) - render inner code block
     if (trimmedLine.startsWith('```')) {
         // Find the closing ```
         let codeContent = '';
         let language = '';
         const langMatch = trimmedLine.match(/^```(\w*)/);
         if (langMatch && langMatch[1]) {
             language = langMatch[1];
         }
         let inCodeBlock = true;
         // Simple approach: Assume block ends before next ``` or end of lines
         let codeEndIndex = lines.findIndex((l, i) => i > index && l.trim() === '```');
         if (codeEndIndex === -1) codeEndIndex = lines.length;

         codeContent = lines.slice(index + 1, codeEndIndex).join('\n');

         // Render the code block as pre/code - note: this simple renderer doesn't skip lines already rendered
         return (
             <pre key={index} className="my-2 p-3 text-xs bg-muted text-foreground whitespace-pre-wrap break-words rounded-md border">
                 <code className={`language-${language} font-mono`}>{codeContent.trimEnd()}</code>
             </pre>
         );
     }
     // Avoid rendering lines that are part of a code block already handled
     if (lines.slice(0, index).some((l, i) => l.trim().startsWith('```') && lines.slice(i + 1, index + 1).every(subL => subL.trim() !== '```'))) {
        return null;
     }

    // Handle empty lines as breaks (but not within code blocks)
    if (trimmedLine === '') {
        return <br key={index} />;
    }
    // Default paragraph rendering
    return <p key={index} className="mb-2 last:mb-0">{renderBold(trimmedLine)}</p>;
  });

  // Group list items
   const groupedElements: React.ReactNode[] = [];
   let currentList: React.ReactNode[] = [];
   let listType: 'ul' | 'ol' | null = null;

   elements.forEach((el, index) => {
     if (!el) return; // Skip null elements (like consumed code block lines)

     const isListItem = React.isValidElement(el) && el.type === 'li';
     const isPre = React.isValidElement(el) && el.type === 'pre';

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
       // Don't render paragraphs that are just empty strings (often result of split)
       // unless it's an intentional break <br/> or code block <pre>
       if (React.isValidElement(el) && (el.type === 'br' || el.type === 'pre' || (el.type === 'p' && el.props.children) || el.type === 'h3')) {
           groupedElements.push(el);
       } else if (!React.isValidElement(el)) {
            // Handle raw text nodes if necessary, though unlikely with current logic
            // groupedElements.push(el);
       } else if (React.isValidElement(el) && el.type !== 'p') {
            // Add other valid elements like h3 (already handled above, but kept for structure)
             groupedElements.push(el);
       }
     }
   });

   // Add any remaining list
   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }

  // Apply base text styling
  // Updated prose classes for better dark mode support and general styling
  return <div className="text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none prose-headings:text-primary prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:rounded-md prose-pre:p-3">{groupedElements}</div>;
};


// Use the improved renderer for Study Notes
const StudyNotesRenderer = SimpleMarkdownRenderer;


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { toast } = useToast();
  const [saveState, saveFormAction, isSaving] = useActionState(saveEntryAction, null);

  const { learningSummary, keyTopics, category, conceptsMap, codeAnalysis, studyNotes } = results;

  // Determine a simpler title: Use Category if available, otherwise first Key Topic, or learned concept, or fallback
  const displayTitle = category || (keyTopics && keyTopics.length > 0 ? keyTopics[0] : codeAnalysis?.learnedConcept) || "Analysis Results";

  // Topic name for saving (prioritize learned concept, then title)
  const topicNameToSave = codeAnalysis?.learnedConcept || displayTitle || "Untitled Learning";


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
    // Save category if it exists
    if (category) {
      formData.append('category', category);
    }
    if (summaryToSave && summaryToSave.trim().length > 0) {
      formData.append('learningSummary', summaryToSave);
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
  const originalSummaryExists = !!learningSummary && learningSummary.trim().length > 0;
  const originalNotesExist = !!studyNotes && studyNotes.trim().length > 0;
  const originalCodeExists = !!codeAnalysis?.finalCodeSnippet && codeAnalysis.finalCodeSnippet.trim().length > 0;

  // Determine which tabs should be available based on content
  const hasSummaryContent = originalSummaryExists || isEditingSummary;
  const hasKeyTopicsContent = keyTopics && keyTopics.length > 0;
  // const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  // Simplified concept map check based on example
   const hasConceptsContent = !!conceptsMap;
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || originalCodeExists);
  const hasStudyNotesContent = originalNotesExist || isEditingNotes;

  const availableTabs = [
    // Combine Summary and Study Notes into one tab based on example
    (hasSummaryContent || hasStudyNotesContent) && { value: 'summary', label: 'Summary', icon: BookOpen },
    hasKeyTopicsContent && { value: 'topics', label: 'Topics', icon: Tag }, // Renamed from 'Key Topics'
    hasConceptsContent && { value: 'concepts', label: 'Concept Map', icon: Map },
    hasCodeAnalysisContent && { value: 'code', label: 'Code Analysis', icon: Code }, // Renamed from 'Code Insight'
  ].filter(Boolean) as { value: string, label: string, icon: React.ElementType }[];

  const numTabs = availableTabs.length;
  const gridColsClass = numTabs > 0 ? `grid-cols-${numTabs}` : 'grid-cols-1';


  // Check if anything needs saving (considering edits)
  const anythingToSave = (editedSummary && editedSummary.trim().length > 0) ||
                         originalCodeExists ||
                         (editedNotes && editedNotes.trim().length > 0);


  if (availableTabs.length === 0 && !category) { // Also check category for minimal display
    return (
      <Card className="w-full mt-6 bg-card text-card-foreground border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center text-foreground">
             <BookOpen className="mr-2 h-5 w-5 text-primary" /> Learning Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No significant topics, concepts, code insights, or study notes were generated from this conversation.</p>
        </CardContent>
      </Card>
    );
  }

  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : 'summary';

  return (
     <Card className="w-full mt-6 shadow-md border-border/50">
       <CardHeader>
         <CardTitle className="text-2xl flex items-center text-foreground">
            <BookOpen className="mr-2 h-5 w-5 text-primary" /> Learning Analysis
         </CardTitle>
         {/* Display Category as a Badge if it exists */}
          <CardDescription className="text-muted-foreground pt-1">
            Key insights extracted from your conversation
            {category && (
                 <Badge variant="secondary" className="ml-2 w-fit flex items-center gap-1 text-xs">
                     <Folder className="h-3 w-3" /> {category}
                 </Badge>
             )}
         </CardDescription>
       </CardHeader>
       <CardContent>
         <Tabs defaultValue={defaultTabValue} className="w-full">
           <TabsList className={`grid w-full ${gridColsClass} mb-4 bg-muted text-muted-foreground`}>
              {availableTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                      {/* <tab.icon className="mr-2 h-4 w-4" /> */} {/* Example uses text only */}
                      {tab.label}
                  </TabsTrigger>
              ))}
              {/* Fill remaining grid cols if needed */}
               {Array.from({ length: 4 - numTabs }).map((_, i) => <div key={`placeholder-${i}`} className="hidden md:block"></div>)}
           </TabsList>

           {/* Summary Tab Content (Combining Summary and Notes) */}
            {(hasSummaryContent || hasStudyNotesContent) && (
              <TabsContent value="summary" className="space-y-6">
                  {/* Learning Summary Section - Editable */}
                  {(originalSummaryExists || isEditingSummary) && (
                      <div className="prose dark:prose-invert max-w-none">
                           <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium m-0">Learning Summary</h3>
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
                           </div>
                          {isEditingSummary ? (
                                <Textarea
                                    value={editedSummary}
                                    onChange={(e) => setEditedSummary(e.target.value)}
                                    rows={5}
                                    className="w-full text-sm bg-background dark:bg-background/80 border-input"
                                    placeholder="Enter learning summary..."
                                />
                          ) : editedSummary && editedSummary.trim().length > 0 ? (
                              <div className="whitespace-pre-wrap text-sm">
                                  <SimpleMarkdownRenderer content={editedSummary} />
                              </div>
                          ) : (
                              <span className="italic text-muted-foreground text-sm">No learning summary generated.</span>
                          )}
                      </div>
                  )}

                  {/* Study Notes Section - Editable */}
                   {(originalNotesExist || isEditingNotes) && (
                        <div className="prose dark:prose-invert max-w-none mt-6 pt-6 border-t border-border/50">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium flex items-center m-0">
                                <Lightbulb className="mr-2 h-4 w-4" /> Study Notes
                                </h3>
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
                           </div>
                           {isEditingNotes ? (
                                <Textarea
                                    value={editedNotes}
                                    onChange={(e) => setEditedNotes(e.target.value)}
                                    rows={10}
                                    className="w-full text-sm bg-background dark:bg-background/80 border-input"
                                    placeholder="Enter study notes here..."
                                />
                            ) : (editedNotes && editedNotes.trim().length > 0) ? (
                                <div className="whitespace-pre-wrap text-sm">
                                    <StudyNotesRenderer content={editedNotes} />
                                </div>
                            ) : (
                                <span className="italic text-muted-foreground text-sm">No study notes generated.</span>
                            )}
                        </div>
                   )}

                   {/* Fallback if no summary or notes */}
                   {!hasSummaryContent && !hasStudyNotesContent && (
                       <div className="text-muted-foreground text-center py-4">
                         No summary or study notes were generated for this conversation.
                       </div>
                   )}

              </TabsContent>
            )}

           {/* Key Topics Tab Content */}
            {hasKeyTopicsContent && keyTopics && keyTopics.length > 0 && (
                <TabsContent value="topics">
                    <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                        <Tag className="mr-2 h-4 w-4" /> Key Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {keyTopics.map((topic, index) => (
                        <Badge key={index} variant="secondary" className="text-sm py-1">
                            {topic}
                        </Badge>
                        ))}
                    </div>
                    </div>
                </TabsContent>
            )}
             {hasKeyTopicsContent && (!keyTopics || keyTopics.length === 0) && (
                 <TabsContent value="topics">
                      <div className="text-muted-foreground text-center py-4">
                         No key topics were identified in this conversation.
                       </div>
                 </TabsContent>
             )}


            {/* Concept Map Tab Content */}
            {hasConceptsContent && conceptsMap && (
                <TabsContent value="concepts">
                    <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                        <Map className="mr-2 h-4 w-4" /> Concept Map
                    </h3>
                    {/* Assuming conceptsMap is a string for now based on example */}
                    <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
                        {/* Render the concept map string - adjust if it's an object later */}
                        {typeof conceptsMap === 'string' ? conceptsMap : JSON.stringify(conceptsMap, null, 2)}
                    </div>
                    </div>
                </TabsContent>
            )}
             {hasConceptsContent && !conceptsMap && (
                <TabsContent value="concepts">
                    <div className="text-muted-foreground text-center py-4">
                         No concept map was generated for this conversation.
                    </div>
                </TabsContent>
            )}

           {/* Code Analysis Tab Content */}
            {hasCodeAnalysisContent && codeAnalysis && (
                 <TabsContent value="code">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium flex items-center">
                        <Code className="mr-2 h-4 w-4" /> Code Analysis
                        </h3>
                        {/* Render learned concept */}
                        {codeAnalysis.learnedConcept && (
                             <div className="bg-secondary/30 dark:bg-secondary/10 p-3 rounded-md border border-border/50">
                                <h4 className="text-sm font-semibold mb-1 text-secondary-foreground">Concept:</h4>
                                <p className="whitespace-pre-wrap text-sm text-foreground">{codeAnalysis.learnedConcept}</p>
                            </div>
                        )}
                        {/* Render code snippet */}
                        {codeAnalysis.finalCodeSnippet && (
                            <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-x-auto border border-border/50">
                                 {codeAnalysis.codeLanguage && <Badge variant="secondary" className="float-right text-xs mb-2">{codeAnalysis.codeLanguage}</Badge>}
                                <pre><code className={`language-${codeAnalysis.codeLanguage || ''}`}>{codeAnalysis.finalCodeSnippet}</code></pre>
                            </div>
                        )}
                         {!codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                              <div className="text-muted-foreground text-center py-4">
                                No specific code analysis generated.
                              </div>
                         )}
                    </div>
                </TabsContent>
            )}
             {hasCodeAnalysisContent && !codeAnalysis && (
                 <TabsContent value="code">
                     <div className="text-muted-foreground text-center py-4">
                         No code analysis was generated for this conversation.
                     </div>
                 </TabsContent>
             )}


         </Tabs>
       </CardContent>
       {/* Save All Insights Button */}
       <CardFooter className="border-t border-border/50 pt-4">
         <Button
             onClick={handleSaveAllInsights}
             disabled={isSaving || !anythingToSave}
             aria-label="Save All Insights"
             className={cn(
                 "w-full md:w-auto",
                  !anythingToSave && "cursor-not-allowed opacity-50"
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
