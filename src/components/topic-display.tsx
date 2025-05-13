
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
import { Input } from '@/components/ui/input'; // Import Input for title editing
import { useToast } from "@/hooks/use-toast";
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Folder, Archive, Loader2, Edit, Save, X, Map, BookOpen, Tag, Check } from 'lucide-react';
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
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      return <li key={index} className="ml-5 list-disc">{renderBold(trimmedLine.substring(2))}</li>;
    }
    if (/^\d+\.\s/.test(trimmedLine)) {
         const match = trimmedLine.match(/^(\d+\.\s)(.*)/);
         if (match) {
            return <li key={index} value={parseInt(match[1], 10)} className="ml-5">{renderBold(match[2])}</li>;
         }
    }
     if (trimmedLine.startsWith('```')) {
         let codeContent = '';
         let language = '';
         const langMatch = trimmedLine.match(/^```(\w*)/);
         if (langMatch && langMatch[1]) {
             language = langMatch[1];
         }
         let inCodeBlock = true;
         let codeEndIndex = lines.findIndex((l, i) => i > index && l.trim() === '```');
         if (codeEndIndex === -1) codeEndIndex = lines.length;

         codeContent = lines.slice(index + 1, codeEndIndex).join('\n');
         return (
             <pre key={index} className="my-2 p-3 text-xs bg-muted text-foreground whitespace-pre-wrap break-words rounded-md border">
                 <code className={`language-${language} font-mono`}>{codeContent.trimEnd()}</code>
             </pre>
         );
     }
     if (lines.slice(0, index).some((l, i) => l.trim().startsWith('```') && lines.slice(i + 1, index + 1).every(subL => subL.trim() !== '```'))) {
        return null;
     }
    if (trimmedLine === '') {
        return <br key={index} />;
    }
    return <p key={index} className="mb-2 last:mb-0">{renderBold(trimmedLine)}</p>;
  });

   const groupedElements: React.ReactNode[] = [];
   let currentList: React.ReactNode[] = [];
   let listType: 'ul' | 'ol' | null = null;

   elements.forEach((el, index) => {
     if (!el) return; 

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
       if (React.isValidElement(el) && (el.type === 'br' || el.type === 'pre' || (el.type === 'p' && el.props.children) || el.type === 'h3')) {
           groupedElements.push(el);
       } else if (!React.isValidElement(el)) {
       } else if (React.isValidElement(el) && el.type !== 'p') {
             groupedElements.push(el);
       }
     }
   });

   if (currentList.length > 0 && listType) {
     const ListComponent = listType === 'ol' ? 'ol' : 'ul';
     const listClass = listType === 'ol' ? "list-decimal" : "list-disc";
     groupedElements.push(<ListComponent key="list-last" className={`space-y-1 mb-2 pl-5 ${listClass}`}>{currentList}</ListComponent>);
   }

  return <div className="text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none prose-headings:text-primary prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:rounded-md prose-pre:p-3">{groupedElements}</div>;
};

const StudyNotesRenderer = SimpleMarkdownRenderer;


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { toast } = useToast();
  const [saveState, saveFormAction, isSaving] = useActionState(saveEntryAction, null);

  const { learningSummary, keyTopics, category, conceptsMap, codeAnalysis, studyNotes } = results;

  // --- State for editing Title ---
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState('');

  // --- Generate initial topic name based on new logic ---
  const initialTopicNameToSave = React.useMemo(() => {
    let title = "Untitled Learning";
    if (results.keyTopics && results.keyTopics.length > 0) {
        title = results.keyTopics[0];
    } else if (results.category) {
        title = results.category;
    } else if (results.codeAnalysis?.learnedConcept) {
        title = results.codeAnalysis.learnedConcept;
    }
    return String(title);
  }, [results.keyTopics, results.category, results.codeAnalysis?.learnedConcept]);

  // Initialize or update editedTitle when results change or editing stops
  React.useEffect(() => {
    if (!isEditingTitle) {
        setEditedTitle(initialTopicNameToSave);
    }
  }, [initialTopicNameToSave, isEditingTitle]);


  // State for editing Study Notes
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [editedNotes, setEditedNotes] = React.useState(studyNotes || '');

  // State for editing Learning Summary
  const [isEditingSummary, setIsEditingSummary] = React.useState(false);
  const [editedSummary, setEditedSummary] = React.useState(learningSummary || '');

  React.useEffect(() => {
    if (!isEditingNotes) setEditedNotes(studyNotes || '');
    if (!isEditingSummary) setEditedSummary(learningSummary || '');
  }, [studyNotes, learningSummary, isEditingNotes, isEditingSummary]);

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
    const titleToSave = editedTitle.trim() || initialTopicNameToSave;
    const summaryToSave = editedSummary;
    const codeSnippetToSave = results.codeAnalysis?.finalCodeSnippet;
    const codeLangToSave = results.codeAnalysis?.codeLanguage;
    const notesToSave = editedNotes;

    const formData = new FormData();
    formData.append('topicName', titleToSave);
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

    if (!formData.has('learningSummary') && !formData.has('codeSnippetContent') && !formData.has('studyNotesContent')) {
        toast({ title: "Nothing to Save", description: "No content available to save from this analysis." });
        return;
    }

    startTransition(() => {
        saveFormAction(formData);
    });
  };

  // --- Handlers for Editing ---
  const handleEditTitle = () => setIsEditingTitle(true);
  const handleSaveTitleEdit = () => setIsEditingTitle(false); // Saves to local state `editedTitle`
  const handleCancelTitleEdit = () => {
    setEditedTitle(initialTopicNameToSave); // Revert to auto-generated
    setIsEditingTitle(false);
  };

  const handleEditNotes = () => setIsEditingNotes(true);
  const handleSaveNotesEdit = () => setIsEditingNotes(false);
  const handleCancelNotesEdit = () => {
    setEditedNotes(studyNotes || '');
    setIsEditingNotes(false);
  };

  const handleEditSummary = () => setIsEditingSummary(true);
  const handleSaveSummaryEdit = () => setIsEditingSummary(false);
  const handleCancelSummaryEdit = () => {
    setEditedSummary(learningSummary || '');
    setIsEditingSummary(false);
  };

  // --- Content Checks ---
  const currentLearningSummary = isEditingSummary ? editedSummary : learningSummary;
  const currentStudyNotes = isEditingNotes ? editedNotes : studyNotes;

  const hasSummaryContent = !!currentLearningSummary && currentLearningSummary.trim().length > 0;
  const hasKeyTopicsContent = keyTopics && keyTopics.length > 0;
  const hasConceptsContent = !!conceptsMap && (
    (conceptsMap.concepts && conceptsMap.concepts.length > 0) ||
    (conceptsMap.subtopics && conceptsMap.subtopics.length > 0) ||
    (conceptsMap.relationships && conceptsMap.relationships.length > 0)
  );
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || (codeAnalysis.finalCodeSnippet && codeAnalysis.finalCodeSnippet.trim().length > 0));
  const hasStudyNotesContent = !!currentStudyNotes && currentStudyNotes.trim().length > 0;

  const availableTabs = [
    (hasSummaryContent || hasStudyNotesContent) && { value: 'summary', label: 'Summary & Notes', icon: BookOpen },
    hasKeyTopicsContent && { value: 'topics', label: 'Key Topics', icon: Tags },
    hasConceptsContent && { value: 'concepts', label: 'Concept Map', icon: Map },
    hasCodeAnalysisContent && { value: 'code', label: 'Code Analysis', icon: Code },
  ].filter(Boolean) as { value: string, label: string, icon: React.ElementType }[];

  const numTabs = availableTabs.length;
  const gridColsClass = numTabs > 0 && numTabs <= 4 ? `grid-cols-${numTabs}` : (numTabs > 4 ? 'grid-cols-4' : 'grid-cols-1');

  const anythingToSave = (editedTitle.trim() || initialTopicNameToSave) && 
                         (hasSummaryContent || hasCodeAnalysisContent || hasStudyNotesContent);


  if (availableTabs.length === 0 && !category) {
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
          <CardDescription className="text-muted-foreground pt-1">
            Key insights extracted from your conversation.
            {category && (
                 <Badge variant="secondary" className="ml-2 w-fit flex items-center gap-1 text-xs">
                     <Folder className="h-3 w-3" /> {category}
                 </Badge>
             )}
         </CardDescription>

          {/* Editable Title Section */}
          <div className="pt-3">
            <label htmlFor="entryTitle" className="block text-xs font-medium text-muted-foreground mb-1">Entry Title</label>
            {isEditingTitle ? (
                <div className="flex items-center gap-2">
                    <Input
                        id="entryTitle"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="flex-grow h-9"
                        placeholder="Enter entry title"
                    />
                    <Button onClick={handleSaveTitleEdit} size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-500 hover:bg-green-500/10">
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Save Title</span>
                    </Button>
                    <Button onClick={handleCancelTitleEdit} size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-500 hover:bg-red-500/10">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Cancel Title Edit</span>
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 min-h-[36px]">
                    <h3 className="text-md font-semibold text-foreground flex-grow break-words">
                        {editedTitle || "Untitled Learning"}
                    </h3>
                    <Button onClick={handleEditTitle} variant="ghost" size="icon" className="h-7 w-7 ml-2">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit Title</span>
                    </Button>
                </div>
            )}
          </div>
       </CardHeader>
       <CardContent>
         <Tabs defaultValue={defaultTabValue} className="w-full">
           <TabsList className={`grid w-full ${gridColsClass} mb-4 bg-muted text-muted-foreground`}>
              {availableTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                      <tab.icon className="mr-2 h-4 w-4 hidden sm:inline-block" />
                      {tab.label}
                  </TabsTrigger>
              ))}
               {Array.from({ length: Math.max(0, 4 - numTabs) }).map((_, i) => <div key={`placeholder-${i}`} className="hidden md:block"></div>)}
           </TabsList>

            {(hasSummaryContent || hasStudyNotesContent) && (
              <TabsContent value="summary" className="space-y-6">
                  {(hasSummaryContent) && (
                      <div className="prose dark:prose-invert max-w-none">
                           <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium m-0 text-foreground">Learning Summary</h3>
                                {!isEditingSummary ? (
                                    <Button variant="ghost" size="icon" onClick={handleEditSummary} className="h-7 w-7" disabled={!currentLearningSummary && !isEditingSummary}>
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
                          ) : currentLearningSummary && currentLearningSummary.trim().length > 0 ? (
                              <div className="whitespace-pre-wrap text-sm bg-secondary/30 dark:bg-secondary/10 p-3 rounded-md border border-border/50">
                                  <SimpleMarkdownRenderer content={currentLearningSummary} />
                              </div>
                          ) : (
                              <span className="italic text-muted-foreground text-sm">No learning summary generated.</span>
                          )}
                      </div>
                  )}

                   {(hasStudyNotesContent) && (
                        <div className="prose dark:prose-invert max-w-none mt-6 pt-6 border-t border-border/50">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium flex items-center m-0 text-foreground">
                                <Lightbulb className="mr-2 h-4 w-4" /> Study Notes
                                </h3>
                                {!isEditingNotes ? (
                                    <Button variant="ghost" size="icon" onClick={handleEditNotes} className="h-7 w-7" disabled={!currentStudyNotes && !isEditingNotes}>
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
                            ) : (currentStudyNotes && currentStudyNotes.trim().length > 0) ? (
                                <div className="whitespace-pre-wrap text-sm bg-secondary/30 dark:bg-secondary/10 p-3 rounded-md border border-border/50">
                                    <StudyNotesRenderer content={currentStudyNotes} />
                                </div>
                            ) : (
                                <span className="italic text-muted-foreground text-sm">No study notes generated.</span>
                            )}
                        </div>
                   )}

                   {!hasSummaryContent && !hasStudyNotesContent && (
                       <div className="text-muted-foreground text-center py-4">
                         No summary or study notes were generated for this conversation.
                       </div>
                   )}

              </TabsContent>
            )}

            {hasKeyTopicsContent && keyTopics && keyTopics.length > 0 && (
                <TabsContent value="topics">
                    <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center text-foreground">
                        <Tags className="mr-2 h-4 w-4" /> Key Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {keyTopics.map((topic, index) => (
                        <Badge key={index} variant="secondary" className="text-sm py-1 px-2.5">
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


            {hasConceptsContent && conceptsMap && (
                <TabsContent value="concepts">
                    <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center text-foreground">
                        <Map className="mr-2 h-4 w-4" /> Concept Map
                    </h3>
                     <ScrollArea className="h-[300px] w-full">
                        <div className="whitespace-pre-wrap text-sm bg-muted/50 dark:bg-muted/20 p-4 rounded-md border border-border/50">
                            {typeof conceptsMap === 'string' ? conceptsMap : JSON.stringify(conceptsMap, null, 2)}
                        </div>
                    </ScrollArea>
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

            {hasCodeAnalysisContent && codeAnalysis && (
                 <TabsContent value="code">
                    <div className="space-y-6"> {/* Increased spacing */}
                        <h3 className="text-lg font-medium flex items-center text-foreground">
                        <Code className="mr-2 h-4 w-4" /> Code Analysis
                        </h3>
                        {codeAnalysis.learnedConcept && (
                             <div className="bg-secondary/30 dark:bg-secondary/10 p-4 rounded-md border border-border/50">
                                <h4 className="text-sm font-semibold mb-1.5 text-secondary-foreground">Concept Learned:</h4>
                                <p className="whitespace-pre-wrap text-sm text-foreground/90">{codeAnalysis.learnedConcept}</p>
                            </div>
                        )}
                        {codeAnalysis.finalCodeSnippet && (
                            <Card className="bg-muted/10 dark:bg-muted/5 overflow-hidden border-border/50">
                                <CardHeader className="p-3 pb-2 bg-muted/20 dark:bg-muted/10 border-b border-border/50">
                                    <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                                        <CardTitle className="text-sm font-medium text-secondary-foreground">
                                            Final Code Example
                                        </CardTitle>
                                        {codeAnalysis.codeLanguage && <Badge variant="outline" size="sm" className="mt-1 md:mt-0 text-xs">{codeAnalysis.codeLanguage}</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="max-h-[400px] w-full">
                                        <pre className="p-4 text-xs text-foreground whitespace-pre-wrap break-words font-mono">
                                            <code>{codeAnalysis.finalCodeSnippet}</code>
                                        </pre>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                         {!codeAnalysis.learnedConcept && !(codeAnalysis.finalCodeSnippet && codeAnalysis.finalCodeSnippet.trim().length > 0) && (
                              <div className="text-muted-foreground text-center py-4">
                                No specific code insights were generated.
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

