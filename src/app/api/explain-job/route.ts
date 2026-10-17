import { NextRequest, NextResponse } from "next/server";
import { groqModel } from '@/app/_libs/distributed';

type ExplainRequest = {
  description: string;
  prediction: 0 | 1; // 1 = Fake, 0 = Real
};

function buildFallbackExplanation(description: string, prediction: 0 | 1) {
  const text = description.toLowerCase();
  const findings: string[] = [];

  if (/no experience|instant hiring|urgent|immediate start|hire now/i.test(text)) {
    findings.push('The posting uses urgency or pressure tactics instead of clear role requirements.');
  }
  if (/guaranteed.*(income|salary|pay)|easy money|unlimited earning|quick cash/i.test(text)) {
    findings.push('It promises unusually high or guaranteed earnings for minimal effort, which is a common scam pattern.');
  }
  if (/send.*(money|payment|deposit|fee)|pay.*(upfront|training|processing)/i.test(text)) {
    findings.push('It asks for money, deposits, or advance payments before any real recruitment process.');
  }
  if (/telegram|whatsapp|dm me|direct message/i.test(text)) {
    findings.push('The recruiter prefers informal messaging apps and personal contact rather than a clear company process.');
  }
  if (/company name|location|responsibilities|qualifications|salary range/i.test(text)) {
    findings.push('The description includes standard hiring details, which is a positive sign for a legitimate listing.');
  }

  if (findings.length === 0) {
    findings.push('The posting sounds relatively structured and professional, with fairly standard hiring language.');
  }

  const advice = prediction === 1
    ? 'Verify the company, ask for official company details, and never pay a fee or send personal banking information before a formal interview.'
    : 'Continue with standard verification steps: check the company website, confirm the recruiter identity, and review the job details against the advertised role.';

  return `- ${findings.join('\n- ')}\n\nAdvice: ${advice}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: ExplainRequest = await req.json();

    if (!body.description || body.prediction === undefined) {
      return NextResponse.json(
        { error: "Missing job description or prediction" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        explanation: buildFallbackExplanation(body.description, body.prediction),
      });
    }

    const label = body.prediction === 1 ? "FAKE" : "REAL";

    const systemPrompt = `
You are an AI system that explains job fraud detection results.

The ML model classified this job as: ${label}

Your task:
- Explain WHY this classification makes sense
- Use bullet points
- Focus on language patterns, missing info, promises, or realism
- Do NOT invent facts
- Be clear and helpful
- End with practical advice

Output format:
- Short explanation bullets
- One short advice paragraph with few and simple sentences
`;

    const userPrompt = `
Job Description:
"""
${body.description}
"""
`;

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      }
    );

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("GROQ error:", err);
      return NextResponse.json({
        explanation: buildFallbackExplanation(body.description, body.prediction),
      });
    }

    const data = await groqRes.json();
    const explanation = data.choices?.[0]?.message?.content || buildFallbackExplanation(body.description, body.prediction);

    return NextResponse.json({
      explanation,
    });
  } catch (error) {
    console.error("Explain job error:", error);
    return NextResponse.json({
      explanation: "- The system could not generate a detailed explanation right now, but your result should still be reviewed with a quick verification check.\n\nAdvice: Confirm the company details, check the recruiter identity, and avoid sending money or personal banking data before a formal interview.",
    });
  }
}
