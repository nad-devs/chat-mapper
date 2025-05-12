import * as React from 'react';
// Import the updated AnalyzeCodeOutput type
import type { ProcessedConversationResult, AnalyzeCodeOutput } from '@/app/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code, BrainCircuit } from 'lucide-react'; // Added BrainCircuit icon

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

export function TopicDisplay({ results }: TopicDisplayProps) {
  // Destructure the potentially null codeAnalysis object
  const { topicsSummary, keyTopics, conceptsMap, codeAnalysis } = results;

  // Check if there's anything *at all* to display
   const hasSummary = topicsSummary || (keyTopics && keyTopics.length > 0);
   const hasConcepts = conceptsMap && (conceptsMap.concepts?.length > 0 || conceptsMap.subtopics?.length > 0 || conceptsMap.relationships?.length > 0);
   // Check specifically if the simplified code analysis has content
   const hasCodeAnalysis = codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet);

   if (!hasSummary && !hasConcepts && !hasCodeAnalysis) {
    return (
         <Card className="w-full mt-6">
            <CardHeader>
                <CardTitle>Conversation Analysis</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">No significant topics, concepts, or code examples found in the provided conversation.</p>
            </CardContent>
         </Card>
    );
  }

  // Determine default open sections
  const defaultOpenValues = [];
  if (hasSummary) defaultOpenValues.push('summary');
  if (hasConcepts) defaultOpenValues.push('concepts');
  if (hasCodeAnalysis) defaultOpenValues.push('code');
  // If nothing else is present, open summary by default if it exists, otherwise concepts, etc.
  if (defaultOpenValues.length === 0 && hasSummary) defaultOpenValues.push('summary');
  else if (defaultOpenValues.length === 0 && hasConcepts) defaultOpenValues.push('concepts');
  else if (defaultOpenValues.length === 0 && hasCodeAnalysis) defaultOpenValues.push('code');


  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Topics, concepts, relationships, and code insights found in the conversation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={defaultOpenValues} className="w-full space-y-4">

          {/* Summary & Key Topics Section */}
          {hasSummary && (
            <AccordionItem value="summary">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                   <FileText className="h-5 w-5 text-primary-foreground" />
                   <span>Topic Summary & Key Topics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
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
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Concepts Map Section */}
          {hasConcepts && (
            <AccordionItem value="concepts" >
               <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                 <div className="flex items-center gap-2">
                    <Shapes className="h-5 w-5 text-muted-foreground" />
                    <span>Concept Map</span>
                 </div>
               </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                {conceptsMap?.subtopics && conceptsMap.subtopics.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><ListTree className="h-4 w-4 text-muted-foreground"/>Subtopics</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.subtopics.map((subtopic, index) => (
                        <Badge key={`subtopic-${index}`} variant="outline" className="border-muted-foreground/50 text-muted-foreground">{subtopic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap?.concepts && conceptsMap.concepts.length > 0 && (
                   <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground"/>Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.concepts.map((concept, index) => (
                        <Badge key={`concept-${index}`} variant="outline" className="border-accent text-accent">{concept}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {conceptsMap?.relationships && conceptsMap.relationships.length > 0 && (
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
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Simplified Code Analysis Section */}
          {hasCodeAnalysis && codeAnalysis && ( // Check if codeAnalysis exists and has content
             <AccordionItem value="code">
               <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                 <div className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-accent" />
                    <span>Code Insight</span>
                 </div>
               </AccordionTrigger>
               <AccordionContent className="pt-2 space-y-4">
                  {/* Display Learned Concept */}
                  {codeAnalysis.learnedConcept && (
                     <div className="bg-accent/10 p-4 rounded-md">
                        <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-accent"/>Concept Learned / Problem Solved</h3>
                        {/* Changed text color to foreground for better contrast */}
                        <p className="text-foreground">{codeAnalysis.learnedConcept}</p>
                     </div>
                  )}
                  {/* Display Final Code Snippet */}
                  {codeAnalysis.finalCodeSnippet && (
                     <Card className="bg-muted/10 overflow-hidden">
                        <CardHeader className="p-3 pb-2 bg-muted/20 border-b">
                            <div className="flex justify-between items-start md:items-center flex-col md:flex-row">
                                <CardTitle className="text-sm font-medium">
                                    Final Code Example
                                </CardTitle>
                                {codeAnalysis.codeLanguage && <Badge variant="default" className="text-xs">{codeAnalysis.codeLanguage}</Badge>}
                            </div>
                           {codeAnalysis.codeLanguage && <CardDescription className="text-xs pt-1">Language: {codeAnalysis.codeLanguage}</CardDescription>}
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="max-h-[400px] w-full"> {/* Increased max height */}
                            <pre className="p-4 text-xs bg-background/50 text-foreground whitespace-pre-wrap break-words">
                                <code>
                                {codeAnalysis.finalCodeSnippet}
                                </code>
                            </pre>
                          </ScrollArea>
                        </CardContent>
                     </Card>
                  )}
               </AccordionContent>
             </AccordionItem>
          )}

        </Accordion>
      </CardContent>
    </Card>
  );
}
