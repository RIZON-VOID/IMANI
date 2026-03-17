import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing. Please set it in your environment variables for Orbit AI to function.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function generateOrbitPost() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a short, helpful Islamic reminder for a social media post. It could be a Hadith, a Quran verse with context, a daily dua, or an Islamic etiquette tip. Keep it concise, peaceful, and authentic. Return the response as a JSON object with 'title' and 'content' fields.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["title", "content"]
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating Orbit post:", error);
    return {
      title: "Daily Reminder",
      content: "Indeed, with hardship comes ease. [Quran 94:6]",
    };
  }
}

export async function moderateContent(content: string, imageBase64?: string) {
  try {
    const parts: any[] = [
      { text: `Analyze the following content for violations of IMANI's Islamic guidelines. 
      Violations include:
      - Obscenity (nudity, sexual content, inappropriate dress)
      - Misinformation (rumors, unverified claims about Islam)
      - Hate speech (harassment, bullying, sectarianism)
      - Haram products (alcohol, gambling, non-halal food)
      
      Content to analyze: "${content}"
      
      Return a JSON object with:
      - 'isFlagged': boolean
      - 'reason': string (if flagged, explain why)
      - 'confidence': number (0 to 1)` }
    ];

    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: "image/jpeg"
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFlagged: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["isFlagged", "reason", "confidence"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error moderating content:", error);
    return { isFlagged: false, reason: "", confidence: 1 };
  }
}

export async function searchKnowledgeBase(query: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search the Islamic knowledge base for: "${query}". 
      Provide authenticated information from credible sources like Sahih Bukhari, Sahih Muslim, or the Quran.
      Include the source and a brief explanation.
      
      Return a JSON object with:
      - 'title': string
      - 'content': string (the core text/verse/hadith)
      - 'source': string (e.g., Sahih Bukhari 123)
      - 'explanation': string (context or scholarly insight)
      - 'category': 'HADITH' | 'QURAN' | 'SCHOLARLY' | 'ETIQUETTE'`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            source: { type: Type.STRING },
            explanation: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              enum: ["HADITH", "QURAN", "SCHOLARLY", "ETIQUETTE"]
            }
          },
          required: ["title", "content", "source", "explanation", "category"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    return null;
  }
}

export async function chatWithOrbit(message: string, history: { role: 'user' | 'model', parts: [{ text: string }] }[] = []) {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are Orbit, a helpful and knowledgeable AI assistant for IMANI, a halal social media platform. Your goal is to provide authentic Islamic knowledge, etiquette tips, and guidance based on the Quran and Sunnah. Always cite reliable sources like Sahih Bukhari or Sahih Muslim when providing Hadiths. Be peaceful, respectful, and encouraging. If a question is outside Islamic knowledge, try to relate it back to Islamic principles or politely decline if inappropriate.",
      },
      history: history
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Error chatting with Orbit:", error);
    return "I apologize, but I am having trouble connecting right now. Please try again later.";
  }
}
