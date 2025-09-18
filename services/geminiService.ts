import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { Question, ChatMessage, UserProfile, Difficulty } from '../types';

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

let chat: Chat | null = null;

export const getTutorResponse = async (newMessage: string, profile: UserProfile): Promise<string> => {
    try {
        if (!chat) {
            chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: `You are Teststar AI, a friendly, patient, and highly knowledgeable tutor for a grade ${profile.grade} student studying under the ${profile.board} board. Your name is Nova. Explain concepts clearly and simply, using analogies relevant to their age. Be encouraging and helpful. Keep responses concise unless asked for details.`,
                },
            });
        }
        
        const response: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
        return response.text;
    } catch (error) {
        console.error("Error getting tutor response:", error);
        throw new Error("Failed to get a response from the AI Tutor.");
    }
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
        
        Generate concise, easy-to-understand study notes on this topic. The notes should be structured to be highly effective for learning and revision. Please include the following sections:
        
        1.  **Introduction**: A brief, simple overview of the topic.
        2.  **Key Concepts/Definitions**: A list of the most important terms and their clear, simple definitions. Use a bulleted list.
        3.  **Main Points**: Explain the core concepts of the topic in a step-by-step or logical manner. Use numbered lists or bullet points to break down complex information.
        4.  **Simple Examples**: Provide one or two relatable, age-appropriate examples to illustrate the main points.
        5.  **Summary**: A short summary paragraph that recaps the most critical information.
        
        Keep the language clear, simple, and engaging for a grade ${grade} student. Format the response cleanly using markdown for headings and lists.`;

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