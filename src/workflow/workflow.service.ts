import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, StateSchema, START, END, MemorySaver, ReducedValue } from '@langchain/langgraph';
import { z } from 'zod';

// 1. הגדרת ה-State עם Reducer לאיסוף היסטוריה
const PlaygroundState = new StateSchema({
  inputMessage: z.string(),
  currentStatus: z.string().default(''),
  // בעזרת ReducedValue אנחנו אומרים לגרף לא לדרוס את ההיסטוריה, אלא לשרשר אליה!
  history: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (current, update) => current.concat(update) }
  ),
});

@Injectable()
export class WorkflowService implements OnModuleInit {
  private workflow;

  onModuleInit() {
    this.initializeWorkflow();
  }

  private initializeWorkflow() {
    // אתחול מנגנון הזיכרון של LangGraph
    const checkpointer = new MemorySaver();

    const builder = new StateGraph(PlaygroundState)
      
      // שלב 1: דימוי ניתוח בקשה
      .addNode('analyzeStep', async (state) => {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // השהייה של 1.5 שניות
        return { 
          currentStatus: 'ניתוח הבקשה הושלם', 
          history: ['[Analyze] - קראתי את הקלט'] 
        };
      })
      
      // שלב 2: דימוי פעולה (Mock LLM)
      .addNode('processStep', async (state) => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // השהייה של 2 שניות
        return { 
          currentStatus: 'עיבוד המידע הסתיים (Mock LLM)', 
          history: ['[Process] - הפקתי תשובה מדומה'] 
        };
      })

      // ניתוב המסלול
      .addEdge(START, 'analyzeStep')
      .addEdge('analyzeStep', 'processStep')
      .addEdge('processStep', END);

    // קימפול הגרף עם ה-checkpointer!
    this.workflow = builder.compile({ checkpointer });
  }

  // הפונקציה כעת מקבלת גם Callback כדי לשדר כל עדכון שהיא מקבלת
  async runStreamGraph(message: string, threadId: string, onProgress: (chunk: any) => void) {
    // הגדרת מזהה השיחה כדי שה-Checkpointer יידע לשמור ולשלוף את ההיסטוריה
    const config = { configurable: { thread_id: threadId } };

    // במקום invoke, אנו משתמשים ב-stream כדי לקבל את הפלט של כל צומת ברגע שהוא מסיים
    const stream = await this.workflow.stream(
      { inputMessage: message },
      config
    );

    for await (const chunk of stream) {
      // Chunk מכיל את שם הצומת שסיים, ואת מה שהוא החזיר
      // למשל: { "analyzeStep": { currentStatus: "...", history: ["..."] } }
      onProgress(chunk);
    }

    // בסוף הריצה, נשלוף את ה-State המלא (שכולל את כל ההיסטוריה שנצברה)
    const finalState = await this.workflow.getState(config);
    return finalState.values;
  }
}