import * as React from 'react';
import type { ProcessedConversationResult } from '@/app/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit, Lightbulb } from 'lucide-react'; // Added Lightbulb icon

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

// Simple Markdown-like renderer (basic bold and list support)
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements = lines.map((line, index) => {
    line = line.trim();
    if (line.startsWith('* ') || line.startsWith('- ')) {
      // Basic bullet points
      return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
    }
    // Basic bold support
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={index} className="mb-2 last:mb-0">
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={partIndex}>{part.substring(2, part.length - 2)}</strong>;
          }
          return part;
        })}
      </p>
    );
  });

  // Wrap list items in a <ul> if any exist
  const hasListItems = elements.some(el => el.type === 'li');
  if (hasListItems) {
    return <ul className="space-y-1">{elements}</ul>;
  }

  return <>{elements}</>;
};


export function TopicDisplay({ results }: TopicDisplayProps) {
  const { topicsSummary, keyTopics, conceptsMap, codeAnalysis, struggleNotes } = results;

  // Determine if each section has content
  const hasOverviewContent = !!topicsSummary || (keyTopics && keyTopics.length > 0);
  const hasConceptsContent = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
  const hasCodeAnalysisContent = codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet);
  const hasStruggleNotesContent = !!struggleNotes;

  const availableTabs = [
    { value: 'overview', label: 'Overview', icon: FileText, hasContent: hasOverviewContent },
    { value: 'concepts', label: 'Concept Map', icon: Shapes, hasContent: hasConceptsContent },
    { value: 'code', label: 'Code Insight', icon: Code, hasContent: hasCodeAnalysisContent },
    { value: 'notes', label: 'Study Notes', icon: Lightbulb, hasContent: hasStruggleNotesContent },
  ].filter(tab => tab.hasContent); // Filter out tabs with no content

  // If no tabs have content, show a message
  if (availableTabs.length === 0) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Conversation Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No significant topics, concepts, code insights, or study notes found in the provided conversation.</p>
        </CardContent>
      </Card>
    );
  }

  // Set default tab to the first available one
  const defaultTabValue = availableTabs[0].value;

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Explore the insights extracted from the conversation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
            {availableTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                 <tab.icon className="mr-2 h-4 w-4" />
                 {tab.label}
              </TabsTrigger>
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
                 <div className="bg-accent/10 p-4 rounded-md">
                   <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-accent"/>Concept Learned / Problem Solved</h3>
                   <p className="text-foreground whitespace-pre-wrap">{codeAnalysis.learnedConcept}</p>
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
             </TabsContent>
           )}

           {/* Study Notes Tab */}
           {hasStruggleNotesContent && struggleNotes && (
                <TabsContent value="notes">
                    <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
                        <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                           <Lightbulb className="h-4 w-4 text-primary-foreground" />
                           Notes on Areas of Struggle/Clarification
                        </h3>
                        <div className="text-primary-foreground prose prose-sm max-w-none prose-strong:text-primary-foreground prose-li:marker:text-primary-foreground">
                            <SimpleMarkdownRenderer content={struggleNotes} />
                        </div>
                    </div>
                </TabsContent>
            )}

        </Tabs>
      </CardContent>
    </Card>
  );
}
