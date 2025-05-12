
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
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { useToast } from "@/hooks/use-toast";
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Folder, Archive, Loader2, Edit, Save, X } from 'lucide-react'; // Import Edit, Save, X

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

// Simple Markdown-like renderer (No changes needed here)
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

    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{renderBold(line.substring(4))}</h3>;
    }
     if (line.startsWith('## ')) {
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


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { toast } = useToast();
  const [saveState, saveFormAction, isSaving] = useActionState(saveEntryAction, null);

  const { topicsSummary, keyTopics, category, conceptsMap, codeAnalysis, studyNotes } = results;
  const defaultTopicName = "Untitled Conversation";

  // State for editing Summary
  const [isEditingSummary, setIsEditingSummary] = React.useState(false);
  const [editedSummary, setEditedSummary] = React.useState(topicsSummary || '');

  // State for editing Study Notes
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [editedNotes, setEditedNotes] = React.useState(studyNotes || '');

  // Update local state if the results prop changes (e.g., new analysis)
  React.useEffect(() => {
    setEditedSummary(topicsSummary || '');
    setEditedNotes(studyNotes || '');
    setIsEditingSummary(false); // Reset editing state on new analysis
    setIsEditingNotes(false);
  }, [topicsSummary, studyNotes]);

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
    // Use the ORIGINAL AI-generated data for saving, regardless of local edits
    const topicNameToSave = results.topicsSummary || results.codeAnalysis?.learnedConcept || defaultTopicName;
    const categoryToSave = results.category;

    const formData = new FormData();
    formData.append('topicName', topicNameToSave);
    if (categoryToSave) {
      formData.append('category', categoryToSave);
    }
    if (results.topicsSummary && results.topicsSummary.trim().length > 0) {
      formData.append('summaryContent', results.topicsSummary);
    }
    if (results.codeAnalysis?.finalCodeSnippet && results.codeAnalysis.finalCodeSnippet.trim().length > 0) {
      formData.append('codeSnippetContent', results.codeAnalysis.finalCodeSnippet);
      if (results.codeAnalysis.codeLanguage) {
        formData.append('codeLanguage', results.codeAnalysis.codeLanguage);
      }
    }
    if (results.studyNotes && results.studyNotes.trim().length > 0) {
      formData.append('studyNotesContent', results.studyNotes);
    }

    // Check if there's anything to save
    if (!formData.has('summaryContent') && !formData.has('codeSnippetContent') && !formData.has('studyNotesContent')) {
        toast({ title: "Nothing to Save", description: "No content available to save from this analysis." });
        return;
    }

    startTransition(() => {
        saveFormAction(formData);
    });
  };

  // Handlers for Summary Edit
  const handleEditSummary = () => {
    setEditedSummary(topicsSummary || ''); // Reset to original on starting edit
    setIsEditingSummary(true);
  };

  const handleSaveSummary = () => {
    // NOTE: This only saves the edit locally for display in this component.
    // It does NOT update the original `results` prop or what gets saved by "Save All".
    // If you wanted to persist edits, you'd need to update the parent state or call a specific update action.
    // For now, we'll just update the local display:
    // setAnalysisResults(prev => ({...prev, topicsSummary: editedSummary})); // Example if updating parent state
    setIsEditingSummary(false);
    // We'll let the displayed content use editedSummary while not editing now.
  };

  const handleCancelSummary = () => {
    setEditedSummary(topicsSummary || ''); // Revert to original
    setIsEditingSummary(false);
  };

  // Handlers for Study Notes Edit
  const handleEditNotes = () => {
    setEditedNotes(studyNotes || ''); // Reset to original on starting edit
    setIsEditingNotes(true);
  };

  const handleSaveNotes = () => {
    setIsEditingNotes(false);
    // Display will now use the editedNotes state
  };

  const handleCancelNotes = () => {
    setEditedNotes(studyNotes || ''); // Revert to original
    setIsEditingNotes(false);
  };

  const hasOverviewContent = !!editedSummary || (keyTopics && keyTopics.length > 0);
  const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet);
  const hasStudyNotesContent = true; // Study notes tab is always shown

  const availableTabs = [
    { value: 'overview', label: 'Overview', icon: FileText, hasContent: hasOverviewContent },
    { value: 'concepts', label: 'Concept Map', icon: Shapes, hasContent: hasConceptsContent },
    { value: 'code', label: 'Code Insight', icon: Code, hasContent: hasCodeAnalysisContent },
    { value: 'notes', label: 'Study Notes', icon: Lightbulb, hasContent: hasStudyNotesContent },
  ].filter(tab => tab.hasContent);

  const notesExist = editedNotes && editedNotes.trim().length > 0;
  // Check original results for savable content
  const anythingToSave = (results.topicsSummary && results.topicsSummary.trim().length > 0) ||
                         (results.codeAnalysis?.finalCodeSnippet && results.codeAnalysis.finalCodeSnippet.trim().length > 0) ||
                         (results.studyNotes && results.studyNotes.trim().length > 0);


  if (availableTabs.length === 0 && !notesExist) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Conversation Analysis</CardTitle>
           {category && (
            <Badge variant="outline" className="mt-2 w-fit flex items-center gap-1">
                <Folder className="h-3 w-3" /> {category}
            </Badge>
           )}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No significant topics, concepts, or code insights found, and no study notes were generated.</p>
        </CardContent>
      </Card>
    );
  }

  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : 'notes';

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Explore the insights extracted from the conversation. You can edit the summary and notes locally.</CardDescription>
         {category && (
            <Badge variant="outline" className="mt-2 w-fit flex items-center gap-1 text-sm">
                <Folder className="h-3 w-3" /> {category}
            </Badge>
           )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
             {availableTabs.map((tab) => (
                 tab ? (
                     <TabsTrigger key={tab.value} value={tab.value}>
                         <tab.icon className="mr-2 h-4 w-4" />
                         {tab.label}
                     </TabsTrigger>
                 ) : null
             ))}
          </TabsList>

          {hasOverviewContent && (
            <TabsContent value="overview" className="space-y-4">
                {/* Summary Section */}
                <Card className="bg-secondary/30 dark:bg-secondary/10 relative border border-secondary/50 dark:border-secondary/20">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-md flex items-center gap-2"><FileText className="h-4 w-4 text-secondary-foreground"/>Summary</CardTitle>
                            {!isEditingSummary ? (
                                <Button variant="ghost" size="icon" onClick={handleEditSummary} className="h-7 w-7">
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit Summary</span>
                                </Button>
                            ) : (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleSaveSummary} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10">
                                        <Save className="h-4 w-4" />
                                        <span className="sr-only">Save Summary</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleCancelSummary} className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10">
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Cancel Edit Summary</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isEditingSummary ? (
                            <Textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                rows={4}
                                className="w-full text-sm bg-background dark:bg-background/80"
                            />
                        ) : (
                            <p className="text-foreground dark:text-foreground/90 text-sm">
                                {editedSummary || <span className="italic text-muted-foreground">No summary generated.</span>}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Key Topics Section */}
                {keyTopics && keyTopics.length > 0 && (
                    <div className="bg-secondary/30 dark:bg-secondary/10 p-4 rounded-md border border-secondary/50 dark:border-secondary/20">
                      <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><Tags className="h-4 w-4 text-secondary-foreground"/>Key Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {keyTopics.map((topic, index) => (
                          <Badge key={`keytopic-${index}`} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                )}
            </TabsContent>
          )}

          {hasConceptsContent && conceptsMap && (
             <TabsContent value="concepts" className="space-y-4">
                {conceptsMap.subtopics && conceptsMap.subtopics.length > 0 && (
                  <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-muted/50 dark:border-muted/20">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><ListTree className="h-4 w-4 text-muted-foreground"/>Subtopics</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.subtopics.map((subtopic, index) => (
                        <Badge key={`subtopic-${index}`} variant="outline" className="border-muted-foreground/50 text-muted-foreground">{subtopic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.concepts && conceptsMap.concepts.length > 0 && (
                   <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-muted/50 dark:border-muted/20">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-muted-foreground"/>Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.concepts.map((concept, index) => (
                        <Badge key={`concept-${index}`} variant="outline" className="border-accent text-accent">{concept}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.relationships && conceptsMap.relationships.length > 0 && (
                   <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-md border border-muted/50 dark:border-muted/20">
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><LinkIcon className="h-4 w-4 text-muted-foreground"/>Relationships</h3>
                    <ScrollArea className="h-[200px] w-full">
                        <ul className="space-y-2 pr-4">
                        {conceptsMap.relationships.map((rel, index) => (
                            <li key={`rel-${index}`} className="text-sm flex items-center flex-wrap gap-1 p-2 border rounded-md bg-background dark:bg-background/50">
                              <Badge variant="secondary" className="shrink-0">{rel.from}</Badge>
                              <span className="text-muted-foreground mx-1 text-xs">&rarr;</span>
                              <Badge variant="outline" className="italic text-xs shrink-0">{rel.type}</Badge>
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

           {hasCodeAnalysisContent && codeAnalysis && (
             <TabsContent value="code" className="space-y-4">
               {codeAnalysis.learnedConcept && (
                 <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-md border border-primary/20 dark:border-primary/30">
                   <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-primary dark:text-primary-foreground/90"><BrainCircuit className="h-4 w-4"/>Concept Learned / Problem Solved</h3>
                   <p className="whitespace-pre-wrap text-foreground dark:text-foreground/80 text-sm">{codeAnalysis.learnedConcept}</p>
                 </div>
               )}
               {codeAnalysis.finalCodeSnippet && (
                 <Card className="bg-muted/10 dark:bg-muted/20 overflow-hidden border border-muted/50 dark:border-muted/30">
                   <CardHeader className="p-3 pb-2 bg-muted/20 dark:bg-muted/30 border-b border-muted/50 dark:border-muted/30">
                     <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                       <CardTitle className="text-sm font-medium">Final Code Example</CardTitle>
                       {codeAnalysis.codeLanguage && <Badge variant="default" className="text-xs mt-1 md:mt-0">{codeAnalysis.codeLanguage}</Badge>}
                     </div>
                     {codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: {codeAnalysis.codeLanguage}</CardDescription>}
                     {!codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: Not detected</CardDescription>}
                   </CardHeader>
                   <CardContent className="p-0">
                     <ScrollArea className="max-h-[400px] w-full">
                       <pre className="p-4 text-xs bg-background/50 dark:bg-background/20 text-foreground dark:text-foreground/90 whitespace-pre-wrap break-words">
                         <code>{codeAnalysis.finalCodeSnippet}</code>
                       </pre>
                     </ScrollArea>
                   </CardContent>
                 </Card>
               )}
               {codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                 <div className="text-muted-foreground text-sm p-4 border border-dashed rounded-md">
                   No specific code snippet identified for this concept.
                 </div>
               )}
                {!codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                 <div className="text-muted-foreground text-sm p-4 border border-dashed rounded-md">
                   No code concepts or snippets were identified.
                 </div>
               )}
             </TabsContent>
           )}

           {/* Study Notes Section */}
           {hasStudyNotesContent && (
                <TabsContent value="notes">
                    <Card className="bg-secondary/10 dark:bg-secondary/20 border border-secondary/50 dark:border-secondary/30">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-md flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-secondary-foreground" />
                                Study Notes
                                </CardTitle>
                                {!isEditingNotes ? (
                                    <Button variant="ghost" size="icon" onClick={handleEditNotes} className="h-7 w-7">
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit Study Notes</span>
                                    </Button>
                                ) : (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={handleSaveNotes} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10">
                                            <Save className="h-4 w-4" />
                                            <span className="sr-only">Save Study Notes</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={handleCancelNotes} className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10">
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Cancel Edit Study Notes</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isEditingNotes ? (
                                <Textarea
                                    value={editedNotes}
                                    onChange={(e) => setEditedNotes(e.target.value)}
                                    rows={10}
                                    className="w-full text-sm bg-background dark:bg-background/80"
                                />
                            ) : notesExist ? (
                                <SimpleMarkdownRenderer content={editedNotes} />
                            ) : (
                                <p className="text-muted-foreground text-sm italic">No study notes were generated for this conversation.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
      <CardFooter className="border-t pt-6">
        <Button
            onClick={handleSaveAllInsights}
            disabled={isSaving || !anythingToSave}
            aria-label="Save All Insights"
            className="w-full md:w-auto"
        >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving All...' : 'Save All Insights to My Learnings'}
        </Button>
      </CardFooter>
    </Card>
  );
}
