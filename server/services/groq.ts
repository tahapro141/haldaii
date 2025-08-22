
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface EmailGenerationRequest {
  purpose: string;
  audience?: string;
  benefits?: string;
  tone?: string;
}

export async function generateEmailWithGroq(request: EmailGenerationRequest) {
  try {
    const prompt = `
You are a professional email marketing expert. Generate a compelling email based on these requirements:

Purpose: ${request.purpose}
Target Audience: ${request.audience || "Business professionals"}
Key Benefits: ${request.benefits || "Advanced AI-powered email marketing solutions"}
Tone: ${request.tone || "Professional yet approachable"}

Please generate:
1. A compelling subject line
2. Professional email content with proper HTML formatting

Format your response as JSON:
{
  "subject": "Your subject line here",
  "content": "Your HTML email content here"
}

Make the email engaging, professional, and include a clear call-to-action. Use proper HTML formatting with headings, paragraphs, and styling.
`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        subject: parsed.subject || "AI-Generated Email Campaign",
        content: parsed.content || responseText
      };
    } catch (parseError) {
      // If JSON parsing fails, return the raw content
      return {
        subject: "AI-Generated Email Campaign",
        content: responseText
      };
    }
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Failed to generate email content');
  }
}
