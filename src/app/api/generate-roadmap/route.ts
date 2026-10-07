// NextRequest - handles incoming requests in Next.js API routes
// NextResponse - used to send responses back to the client
import { NextRequest, NextResponse } from "next/server";
// jsonrepair - library to repair malformed JSON strings
import { jsonrepair } from "jsonrepair";
import { groqModel } from '@/app/_libs/distributed';

// load environment variables from .env file (make sure it's also set in Vercel dashboard)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Groq API endpoint for chat completions
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// MODEL - the specific model to use for the API request
const MODEL = groqModel;

function parseRoadmapResponse(content: unknown) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty response from Groq');
  }

  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fencedMatches = [...withoutThinking.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  const candidate = fencedMatches.at(-1)?.[1] ?? withoutThinking;
  const roadmapStarts = [...candidate.matchAll(/\{\s*"missingSkills"\s*:/g)];
  const start = roadmapStarts.at(-1)?.index ?? candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('Groq response did not contain a JSON object');
  }

  return JSON.parse(jsonrepair(candidate.slice(start, end + 1)));
}

// Ensure Node.js runtime (not Edge, since axios/fetch in Edge may behave differently)
export const runtime = "nodejs";

// post function - handles POST requests to the API route
export async function POST(req: NextRequest) {
  try {
    // takes the request body
    const body = await req.json();
    const { skills, role } = body;

    if (!skills || !role) {
      return NextResponse.json(
        { error: "Missing fields: skills or role" },
        { status: 400 }
      );
    }

    // prompt - the message sent to the LLaMA model to generate a personalized learning roadmap
    const prompt = `
You are a helpful career assistant.

The user wants to become a "${role}". They currently have these skills: ${skills}.

1. Identify essential skills they are missing.
2. Build a 30-day learning roadmap.
3. For each day, include:
  - "day" (number)
  - "topic" (short descriptive title)
  - "subtasks" (2-4 bullet points)

4. Don't fail to give subtasks for each day.
Respond ONLY in JSON using this format:

{
  "missingSkills": ["skill1", "skill2"],
  "roadmap": [
    { "day": 1, "topic": "Title", "subtasks": ["task1", "task2"] }
  ]
}
Do not include markdown or explanations.
`;

    // response - sends a POST request to the LLaMA API with the prompt and model details
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    // check if API request succeeded
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Groq API Error:", response.status, errorText);
      return NextResponse.json(
        { error: "Groq API request failed", detail: errorText },
        { status: response.status }
      );
    }

    // parse the response
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("🧠 Raw LLaMA Response:", content);

    let json;
    try {
      // Strip potential markdown code fences or extra noise
      // This regex captures JSON content within code blocks or directly
      // It handles both fenced code blocks (```json) and plain JSON
      json = parseRoadmapResponse(content);

    } catch (parseErr) {
      console.error("❌ JSON parsing failed:", parseErr);
      return NextResponse.json(
        { error: "Invalid JSON format in LLM response" },
        { status: 500 }
      );
    }

    // Validate the structure of the JSON response
    if (!json.roadmap || !Array.isArray(json.roadmap)) {
      return NextResponse.json(
        { error: "Response missing valid roadmap array" },
        { status: 500 }
      );
    }

    // return final response
    return NextResponse.json(json);
  } catch (err: unknown) {
  // catch and log any unexpected errors
  if (err instanceof Error) {
    console.error("❌ API error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch roadmap from LLaMA 3", detail: err.message },
      { status: 500 }
    );
  }

  console.error("❌ Unknown API error:", err);
  return NextResponse.json(
    { error: "Failed to fetch roadmap from LLaMA 3", detail: "Unknown error" },
    { status: 500 }
  );
}
}

