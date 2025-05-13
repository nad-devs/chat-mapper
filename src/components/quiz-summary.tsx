
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Brain, ArrowLeft } from 'lucide-react';
import type { QuizTopic } from '@/ai/flows/generate-quiz-topics'; // Assuming QuizTopic type is here

interface QuizSummaryProps {
    remembered: QuizTopic[];
    review: QuizTopic[];
    onRestart: () => void;
}

export function QuizSummary({ remembered, review, onRestart }: QuizSummaryProps) {
    return (
        <Card className="w-full mt-6 shadow-lg border-border/50 overflow-hidden">
            {/* Gradient accent */}
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-1"></div>
            <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                     <Brain className="mr-3 h-6 w-6 text-primary" /> Quiz Summary
                </CardTitle>
                <CardDescription>Here's a breakdown of the topics you recalled and those marked for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Remembered Section */}
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="mr-2 h-5 w-5" /> Remembered Topics ({remembered.length})
                    </h3>
                    {remembered.length > 0 ? (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                            <ul className="space-y-3 list-disc pl-5">
                                {remembered.map((item, index) => (
                                    <li key={`remembered-${index}`} className="text-sm text-foreground/90"> {/* Ensure good contrast */}
                                        <span className="font-medium text-foreground">{item.topic}:</span> {item.context}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/50"> {/* Add border */}
                           <p className="text-muted-foreground text-sm italic">No topics marked as remembered.</p>
                        </div>
                    )}
                </div>
                 {/* Needs Review Section */}
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-amber-600 dark:text-amber-400">
                        <AlertCircle className="mr-2 h-5 w-5" /> Needs Review ({review.length})
                    </h3>
                    {review.length > 0 ? (
                         <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                            <ul className="space-y-3 list-disc pl-5">
                                {review.map((item, index) => (
                                    <li key={`review-${index}`} className="text-sm text-foreground/90"> {/* Ensure good contrast */}
                                        <span className="font-medium text-foreground">{item.topic}:</span> {item.context}
                                    </li>
                                ))}
                            </ul>
                         </div>
                    ) : (
                         <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/50"> {/* Add border */}
                             <p className="text-muted-foreground text-sm italic">No topics marked for review.</p>
                         </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-border/50 bg-muted/20 p-4"> {/* Adjusted background and border */}
                 <p className="text-sm text-muted-foreground">
                     {remembered.length > 0 && review.length === 0
                         ? "Great job! You've remembered all topics."
                         : "Keep practicing the topics marked for review."}
                 </p>
                 <Button onClick={onRestart} variant="outline" className="shadow-sm">
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back to Analysis Results
                 </Button>
             </CardFooter>
        </Card>
    );
}
