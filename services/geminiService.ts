import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { Question, ChatMessage, UserProfile, Difficulty, Goal } from '../types';

// FIX: Removed conditional API_KEY assignment to adhere to guidelines.
// The API key must be provided via environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const testSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            questionText: { type: Type.STRING },
            questionType: { type: Type.STRING, enum: ['MCQ', 'SHORT', 'LONG'] },
            marks: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: 'Array of 4 options. Only for MCQ type.'
            },
            correctOptionIndex: { 
                type: Type.INTEGER,
                description: 'Index of the correct option. Only for MCQ type.'
            },
            modelAnswer: {
                type: Type.STRING,
                description: 'The correct answer or key points for SHORT or LONG answer questions.'
            }
        },
        required: ["questionText", "questionType", "marks", "topic"]
    }
};

export const studyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        weeklyPlan: {
            type: Type.ARRAY,
            description: "An array of 7 objects, one for each day of the week.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.STRING, description: "The day of the week (e.g., Monday)." },
                    focus: { type: Type.STRING, description: "A brief summary of the main focus for the day." },
                    tasks: {
                        type: Type.ARRAY,
                        description: "A list of specific, actionable study tasks for the day.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING, description: "The task description." },
                                completed: { type: Type.BOOLEAN, description: "Set to false by default." }
                            },
                            required: ["description", "completed"]
                        }
                    }
                },
                required: ["day", "focus", "tasks"]
            }
        }
    },
    required: ["weeklyPlan"]
};


export const generateTestQuestions = async (
    subject: string, 
    topic: string, 
    grade: number, 
    board: string,
    totalMarks: number,
    questionCounts: { MCQ: number; SHORT: number; LONG: number; },
    difficulty: Difficulty
): Promise<Question[]> => {
    try {
        const includedQuestionTypes = (Object.entries(questionCounts) as [keyof typeof questionCounts, number][])
            .filter(([, count]) => count > 0)
            .map(([type, count]) => `${count} ${type} question${count > 1 ? 's' : ''}`);

        if (includedQuestionTypes.length === 0) {
            // This case should be handled by the UI, but as a safeguard:
            throw new Error("At least one question type must have a count greater than 0.");
        }
        
        const totalQuestions = Object.values(questionCounts).reduce((a, b) => a + b, 0);

        const difficultyInstructions = {
            Easy: 'The questions should be straightforward, testing basic knowledge and recall. Use simple language. MCQs should have one clearly correct answer and obviously incorrect distractors.',
            Medium: 'The questions should require some application of concepts and understanding, not just recall. The wording can be slightly more complex. MCQs can have more plausible distractors.',
            Hard: 'The questions should be challenging, requiring synthesis of multiple concepts, critical thinking, or problem-solving skills. They can involve multi-step problems or nuanced scenarios. MCQs should have very subtle and plausible distractors.'
        };

        const prompt = `Generate a test for a grade ${grade} student studying under the ${board} board.
        Subject: ${subject}
        Topic: ${topic}
        Total Marks: ${totalMarks}
        Difficulty Level: ${difficulty}

        **Difficulty Guidelines**: ${difficultyInstructions[difficulty]}
        
        The test must be structured precisely as follows:
        - It must contain exactly these question types and counts: ${includedQuestionTypes.join(', ')}.
        - The total number of questions must be ${totalQuestions}.
        - IMPORTANT: The sum of marks for all generated questions MUST add up to exactly ${totalMarks}. You must intelligently distribute the marks across the questions to meet this total.
        
        For each question, provide:
        - "questionText": The question itself.
        - "questionType": Must be one of 'MCQ', 'SHORT', or 'LONG', matching the requested counts.
        - "marks": The marks allocated to the question. The sum of all marks must be ${totalMarks}.
        - "topic": A specific sub-topic related to the main topic '${topic}'.
        
        For 'MCQ' questions, you MUST ALSO provide:
        - "options": An array of exactly 4 distinct strings. IMPORTANT: Every string in this array must be a non-empty, plausible answer choice. Do not generate empty strings for options.
        - "correctOptionIndex": The 0-based index of the correct option in the "options" array.
        
        For 'SHORT' and 'LONG' answer questions, ALSO provide:
        - "modelAnswer": A detailed model answer.
        
        Structure the entire output as a single JSON array of question objects, adhering to the provided schema and all the constraints above. Verify the total marks and question counts before finalizing the output.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: testSchema,
                temperature: 0.5,
            },
        });
        
        const jsonText = response.text.trim();
        const questions = JSON.parse(jsonText) as Question[];

        // Validate generated questions to prevent app errors
        for (const q of questions) {
            if (q.questionType === 'MCQ') {
                if (!q.options || q.options.length !== 4 || q.options.some(opt => !opt || opt.trim() === '')) {
                    console.error("Invalid MCQ question generated:", q);
                    throw new Error("The AI generated a question with invalid or empty options. Please try generating the test again.");
                }
            }
        }

        const generatedMarks = questions.reduce((sum, q) => sum + q.marks, 0);
        if (generatedMarks !== totalMarks) {
            console.warn(`Generated test marks (${generatedMarks}) do not match requested total marks (${totalMarks}). The AI may adjust to meet constraints.`);
        }

        return questions;

    } catch (error) {
        console.error("Error generating test questions:", error);
        if (error instanceof Error && error.message.includes("invalid or empty options")) {
            throw error;
        }
        throw new Error("Failed to generate test questions. The AI may be unable to create a test with the specified constraints. Please try adjusting the topic or marks.");
    }
};


export const generateSolution = async (question: Question, selectedOption: string, grade: number): Promise<string> => {
    try {
        const prompt = `A grade ${grade} student answered a question incorrectly. Here are the details:
- Question: "${question.questionText}"
- Options: ${question.options?.join('; ')}
- Correct Answer: "${question.options?.[question.correctOptionIndex!]}"
- Student's Incorrect Answer: "${selectedOption}"

Please provide a helpful explanation. Structure your response as follows:
1.  **Restate the Question**: Begin your response by repeating the question text exactly.
2.  **Analyze the Incorrect Answer**: Briefly explain the common mistake or misunderstanding that leads to the student's incorrect answer.
3.  **Provide the Correct Solution**: Give a clear, step-by-step walkthrough of how to arrive at the correct answer.
4.  **Be Encouraging**: End with a positive and encouraging note.`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        return response.text;
    } catch (error) {
        console.error("Error generating solution:", error);
        throw new Error("Failed to generate solution.");
    }
};

export const createTutorChat = (profile: UserProfile, withSearch: boolean): Chat => {
    const config: any = {
        systemInstruction: `You are Teststar AI, a friendly, patient, and highly knowledgeable tutor for a grade ${profile.grade} student studying under the ${profile.board} board. Your name is Nova. Explain concepts clearly and simply, using analogies relevant to their age. Be encouraging and helpful. Keep responses concise unless asked for details.`,
    };

    if (withSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config,
    });
};

export const generateFunContent = async (type: 'poem' | 'story', topic: string, grade: number): Promise<string> => {
    try {
        const prompt = `Generate a short, creative, and engaging ${type} for a grade ${grade} student on the following topic: "${topic}". 
        
        Keep the language simple, age-appropriate, and imaginative.
        - If it's a story, it should have a clear beginning, middle, and end, with a simple moral or lesson if possible.
        - If it's a poem, it should have a nice rhythm and use vivid imagery.
        
        The output should be the text of the ${type} directly.`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.7
            }
        });

        return response.text;
    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        throw new Error(`Failed to generate the ${type}. Please try another topic.`);
    }
};

export const generateStudyNotes = async (topic: string, grade: number, board: string): Promise<string> => {
    try {
        const prompt = `Act as an expert educator creating study material for a grade ${grade} student of the ${board} board.
        
        Topic: "${topic}"
        
        Generate concise, easy-to-understand study notes on this topic. The notes should be structured to be highly effective for learning and revision.
        
        IMPORTANT: Format the entire response as a single block of clean, simple HTML. Use only basic tags: <h2> for section titles, <p> for paragraphs, <ul> and <li> for bulleted lists, <ol> for numbered lists, and <strong> for important terms. Do NOT include <html>, <head>, or <body> tags.

        Please include the following HTML structure:
        
        <h2>Introduction</h2>
        <p>A brief, simple overview of the topic.</p>
        
        <h2>Key Concepts/Definitions</h2>
        <ul>
          <li><strong>Important Term:</strong> Its clear, simple definition.</li>
        </ul>
        
        <h2>Main Points</h2>
        <ol>
          <li>Explain the first core concept. Use paragraphs to break down complex information.</li>
          <li>Explain the next core concept.</li>
        </ol>
        
        <h2>Simple Examples</h2>
        <p>Provide one or two relatable, age-appropriate examples to illustrate the main points.</p>
        
        <h2>Summary</h2>
        <p>A short summary paragraph that recaps the most critical information.</p>
        
        Keep the language clear, simple, and engaging for a grade ${grade} student.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.3 // Lower temperature for more factual, less creative output
            }
        });

        return response.text;
    } catch (error) {
        console.error("Error generating study notes:", error);
        throw new Error(`Failed to generate study notes for "${topic}". Please try another topic.`);
    }
};

export const generateRandomQuiz = async (grade: number, board: string): Promise<Question[]> => {
    try {
        const prompt = `Generate a short, fun, and random quiz for a grade ${grade} student (${board} board).
        
        The quiz must have exactly 5 multiple-choice (MCQ) questions.
        Each question should be worth 1 mark.
        The topic should be a random, interesting, and age-appropriate subject from general knowledge, science, or history.
        
        For each question, you MUST provide:
        - "questionText": The question itself.
        - "questionType": This must be 'MCQ'.
        - "marks": This must be 1.
        - "topic": A specific sub-topic for the question (e.g., "Solar System", "Ancient Rome").
        - "options": An array of exactly 4 distinct, plausible string options.
        - "correctOptionIndex": The 0-based index of the correct option.
        
        Structure the entire output as a single JSON array of 5 question objects.`;

        const quizSchema = { ...testSchema };
        // We only want MCQs for this random quiz.
        quizSchema.items.properties.questionType = { type: Type.STRING, enum: ['MCQ'] };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
                temperature: 0.8,
            },
        });
        
        const jsonText = response.text.trim();
        const questions = JSON.parse(jsonText) as Question[];
        
        // Basic validation
        if (questions.length !== 5 || questions.some(q => q.questionType !== 'MCQ')) {
             throw new Error("AI returned an invalid quiz format.");
        }

        return questions;
    } catch (error) {
        console.error("Error generating random quiz:", error);
        throw new Error("Failed to generate a random quiz. Please try again.");
    }
};

export const generateStudyPlan = async (weakAreas: string[], goals: Goal[], profile: UserProfile): Promise<any> => {
    try {
        const goalsString = goals.map(g => `- ${g.description}`).join('\n');

        const prompt = `You are an expert academic coach for a grade ${profile.grade} student. 
        
        Based on the following information, create a structured, actionable, and encouraging 7-day study plan.
        
        **Student Profile:**
        - Grade: ${profile.grade}
        - Board: ${profile.board}
        
        **Identified Weak Areas (from past tests):**
        ${weakAreas.length > 0 ? weakAreas.map(area => `- ${area}`).join('\n') : "- No specific weak areas identified yet. Focus on general revision."}
        
        **Active Goals:**
        ${goals.length > 0 ? goalsString : "- No active goals set. Focus on building a consistent study habit."}
        
        **Instructions:**
        1.  Create a plan for the next 7 days, starting from Monday.
        2.  For each day, provide a main "focus" and a short list of 2-4 concrete "tasks".
        3.  The tasks should directly address the weak areas and help achieve the stated goals.
        4.  Mix different activities: revision, practice problems, taking a short quiz (suggested), and creating flashcards.
        5.  Keep the daily workload manageable and include at least one rest day or a very light day.
        6.  The tone should be positive and motivational.
        
        Return the entire plan as a single JSON object that strictly adheres to the provided schema.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: studyPlanSchema,
                temperature: 0.6,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating study plan:", error);
        throw new Error("Failed to generate a study plan. The AI might be temporarily unavailable. Please try again later.");
    }
};