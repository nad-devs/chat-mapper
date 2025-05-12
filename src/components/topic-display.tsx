
import * as React from 'react';
import type { ProcessedConversationResult, SaveEntryResult } from '@/app/actions'; // Import SaveEntryResult
import { saveEntryAction } from '@/app/actions'; // Import the save action
import { useActionState, startTransition } from 'react'; // Import startTransition
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter // Added CardFooter
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button'; // Import Button
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Folder, Save, Loader2 } from 'lucide-react'; // Import Save and Loader2 icons

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

// Simple Markdown-like renderer (basic bold, list, H3, inline code support)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    // ... (renderer code remains the same)
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

    if (line.startsWith('## ')) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{renderBold(line.substring(3))}</h3>;
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

  return <>{groupedElements}</>;
};


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { toast } = useToast();
  const [isSavingNotes, setIsSavingNotes] = React.useState(false);
  const [isSavingCode, setIsSavingCode] = React.useState(false);
  const [isSavingSummary, setIsSavingSummary] = React.useState(false);

  const topicsSummary = results.topicsSummary ?? null;
  const keyTopics = results.keyTopics ?? [];
  const category = results.category ?? null;
  const conceptsMap = results.conceptsMap ?? null;
  const codeAnalysis = results.codeAnalysis ?? null;
  const studyNotes = results.studyNotes ?? null;

  const defaultTopicName = "Untitled Conversation";

  // Generic save handler
  const handleSave = async (
    contentType: 'study-notes' | 'code-snippet' | 'summary',
    contentToSave: string | null,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!contentToSave) {
      toast({ title: "Error", description: "No content to save.", variant: "destructive" });
      return;
    }

    // Determine the topic name - prioritize summary, then concept, then default
    const topicNameToSave = topicsSummary || codeAnalysis?.learnedConcept || defaultTopicName;

    setLoading(true);

    const formData = new FormData();
    formData.append('topicName', topicNameToSave);
    formData.append('contentType', contentType);
    formData.append('content', contentToSave);

    startTransition(async () => {
        try {
            // Call the action directly, no need for useActionState here for simple triggers
            const result = await saveEntryAction(null, formData); // Pass null for prevState
            if (result.success) {
                toast({ title: "Success", description: result.info || `${contentType.replace('-', ' ')} saved.` });
            } else {
                toast({ title: "Error Saving", description: result.error || `Failed to save ${contentType.replace('-', ' ')}.`, variant: "destructive" });
            }
        } catch (error: any) {
             toast({
                title: "Save Error",
                description: `An unexpected error occurred: ${error.message}`,
                variant: "destructive",
             });
             console.error("Error during save transition:", error);
        } finally {
            setLoading(false);
        }
    });
  };

  // Specific save handlers calling the generic one
  const handleSaveNotes = () => handleSave('study-notes', studyNotes, setIsSavingNotes);
  const handleSaveCode = () => handleSave('code-snippet', codeAnalysis?.finalCodeSnippet ?? null, setIsSavingCode);
  const handleSaveSummary = () => handleSave('summary', topicsSummary, setIsSavingSummary);


  // Determine if each section has content
  const hasOverviewContent = !!topicsSummary || (keyTopics && keyTopics.length > 0);
  const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet);
  const hasStudyNotesContent = true; // Always show the notes tab

  const availableTabs = [
    { value: 'overview', label: 'Overview', icon: FileText, hasContent: hasOverviewContent },
    { value: 'concepts', label: 'Concept Map', icon: Shapes, hasContent: hasConceptsContent },
    { value: 'code', label: 'Code Insight', icon: Code, hasContent: hasCodeAnalysisContent },
    { value: 'notes', label: 'Study Notes', icon: Lightbulb, hasContent: hasStudyNotesContent },
  ].filter(tab => tab.hasContent);

  const notesExist = studyNotes && studyNotes.trim().length > 0;
  const codeSnippetExists = codeAnalysis?.finalCodeSnippet && codeAnalysis.finalCodeSnippet.trim().length > 0;
  const summaryExists = topicsSummary && topicsSummary.trim().length > 0;

  if (availableTabs.length <= 1 && !notesExist) {
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
          <p className="text-muted-foreground">No significant topics, concepts, or code insights found.</p>
             <div className="mt-4 bg-secondary/10 p-4 rounded-md border border-secondary/20">
                <h3 className="text-md font-semibold flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-secondary-foreground" />
                    Study Notes
                </h3>
                <p className="text-muted-foreground text-sm italic">No study notes were generated.</p>
            </div>
        </CardContent>
      </Card>
    );
  }

  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : 'notes';

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Explore the insights extracted from the conversation.</CardDescription>
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

          {/* Overview Tab */}
          {hasOverviewContent && (
            <TabsContent value="overview" className="space-y-4">
                {topicsSummary && (
                    <div className="bg-secondary/30 p-4 rounded-md relative">
                        <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-secondary-foreground"/>Summary</h3>
                        <p className="text-secondary-foreground pr-16">{topicsSummary}</p> {/* Add padding for button */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveSummary}
                            disabled={isSavingSummary || !summaryExists}
                            className="absolute top-4 right-4"
                            aria-label="Save Summary"
                        >
                            {isSavingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingSummary ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                )}
              {keyTopics && keyTopics.length > 0 && (
                <div className="bg-secondary/30 p-4 rounded-md">
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

          {/* Concept Map Tab */}
          {hasConceptsContent && conceptsMap && (
             <TabsContent value="concepts" className="space-y-4">
                {/* Concept map content remains the same */}
                {conceptsMap.subtopics && conceptsMap.subtopics.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><ListTree className="h-4 w-4 text-muted-foreground"/>Subtopics</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.subtopics.map((subtopic, index) => (
                        <Badge key={`subtopic-${index}`} variant="outline" className="border-muted-foreground/50 text-muted-foreground">{subtopic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.concepts && conceptsMap.concepts.length > 0 && (
                   <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-muted-foreground"/>Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.concepts.map((concept, index) => (
                        <Badge key={`concept-${index}`} variant="outline" className="border-accent text-accent">{concept}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap.relationships && conceptsMap.relationships.length > 0 && (
                   <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><LinkIcon className="h-4 w-4 text-muted-foreground"/>Relationships</h3>
                    <ScrollArea className="h-[200px] w-full">
                        <ul className="space-y-2 pr-4">
                        {conceptsMap.relationships.map((rel, index) => (
                            <li key={`rel-${index}`} className="text-sm flex items-center flex-wrap gap-1 p-2 border rounded-md bg-background">
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

          {/* Code Insight Tab */}
           {hasCodeAnalysisContent && codeAnalysis && (
             <TabsContent value="code" className="space-y-4">
               {codeAnalysis.learnedConcept && (
                 <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-md border border-primary/20 dark:border-primary/30">
                   <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-primary dark:text-primary-foreground/80"><BrainCircuit className="h-4 w-4"/>Concept Learned / Problem Solved</h3>
                   <p className="whitespace-pre-wrap text-foreground">{codeAnalysis.learnedConcept}</p>
                 </div>
               )}
               {codeAnalysis.finalCodeSnippet && (
                 <Card className="bg-muted/10 overflow-hidden">
                   <CardHeader className="p-3 pb-2 bg-muted/20 border-b relative"> {/* Add relative positioning */}
                     <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                       <CardTitle className="text-sm font-medium">Final Code Example</CardTitle>
                       {codeAnalysis.codeLanguage && <Badge variant="default" className="text-xs mt-1 md:mt-0">{codeAnalysis.codeLanguage}</Badge>}
                     </div>
                     {codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: {codeAnalysis.codeLanguage}</CardDescription>}
                     {!codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: Not detected</CardDescription>}
                      {/* Save Code Button */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveCode}
                            disabled={isSavingCode || !codeSnippetExists}
                            className="absolute top-3 right-3"
                            aria-label="Save Code Snippet"
                        >
                            {isSavingCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingCode ? 'Saving...' : 'Save'}
                        </Button>
                   </CardHeader>
                   <CardContent className="p-0">
                     <ScrollArea className="max-h-[400px] w-full">
                       <pre className="p-4 text-xs bg-background/50 text-foreground whitespace-pre-wrap break-words">
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

           {/* Study Notes Tab */}
           {hasStudyNotesContent && (
                <TabsContent value="notes">
                    <div className="bg-secondary/10 p-4 rounded-md border border-secondary/20">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-md font-semibold flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-secondary-foreground" />
                            Study Notes
                            </h3>
                            {/* Save Notes Button */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes || !notesExist}
                                aria-label="Save Study Notes"
                            >
                                {isSavingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {isSavingNotes ? 'Saving...' : 'Save Notes'}
                            </Button>
                        </div>

                         {notesExist ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-2 prose-ul:my-2 prose-li:my-0 prose-li:marker:text-muted-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-strong:font-semibold text-foreground">
                                <SimpleMarkdownRenderer content={studyNotes} />
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm italic">No study notes were generated.</p>
                        )}
                    </div>
                </TabsContent>
            )}

        </Tabs>
      </CardContent>
      {/* Optional: Add a general footer if needed */}
      {/* <CardFooter> ... </CardFooter> */}
    </Card>
  );
}
