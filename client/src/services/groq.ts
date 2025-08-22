const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GenerateEmailRequest {
  purpose: string;
  audience: string;
  benefits: string;
  tone: string;
}

export async function generateEmailWithGroq(request: GenerateEmailRequest) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }

  const prompt = `
You are an expert email marketing copywriter. Generate a professional email based on the following requirements:

Purpose: ${request.purpose}
Target Audience: ${request.audience}
Key Benefits: ${request.benefits}
Tone: ${request.tone}

Please generate an email with:
1. A compelling subject line
2. Professional email content that includes:
   - Engaging opening
   - Clear value proposition
   - Benefits specific to the audience
   - Strong call-to-action
   - Professional closing

Format your response as JSON with "subject" and "content" fields.

The email should be personalized, engaging, and professional. Keep the content concise but impactful.
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from Groq API');
    }

    try {
      return JSON.parse(content);
    } catch {
      // If JSON parsing fails, create a structured response
      return {
        subject: `Exciting opportunity regarding ${request.purpose}`,
        content: content,
      };
    }
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Failed to generate email content');
  }
}
