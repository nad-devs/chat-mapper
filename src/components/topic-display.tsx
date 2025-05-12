
import * as React from 'react';
import type { ProcessedConversationResult } from '@/app/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags, Code } from 'lucide-react'; // Added Code icon

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

export function TopicDisplay({ results }: TopicDisplayProps) {
  const { topicsSummary, keyTopics, conceptsMap, codeAnalysis } = results; // Destructure codeAnalysis

  // Check if there's anything to display
  if (!topicsSummary && !(keyTopics?.length > 0) && !conceptsMap && !(codeAnalysis?.codeExamples?.length > 0)) {
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

  const defaultOpenValues = ['summary'];
  if (conceptsMap?.concepts?.length || conceptsMap?.subtopics?.length || conceptsMap?.relationships?.length) {
    defaultOpenValues.push('concepts');
  }
  if (codeAnalysis?.codeExamples?.length) {
    defaultOpenValues.push('code');
  }


  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Topics, concepts, relationships, and code examples found in the conversation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={defaultOpenValues} className="w-full space-y-4">

          {/* Summary & Key Topics Section */}
          {(topicsSummary || (keyTopics && keyTopics.length > 0)) && (
            <AccordionItem value="summary">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                   <FileText className="h-5 w-5 text-primary-foreground" />
                   <span>Topic Summary & Key Topics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                 {/* Summary Paragraph */}
                 {topicsSummary && (
                    <div className="bg-secondary/30 p-4 rounded-md">
                      <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-secondary-foreground"/>Summary</h3>
                      <p className="text-secondary-foreground">{topicsSummary}</p>
                    </div>
                 )}
                 {/* Key Topics List */}
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
          {conceptsMap && (conceptsMap.subtopics?.length > 0 || conceptsMap.concepts?.length > 0 || conceptsMap.relationships?.length > 0) && (
            <AccordionItem value="concepts" >
               <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                 <div className="flex items-center gap-2">
                    <Shapes className="h-5 w-5 text-muted-foreground" />
                    <span>Concept Map</span>
                 </div>
               </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">

                {/* Subtopics */}
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

                {/* Key Concepts */}
                {conceptsMap.concepts && conceptsMap.concepts.length > 0 && (
                   <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground"/>Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {conceptsMap.concepts.map((concept, index) => (
                        <Badge key={`concept-${index}`} variant="outline" className="border-accent text-accent">{concept}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                 {/* Relationships */}
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

              </AccordionContent>
            </AccordionItem>
          )}

          {/* Code Analysis Section */}
          {codeAnalysis && codeAnalysis.codeExamples && codeAnalysis.codeExamples.length > 0 && (
             <AccordionItem value="code">
               <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                 <div className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-accent" />
                    <span>Code Analysis</span>
                 </div>
               </AccordionTrigger>
               <AccordionContent className="pt-2 space-y-4">
                  {codeAnalysis.codeExamples.map((example, index) => (
                     <Card key={`code-${index}`} className="bg-muted/10 overflow-hidden">
                        <CardHeader className="p-3 pb-2 bg-muted/20 border-b">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-medium">
                                    {example.context || `Code Example ${index + 1}`}
                                </CardTitle>
                                {example.language && <Badge variant="default" className="text-xs">{example.language}</Badge>}
                            </div>
                           {example.context && example.language && <CardDescription className="text-xs pt-1">Language: {example.language}</CardDescription>}
                        </CardHeader>
                        <CardContent className="p-0">
                          {/* Use ScrollArea for potentially long code snippets */}
                          <ScrollArea className="max-h-[300px] w-full">
                            <pre className="p-4 text-xs bg-background/50 text-foreground whitespace-pre-wrap break-words">
                                <code>
                                {example.codeSnippet}
                                </code>
                            </pre>
                          </ScrollArea>
                        </CardContent>
                     </Card>
                  ))}
               </AccordionContent>
             </AccordionItem>
          )}

        </Accordion>
      </CardContent>
    </Card>
  );
}
