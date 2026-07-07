import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI client (only on server, keep API key safe!)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoints
app.post("/api/insights", async (req, res) => {
  try {
    const { trackers, logs } = req.body;

    if (!trackers || !Array.isArray(trackers) || !logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Invalid data format. Trackers and logs are required." });
    }

    if (trackers.length === 0 || logs.length === 0) {
      return res.json({
        insights: [
          {
            title: "Insufficient Tracking Data",
            description: "Start logging data daily for your trackers. Once you have logged some values, the AI will analyze your entries to uncover hidden trends, correlations, and performance patterns.",
            type: "info",
            trackerName: "General"
          }
        ]
      });
    }

    // Prepare content for Gemini
    const systemInstruction = "You are an expert personal data analyst and behavioral scientist. Your goal is to analyze user's daily habits, wellness, productivity, or custom metrics trackers and their historical log entries. You must produce exactly 3 highly specific, text-based, actionable insights (recommendations or observations) based on their actual logs, goals, and patterns. Keep the tone professional, objective, encouraging, and clear.";

    const prompt = `
Analyze the user's trackers and log entries.

Trackers:
${JSON.stringify(trackers.map(t => ({ id: t.id, name: t.name, category: t.category, type: t.type, unit: t.unit, targetValue: t.targetValue })), null, 2)}

Log Entries:
${JSON.stringify(logs.map(l => ({ trackerId: l.trackerId, value: l.value, date: l.date, note: l.note })), null, 2)}

Identify any correlations, weekend vs. weekday shifts, progress towards goals, or areas of potential improvement.
Provide exactly 3 actionable insights with the following schema:
- title: Short, punchy insight name (e.g., "Consistent Weekend Sleep Dip" or "Excellent Fitness Habit consistency").
- description: Clear, explanatory text explaining the pattern seen in the data and a concrete, actionable recommendation to improve or maintain.
- type: Categorize as either "success" (for positive trends), "warning" (for issues or dips), or "info" (general interesting correlations or tips).
- trackerName: The name of the main tracker this relates to, or "General" if it relates to multiple.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              description: "A list of exactly 3 actionable insights.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["success", "warning", "info"] },
                  trackerName: { type: Type.STRING }
                },
                required: ["title", "description", "type", "trackerName"]
              }
            }
          },
          required: ["insights"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini API");
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.error("Gemini insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate insights." });
  }
});

// Vite middleware setup for development, or static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
