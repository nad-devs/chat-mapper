
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
import { Separator } from '@/components/ui/separator';
import { FileText, Link as LinkIcon, ListTree, Shapes, Tags } from 'lucide-react'; // Added Tags icon

interface TopicDisplayProps {
  results: ProcessedConversationResult;
}

export function TopicDisplay({ results }: TopicDisplayProps) {
  const { topicsSummary, keyTopics, conceptsMap } = results; // Destructure keyTopics

  // Check if there's anything to display
  if (!topicsSummary && !(keyTopics && keyTopics.length > 0) && !conceptsMap) {
    return null;
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Conversation Analysis</CardTitle>
        <CardDescription>Topics, concepts, and relationships found in the conversation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={['summary', 'concepts']} className="w-full">

          {/* Summary & Key Topics Section */}
          {(topicsSummary || (keyTopics && keyTopics.length > 0)) && (
            <AccordionItem value="summary">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                   <FileText className="h-5 w-5 text-secondary-foreground" />
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
                          <Badge key={`keytopic-${index}`} variant="default">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                 )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Concepts Map Section */}
          {conceptsMap && (conceptsMap.subtopics?.length > 0 || conceptsMap.concepts?.length > 0 || conceptsMap.relationships?.length > 0) && (
            <AccordionItem value="concepts" className="mt-4">
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
                        <Badge key={`subtopic-${index}`} variant="secondary">{subtopic}</Badge>
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
                            <li key={`rel-${index}`} className="text-sm flex items-center gap-2 p-2 border rounded-md bg-background">
                            <Badge variant="secondary" className="shrink-0">{rel.from}</Badge>
                            <span className="text-muted-foreground mx-1">&rarr;</span>
                            <Badge variant="outline" className="italic shrink-0">{rel.type}</Badge>
                            <span className="text-muted-foreground mx-1">&rarr;</span>
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
        </Accordion>
      </CardContent>
    </Card>
  );
}
