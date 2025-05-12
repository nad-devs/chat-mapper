import * as React from 'react';
import type { ProcessedConversationResult } from '@/app/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter // Added CardFooter for potential use
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb, Edit, Save, XCircle, Folder, Loader2 } from 'lucide-react'; // Import icons, added Folder, Loader2

interface TopicDisplayProps {
  results: ProcessedConversationResult;
  onNotesUpdate: (updatedNotes: string) => void; // Callback to update notes LOCALLY in parent
  onSaveNotes: () => void; // Callback to trigger saving notes via action
  isSavingNotes: boolean; // Flag indicating if save action is pending
  hasPendingNoteChanges: boolean; // Flag indicating if notes have been edited locally
}

// Simple Markdown-like renderer (basic bold, list, H3, inline code support)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    // Trim leading/trailing whitespace but preserve internal spaces
    line = line.trimStart().trimEnd();

    // Inline code ticks: `code` becomes <code>code</code>
    const renderInlineCode = (text: string) => {
        // Match code ticks that are not escaped and handle potential nested/complex scenarios better
        const parts = text.split(/(`[^`]+`)/);
        return parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={partIndex} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{part.substring(1, part.length - 1)}</code>;
            }
            return part;
        });
    };

     // Basic bold support: **bold** becomes <strong>bold</strong>
    const renderBold = (text: string) => {
        // Match bold markers that are not escaped
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            // Apply inline code rendering within bold text
            return <strong key={partIndex}>{renderInlineCode(part.substring(2, part.length - 2))}</strong>;
        }
        // Apply inline code rendering to non-bold parts as well
        return renderInlineCode(part);
        });
    };

    if (line.startsWith('## ')) {
      // H3 headings
      // Apply bold and inline code rendering to the heading text
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{renderBold(line.substring(3))}</h3>;
    }
    if (line.startsWith('* ') || line.startsWith('- ')) {
      // Basic bullet points
      // Apply bold and inline code rendering to list item content
      return <li key={index} className="ml-4">{renderBold(line.substring(2))}</li>;
    }
    // Handle empty lines as paragraph breaks more simply
    if (line === '') {
        return <br key={index} />; // Use <br> for potentially better spacing control via CSS if needed
    }

    // Regular paragraph with bold and inline code support
    return (
      <p key={index} className="mb-2 last:mb-0">
        {renderBold(line)}
      </p>
    );
  });

  // Wrap list items in a <ul> if they are consecutive
   const groupedElements: React.ReactNode[] = [];
   let currentList: React.ReactNode[] = [];

   elements.forEach((el, index) => {
     // Check if the element is a list item
     const isListItem = React.isValidElement(el) && el.type === 'li';

     if (isListItem) {
       currentList.push(el);
     } else {
       // If we were building a list, close it and add it to groupedElements
       if (currentList.length > 0) {
         groupedElements.push(<ul key={`ul-${index}`} className="space-y-1 mb-2 list-disc pl-5">{currentList}</ul>);
         currentList = []; // Reset the list
       }
       // Add the current non-list element
       groupedElements.push(el);
     }
   });

   // Add any remaining list items at the end
   if (currentList.length > 0) {
     groupedElements.push(<ul key="ul-last" className="space-y-1 mb-2 list-disc pl-5">{currentList}</ul>);
   }

  return <>{groupedElements}</>;
};


export function TopicDisplay({
    results,
    onNotesUpdate,
    onSaveNotes, // Function to trigger save action in parent
    isSavingNotes, // Boolean indicating if save is in progress
    hasPendingNoteChanges // Boolean indicating local edits exist
}: TopicDisplayProps) {
  // Use nullish coalescing for safer access
  const topicsSummary = results.topicsSummary ?? null;
  const keyTopics = results.keyTopics ?? [];
  const category = results.category ?? null;
  const conceptsMap = results.conceptsMap ?? null;
  const codeAnalysis = results.codeAnalysis ?? null;
  const studyNotes = results.studyNotes ?? null; // The original notes from analysis

  // State for editing study notes - managed within this component
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [editedNotes, setEditedNotes] = React.useState(studyNotes || ""); // Local copy for editing

  // Update local editedNotes if the underlying studyNotes prop changes (e.g., new analysis result)
  // Only update if not currently editing to avoid overwriting user changes
  React.useEffect(() => {
     if (!isEditingNotes) {
        setEditedNotes(studyNotes || "");
     }
    // Exit edit mode if new analysis results come in
    setIsEditingNotes(false);
    // No need to call onNotesUpdate here, as this effect is for syncing incoming props
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyNotes]); // Dependency only on studyNotes prop

  // Handlers for editing notes
  const handleEditNotesClick = () => {
    setEditedNotes(studyNotes || ""); // Reset local state to original on edit start
    setIsEditingNotes(true);
    // Notify parent that no pending changes exist initially when starting edit
    onNotesUpdate(studyNotes || "");
  };

  const handleSaveNotesClick = () => {
    // Call the callback provided by the parent to trigger the save action
    // The parent (`page.tsx`) handles the actual action call
    console.log("[TopicDisplay] Save button clicked, calling onSaveNotes prop.");
    onSaveNotes();
    // Exit edit mode after triggering save. Parent toast will confirm success/failure.
    // Keep edit mode active or inactive based on current state, don't force exit?
    // setIsEditingNotes(false); // Let's not exit edit mode automatically on save trigger
  };

  // Handler for Cancel - revert changes and exit edit mode
  const handleCancelEditClick = () => {
    setIsEditingNotes(false);
    const originalNotes = studyNotes || "";
    setEditedNotes(originalNotes); // Revert local changes
    onNotesUpdate(originalNotes); // Notify parent to clear the 'dirty' state
    console.log("[TopicDisplay] Cancel edit clicked, reverting notes.");
  };

  // Handler for changes in the textarea during edit mode
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedNotes(e.target.value); // Update local state
      onNotesUpdate(e.target.value); // Notify parent about the change immediately
  };


  // Determine if each section has content
  const hasOverviewContent = !!topicsSummary || (keyTopics && keyTopics.length > 0);
  const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet);
  // Study notes tab should always be available, either showing content or allowing adding/editing.
  const hasStudyNotesContent = true; // Always show the notes tab

  const availableTabs = [
    { value: 'overview', label: 'Overview', icon: FileText, hasContent: hasOverviewContent },
    { value: 'concepts', label: 'Concept Map', icon: Shapes, hasContent: hasConceptsContent },
    { value: 'code', label: 'Code Insight', icon: Code, hasContent: hasCodeAnalysisContent },
    { value: 'notes', label: 'Study Notes', icon: Lightbulb, hasContent: hasStudyNotesContent },
  ].filter(tab => tab.hasContent); // Filter out tabs with no content initially

  // If no tabs have content initially (except notes), show a message
  if (availableTabs.length <= 1 && !isEditingNotes && !(studyNotes && studyNotes.trim().length > 0)) {
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
          <p className="text-muted-foreground">No significant topics, concepts, or code insights found in the provided conversation.</p>
             {/* Allow starting edit even if notes are null/empty */}
             <div className="mt-4 flex justify-between items-center bg-secondary/10 p-4 rounded-md border border-secondary/20">
                <h3 className="text-md font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-secondary-foreground" />
                    Study Notes
                </h3>
                <Button variant="ghost" size="sm" onClick={handleEditNotesClick}>
                    <Edit className="h-4 w-4 mr-1" /> Add/Edit Notes
                </Button>
            </div>
             {isEditingNotes && (
                <div className="mt-4 space-y-3 bg-secondary/10 p-4 rounded-md border border-secondary/20">
                     <Textarea
                        value={editedNotes}
                        onChange={handleTextareaChange} // Update local state and notify parent
                        rows={15}
                        className="text-sm"
                        placeholder="Add your study notes..."
                        disabled={isSavingNotes} // Disable textarea while saving
                    />
                    <div className="flex justify-end gap-2">
                         <Button variant="outline" size="sm" onClick={handleCancelEditClick} disabled={isSavingNotes}>
                            <XCircle className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveNotesClick} // Trigger save via parent
                            disabled={isSavingNotes || !hasPendingNoteChanges} // Disable if saving or no changes
                        >
                            {isSavingNotes ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            {isSavingNotes ? 'Saving...' : 'Save Notes'}
                        </Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    );
  }

  // Set default tab to the first available one
  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : 'notes'; // Default to notes if others are empty

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Explore the insights extracted from the conversation. Study notes can be edited and saved.</CardDescription>
         {/* Display Category Badge if available */}
         {category && (
            <Badge variant="outline" className="mt-2 w-fit flex items-center gap-1 text-sm">
                <Folder className="h-3 w-3" /> {category}
            </Badge>
           )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
            {/* Render available tabs */}
             {availableTabs.map((tab) => (
                 tab ? ( // Check if tab is not null/undefined after filtering
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
                <div className="bg-secondary/30 p-4 rounded-md">
                  <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-secondary-foreground"/>Summary</h3>
                  <p className="text-secondary-foreground">{topicsSummary}</p>
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
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-muted-foreground"/>Key Concepts</h3> {/* Updated icon */}
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
                 <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
                   <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary"/>Concept Learned / Problem Solved</h3>
                   {/* Use standard foreground color for readability */}
                   <p className="whitespace-pre-wrap text-foreground">{codeAnalysis.learnedConcept}</p>
                 </div>
               )}
               {codeAnalysis.finalCodeSnippet && (
                 <Card className="bg-muted/10 overflow-hidden">
                   <CardHeader className="p-3 pb-2 bg-muted/20 border-b">
                     <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                       <CardTitle className="text-sm font-medium">Final Code Example</CardTitle>
                       {codeAnalysis.codeLanguage && <Badge variant="default" className="text-xs mt-1 md:mt-0">{codeAnalysis.codeLanguage}</Badge>}
                     </div>
                     {codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: {codeAnalysis.codeLanguage}</CardDescription>}
                     {!codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: Not detected</CardDescription>}
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
                   No specific code snippet identified for this concept in the conversation.
                 </div>
               )}
                {!codeAnalysis.learnedConcept && !codeAnalysis.finalCodeSnippet && (
                 <div className="text-muted-foreground text-sm p-4 border border-dashed rounded-md">
                   No code concepts or snippets were identified in this conversation.
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
                            {/* Control buttons */}
                            <div className="flex gap-2">
                                {!isEditingNotes && (
                                    <>
                                    {/* Persistent Save Button */}
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleSaveNotesClick} // Trigger save via parent
                                        disabled={isSavingNotes || (!hasPendingNoteChanges && !(editedNotes && editedNotes.trim().length > 0))} // Disable if saving OR no changes AND notes are empty
                                        title={hasPendingNoteChanges ? "Save pending changes" : "Save current notes"}
                                    >
                                        {isSavingNotes ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                        {isSavingNotes ? 'Saving...' : 'Save Notes'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={handleEditNotesClick}>
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                    </Button>
                                    </>
                                )}
                                {isEditingNotes && (
                                    <>
                                        <Button variant="outline" size="sm" onClick={handleCancelEditClick} disabled={isSavingNotes}>
                                            <XCircle className="h-4 w-4 mr-1" /> Cancel
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleSaveNotesClick} // Trigger save via parent
                                            disabled={isSavingNotes || !hasPendingNoteChanges} // Disable if saving or no changes
                                        >
                                            {isSavingNotes ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                            {isSavingNotes ? 'Saving...' : 'Save Notes'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                         {isEditingNotes ? (
                            <div className="space-y-3">
                                <Textarea
                                    value={editedNotes}
                                    onChange={handleTextareaChange} // Update local state and notify parent
                                    rows={15}
                                    className="text-sm"
                                    placeholder="Edit your study notes..."
                                    disabled={isSavingNotes} // Disable textarea while saving
                                />
                                {/* Buttons are moved above */}
                            </div>
                        ) : (
                             // Display rendered notes or a message if empty
                             editedNotes && editedNotes.trim().length > 0 ? ( // Check editedNotes which reflects original or saved state
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-2 prose-ul:my-2 prose-li:my-0 prose-li:marker:text-muted-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-strong:font-semibold text-foreground">
                                    <SimpleMarkdownRenderer content={editedNotes} />
                                </div>
                            ) : (
                                // Show message if no notes exist and not editing
                                <p className="text-muted-foreground text-sm italic">No study notes were generated for this conversation. Click 'Edit' to add some.</p>
                            )
                        )}
                    </div>
                </TabsContent>
            )}

        </Tabs>
      </CardContent>
    </Card>
  );
}
